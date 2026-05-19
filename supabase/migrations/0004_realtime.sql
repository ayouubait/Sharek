-- =====================================================================
-- ShareK — Production migration 0004
-- Enable realtime replication on tables used by the client
-- =====================================================================
-- The `supabase_realtime` publication is created by Supabase by default.
-- We add tables to it. Idempotent — `if not exists` guards prevent errors.

do $$
declare
  tbl text;
  tables_to_add text[] := array[
    'notifications',
    'messages',
    'comments',
    'comment_likes',
    'profiles'
  ];
begin
  foreach tbl in array tables_to_add loop
    -- Set REPLICA IDENTITY FULL so UPDATE/DELETE events ship the old row.
    execute format('alter table public.%I replica identity full', tbl);

    -- Add to the realtime publication if not already a member.
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end$$;
