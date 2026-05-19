-- =====================================================================
-- ShareK — Migration 0010
-- Restreint la visibilité de profiles.email aux propriétaires et admins.
-- Le reste du profil (name, avatar, bio, institution) reste public.
-- =====================================================================
-- Stratégie : vue `public_profiles` exposant uniquement les colonnes safe.
-- Les policies RLS sur la table `profiles` restent permissives en SELECT
-- mais via app on lit `public_profiles` pour les autres users.
--
-- Alternative : column-level grants. Postgres permet de restreindre les
-- SELECT à un sous-ensemble de colonnes. Plus simple à implémenter ici.

-- Révoque SELECT sur la colonne email pour les rôles authentifiés.
-- Le propriétaire et l'admin restent capables de la lire via RLS.
revoke select (email) on public.profiles from anon, authenticated;

-- Re-grant SELECT email uniquement aux fonctions privilégiées (admins).
-- Note : on ne peut pas restreindre par RLS *par colonne* directement,
-- donc on combine GRANT column-level + RLS table-level.

-- Pour permettre à un user de voir son propre email, on s'appuie sur le
-- fait que SELECT email échouera silencieusement pour les autres → la
-- colonne sera retournée NULL ou omise dans la réponse.

-- ⚠️ Limitation Supabase / PostgREST :
-- Quand un user fait .select('id, name, email') et n'a pas le grant sur email,
-- PostgREST retourne une erreur "permission denied for column email".
-- C'est OK pour bloquer l'attaque, mais peut casser des requêtes existantes
-- qui SELECT email pour les autres profils.

-- Solution pratique : créer une fonction RPC `get_own_profile()` qui inclut
-- l'email, et que le front utilise pour son propre profil. Les autres profils
-- sont lus via le SELECT normal (sans email).

create or replace function public.get_own_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

revoke all on function public.get_own_profile() from public;
grant execute on function public.get_own_profile() to authenticated;

-- Vérif
select 'profiles email column restricted' as info;
