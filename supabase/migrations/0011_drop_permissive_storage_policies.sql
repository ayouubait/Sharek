-- =====================================================================
-- ShareK — Migration 0011
-- DURCISSEMENT URGENT : supprime les policies storage permissives de la
-- migration 0006 qui court-circuitent les policies strictes de la 0003.
-- =====================================================================
--
-- Contexte : 0006 a été appliquée AVANT 0003 pour débloquer un test, mais
-- elle laisse n'importe quel user authentifié écrire dans n'importe quel
-- dossier de bucket. La 0003 a ajouté des policies plus strictes (owner-
-- only), mais Postgres applique les policies en OR : si une seule autorise,
-- l'action passe.
--
-- Cette migration supprime les policies permissives. Seules les policies
-- strictes de la 0003 restent actives.

drop policy if exists "resources_public_read" on storage.objects;
drop policy if exists "auth_write_resources" on storage.objects;
drop policy if exists "auth_update_resources" on storage.objects;
drop policy if exists "auth_delete_resources" on storage.objects;
drop policy if exists "msg_attach_read" on storage.objects;

-- Vérif : seules les policies de la 0003 doivent rester.
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
