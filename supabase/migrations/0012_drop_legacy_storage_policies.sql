-- =====================================================================
-- ShareK — Migration 0012
-- Supprime les policies storage LEGACY créées par l'init Bolt/Readdy.ai
-- avant la mise en place du hardening.
-- =====================================================================
--
-- Contexte : à la création du projet, des policies storage permissives
-- ont été ajoutées (probablement par le setup Bolt/Readdy.ai). Elles
-- coexistent avec les policies strictes de 0003 et créent une faille
-- (cf. Test 4 offensif : upload réussi dans dossier d'autrui).
--
-- Liste des policies à dropper :
--   - "Allow authenticated uploads"           (INSERT trop permissif)
--   - "Allow authenticated update own avatars" (doublon de avatars_update)
--   - "Allow authenticated update own covers"  (bucket covers legacy)
--   - "Allow public read"                      (SELECT sans filtre bucket)
--   - "Allow public read avatars"              (doublon de avatars_read)
--   - "Allow public read covers"               (bucket covers legacy)

drop policy if exists "Allow authenticated uploads" on storage.objects;
drop policy if exists "Allow authenticated update own avatars" on storage.objects;
drop policy if exists "Allow authenticated update own covers" on storage.objects;
drop policy if exists "Allow public read" on storage.objects;
drop policy if exists "Allow public read avatars" on storage.objects;
drop policy if exists "Allow public read covers" on storage.objects;

-- Ajoute la policy msg_attach_read manquante (j'ai constaté qu'elle n'est
-- pas dans tes policies actuelles - elle a été droppée par 0011).
drop policy if exists msg_attach_read on storage.objects;
create policy msg_attach_read on storage.objects
  for select using (
    bucket_id = 'message-attachments'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or auth.uid()::text = (storage.foldername(name))[2]
    )
  );

-- Vérification finale
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
