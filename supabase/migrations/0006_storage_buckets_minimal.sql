-- =====================================================================
-- ShareK — Migration 0006 (urgence)
-- Crée les 3 buckets storage en mode PUBLIC, avec des policies permissives.
-- À appliquer si 0003 n'a pas été exécutée OU si les buckets n'ont jamais
-- été créés depuis le Dashboard Storage.
-- =====================================================================

-- 1. Créer/mettre à jour les buckets
insert into storage.buckets (id, name, public, file_size_limit)
values ('resources', 'resources', true, 104857600)  -- 100 MB
on conflict (id) do update set
  public = true,
  file_size_limit = 104857600;

insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 5242880)  -- 5 MB
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880;

insert into storage.buckets (id, name, public, file_size_limit)
values ('message-attachments', 'message-attachments', false, 10485760)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760;

-- 2. Policies storage MINIMALES (lecture publique, écriture authentifiée).
--    Ces policies sont volontairement larges pour débloquer. À durcir
--    plus tard avec la 0003 complète.
drop policy if exists "resources_public_read" on storage.objects;
create policy "resources_public_read" on storage.objects
  for select using (bucket_id in ('resources', 'avatars'));

drop policy if exists "auth_write_resources" on storage.objects;
create policy "auth_write_resources" on storage.objects
  for insert with check (
    bucket_id in ('resources', 'avatars', 'message-attachments')
    and auth.role() = 'authenticated'
  );

drop policy if exists "auth_update_resources" on storage.objects;
create policy "auth_update_resources" on storage.objects
  for update using (
    bucket_id in ('resources', 'avatars', 'message-attachments')
    and auth.role() = 'authenticated'
  );

drop policy if exists "auth_delete_resources" on storage.objects;
create policy "auth_delete_resources" on storage.objects
  for delete using (
    bucket_id in ('resources', 'avatars', 'message-attachments')
    and auth.role() = 'authenticated'
  );

drop policy if exists "msg_attach_read" on storage.objects;
create policy "msg_attach_read" on storage.objects
  for select using (
    bucket_id = 'message-attachments'
    and auth.role() = 'authenticated'
  );

-- 3. Vérification
select id, name, public, file_size_limit from storage.buckets;
