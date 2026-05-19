-- =====================================================================
-- ShareK — Migration 0007
-- Table `favorites` : favoris persistés en DB (remplace localStorage).
-- Permet la synchro cross-device pour les enseignants.
-- =====================================================================

create table if not exists public.favorites (
  user_id      uuid not null references auth.users(id) on delete cascade,
  resource_id  uuid not null references public.resources(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, resource_id)
);

-- Index pour les listings par user (déjà couvert par le PK mais explicite pour lisibilité).
create index if not exists favorites_user_id_created_at_idx
  on public.favorites (user_id, created_at desc);

-- RLS : chacun gère uniquement ses propres favoris.
alter table public.favorites enable row level security;
alter table public.favorites force row level security;

drop policy if exists favorites_select_self on public.favorites;
create policy favorites_select_self on public.favorites
  for select using (auth.uid() = user_id);

drop policy if exists favorites_insert_self on public.favorites;
create policy favorites_insert_self on public.favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists favorites_delete_self on public.favorites;
create policy favorites_delete_self on public.favorites
  for delete using (auth.uid() = user_id);

-- Active la réplication realtime (pour synchro cross-tab si l'utilisateur a 2 onglets ouverts).
do $$
begin
  alter table public.favorites replica identity full;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'favorites'
  ) then
    alter publication supabase_realtime add table public.favorites;
  end if;
end$$;

-- Vérification
select 'favorites' as table_name, count(*) from public.favorites;
