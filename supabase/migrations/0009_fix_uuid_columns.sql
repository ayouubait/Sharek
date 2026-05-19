-- =====================================================================
-- ShareK — Migration 0009
-- Convertit les colonnes "text" en "uuid" pour les FK auth-related.
-- Pré-requis pour 0002 (les policies RLS comparent auth.uid() à ces colonnes).
-- =====================================================================
-- Idempotente : si la colonne est déjà uuid, on saute.
-- Sécurité : si une valeur n'est pas un UUID valide, on la met à NULL
--           (impossible de garder l'auteur si l'ID est corrompu).

begin;

-- ÉTAPE 0 : Drop toutes les policies RLS existantes sur les tables affectées.
-- Postgres refuse l'ALTER COLUMN TYPE si la colonne est référencée dans une
-- policy. La migration 0002 (à appliquer juste après) recréera proprement
-- toutes les policies sur les colonnes en uuid.
do $$
declare
  pol record;
  affected_tables text[] := array[
    'comment_likes', 'comments', 'messages', 'notifications',
    'peer_reviews', 'recommendations', 'resource_versions', 'resources',
    'favorites', 'profiles'
  ];
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and tablename = any(affected_tables)
  loop
    execute format('drop policy if exists %I on %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
    raise notice 'Drop policy % on %.%', pol.policyname, pol.schemaname, pol.tablename;
  end loop;
end$$;

-- Helper : convertit une colonne text en uuid, en nettoyant d'abord les
-- valeurs invalides. Skip si déjà uuid.
do $$
declare
  is_text boolean;
  uuid_re text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  cols text[][] := array[
    -- format : [table, column]
    array['comment_likes',     'user_id'],
    array['comments',          'author_id'],
    array['messages',          'sender_id'],
    array['messages',          'receiver_id'],
    array['notifications',     'user_id'],
    array['notifications',     'resource_id'],
    array['peer_reviews',      'reviewer_id'],
    array['recommendations',   'reviewer_id'],
    array['resource_versions', 'created_by'],
    array['resource_versions', 'resource_id'],
    array['resources',         'author_id']
  ];
  i int;
  tbl text;
  col text;
begin
  for i in 1..array_length(cols, 1) loop
    tbl := cols[i][1];
    col := cols[i][2];

    -- Vérifie si la colonne est encore text
    select data_type = 'text' into is_text
    from information_schema.columns
    where table_schema = 'public' and table_name = tbl and column_name = col;

    if is_text is null then
      raise notice 'Colonne %.% inexistante, skip.', tbl, col;
      continue;
    end if;

    if not is_text then
      raise notice 'Colonne %.% déjà uuid, skip.', tbl, col;
      continue;
    end if;

    -- 1. Set NULL toute valeur qui n'est pas un UUID valide
    execute format(
      'update public.%I set %I = null where %I is not null and %I !~ %L',
      tbl, col, col, col, uuid_re
    );

    -- 2. ALTER COLUMN TYPE uuid USING col::uuid
    --    Postgres drop automatiquement les FK incompatibles. On les recrée plus bas.
    execute format(
      'alter table public.%I alter column %I type uuid using %I::uuid',
      tbl, col, col
    );

    raise notice 'Converti %.% : text → uuid', tbl, col;
  end loop;
end$$;

-- Re-crée les FK qui peuvent maintenant être typées correctement.
-- Toutes pointent vers auth.users(id) sauf resource_id qui pointe vers resources(id).
do $$
declare
  fk record;
  fk_specs text[][] := array[
    -- [table, column, ref_table, ref_column]
    array['comment_likes',     'user_id',     'auth.users',       'id'],
    array['comments',          'author_id',   'auth.users',       'id'],
    array['messages',          'sender_id',   'auth.users',       'id'],
    array['messages',          'receiver_id', 'auth.users',       'id'],
    array['notifications',     'user_id',     'auth.users',       'id'],
    array['notifications',     'resource_id', 'public.resources', 'id'],
    array['peer_reviews',      'reviewer_id', 'auth.users',       'id'],
    array['recommendations',   'reviewer_id', 'auth.users',       'id'],
    array['resource_versions', 'created_by',  'auth.users',       'id'],
    array['resource_versions', 'resource_id', 'public.resources', 'id'],
    array['resources',         'author_id',   'auth.users',       'id']
  ];
  i int;
  tbl text;
  col text;
  ref_tbl text;
  ref_col text;
  fk_name text;
begin
  for i in 1..array_length(fk_specs, 1) loop
    tbl     := fk_specs[i][1];
    col     := fk_specs[i][2];
    ref_tbl := fk_specs[i][3];
    ref_col := fk_specs[i][4];
    fk_name := format('%s_%s_fkey', tbl, col);

    -- Vérifie que la colonne existe ET est uuid avant de tenter
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl
        and column_name = col and data_type = 'uuid'
    ) then
      continue;
    end if;

    -- Drop FK existante si elle existe (idempotent)
    execute format('alter table public.%I drop constraint if exists %I', tbl, fk_name);

    -- Re-create avec ON DELETE adapté
    begin
      if ref_tbl = 'auth.users' then
        -- Cascade : si l'user est supprimé, ses contributions le sont aussi
        execute format(
          'alter table public.%I add constraint %I foreign key (%I) references %s(%I) on delete cascade',
          tbl, fk_name, col, ref_tbl, ref_col
        );
      else
        -- Cascade aussi pour resource_id → resources
        execute format(
          'alter table public.%I add constraint %I foreign key (%I) references %s(%I) on delete cascade',
          tbl, fk_name, col, ref_tbl, ref_col
        );
      end if;
      raise notice 'FK ajoutée : %.% → %.%', tbl, col, ref_tbl, ref_col;
    exception when others then
      raise notice 'FK skip pour %.% (%) — peut-être déjà présente ou conflit', tbl, col, SQLERRM;
    end;
  end loop;
end$$;

commit;

-- Vérification finale : toutes les colonnes auth-related sont-elles uuid ?
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and column_name in ('id', 'user_id', 'author_id', 'reviewer_id', 'created_by',
                      'sender_id', 'receiver_id', 'resource_id')
order by table_name, column_name;
