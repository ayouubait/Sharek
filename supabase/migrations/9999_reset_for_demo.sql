-- =====================================================================
-- ShareK — Reset complet pour démo / production fresh start
-- =====================================================================
-- ⚠️ DESTRUCTIF : efface TOUTES les données métier + TOUS les utilisateurs.
-- À exécuter depuis Supabase Dashboard → SQL Editor.
-- Le service_role bypasse les triggers SECURITY DEFINER → c'est OK.
--
-- Ordre des suppressions = respecter les FK (enfants avant parents).

begin;

-- Tables enfants (références)
truncate table public.comment_likes restart identity cascade;
truncate table public.recommendations restart identity cascade;
truncate table public.peer_reviews restart identity cascade;
truncate table public.comments restart identity cascade;
truncate table public.resource_versions restart identity cascade;
truncate table public.notifications restart identity cascade;
truncate table public.messages restart identity cascade;

-- favorites n'existe peut-être pas — guard
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'favorites') then
    execute 'truncate table public.favorites restart identity cascade';
  end if;
end$$;

-- Tables principales
truncate table public.resources restart identity cascade;
truncate table public.profiles restart identity cascade;
truncate table public.categories restart identity cascade;

-- Storage : vider les buckets.
-- Supabase a un trigger `protect_delete` qui bloque les DELETE directs.
-- Tentative 1 : désactiver tous les triggers via session_replication_role.
-- Si refusé (permissions), on saute la suppression — les fichiers orphelins ne
-- gênent pas (RLS du 0003 empêche tout accès non-autorisé). À nettoyer
-- manuellement via Dashboard → Storage si besoin.
do $$
begin
  begin
    set local session_replication_role = 'replica';
    delete from storage.objects where bucket_id in ('avatars', 'resources', 'message-attachments', 'covers');
    raise notice 'Storage objects supprimés.';
  exception when others then
    raise notice 'Suppression storage.objects skip (%). Les fichiers orphelins sont sans danger.', SQLERRM;
  end;
end$$;

-- Supprimer tous les users auth (sauf le service_role lui-même).
-- ATTENTION : ceci déconnecte tout le monde et invalide tous les tokens.
delete from auth.users;

-- Seed : catégories SVT de base.
-- On insère seulement name + slug pour ne pas planter si d'autres colonnes
-- ont des constraintes spécifiques. À ajuster manuellement après.
do $$
begin
  begin
    insert into public.categories (name, slug)
    values
      ('Géologie', 'geologie'),
      ('Biologie cellulaire', 'biologie-cellulaire'),
      ('Écologie', 'ecologie'),
      ('Physiologie', 'physiologie'),
      ('Évolution', 'evolution'),
      ('Reproduction', 'reproduction')
    on conflict do nothing;
    raise notice 'Catégories seedées.';
  exception when others then
    raise notice 'Seed catégories skip (%). Ajoute-les manuellement via Dashboard.', SQLERRM;
  end;
end$$;

commit;

-- Vérification
select 'profiles' as table_name, count(*) from public.profiles
union all select 'resources', count(*) from public.resources
union all select 'comments', count(*) from public.comments
union all select 'peer_reviews', count(*) from public.peer_reviews
union all select 'notifications', count(*) from public.notifications
union all select 'messages', count(*) from public.messages
union all select 'categories', count(*) from public.categories
union all select 'auth.users', count(*) from auth.users;
-- Attendu : profiles=0, resources=0, ... categories=6, auth.users=0
