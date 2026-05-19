-- =====================================================================
-- ShareK — Production migration 0003
-- Storage bucket policies (avatars, message-attachments, resources)
-- =====================================================================
-- Convention: every uploaded path starts with the owner's auth.uid()
-- (e.g. avatars/<uid>/avatar_<ts>.png). Policies enforce that prefix.
--
-- Existing upload code in src/pages/profil/page.tsx ALREADY uses
-- `${user.id}/avatar_*` — these policies match that layout.

-- ---------------------------------------------------------------------
-- AVATARS (public read, owner-only write)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png','image/jpeg','image/jpg','image/webp','image/gif'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/jpg','image/webp','image/gif'];

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
    and not public.is_banned()
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

-- ---------------------------------------------------------------------
-- MESSAGE ATTACHMENTS (private, participants only)
-- Path layout: <senderId>/<receiverId>/<filename>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('message-attachments', 'message-attachments', false, 10485760)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760;

drop policy if exists msg_attach_read on storage.objects;
create policy msg_attach_read on storage.objects
  for select using (
    bucket_id = 'message-attachments'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or auth.uid()::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists msg_attach_insert on storage.objects;
create policy msg_attach_insert on storage.objects
  for insert with check (
    bucket_id = 'message-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
    and not public.is_banned()
  );

drop policy if exists msg_attach_delete on storage.objects;
create policy msg_attach_delete on storage.objects
  for delete using (
    bucket_id = 'message-attachments'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

-- ---------------------------------------------------------------------
-- RESOURCES (public read for peer_reviewed files, owner-managed)
-- Path layout: <authorId>/<resourceId>/<filename>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('resources', 'resources', true, 104857600)  -- 100 MB
on conflict (id) do update set
  public = true,
  file_size_limit = 104857600;

drop policy if exists resources_storage_read on storage.objects;
create policy resources_storage_read on storage.objects
  for select using (bucket_id = 'resources');

drop policy if exists resources_storage_insert on storage.objects;
create policy resources_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'resources'
    and auth.uid()::text = (storage.foldername(name))[1]
    and not public.is_banned()
  );

drop policy if exists resources_storage_update on storage.objects;
create policy resources_storage_update on storage.objects
  for update using (
    bucket_id = 'resources' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists resources_storage_delete on storage.objects;
create policy resources_storage_delete on storage.objects
  for delete using (
    bucket_id = 'resources'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

-- ---------------------------------------------------------------------
-- REMOVE LEGACY "covers" BUCKET (no longer used since cover image was dropped)
-- Le trigger storage.protect_delete() bloque les DELETE directs ; on bypass
-- via session_replication_role = 'replica' (le rôle postgres a cette permission).
-- Wrappé dans une exception pour ne pas faire échouer toute la migration si
-- la permission est refusée.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from storage.buckets where id = 'covers') then
    begin
      set local session_replication_role = 'replica';
      delete from storage.objects where bucket_id = 'covers';
      delete from storage.buckets where id = 'covers';
      raise notice 'Legacy bucket "covers" supprimé.';
    exception when others then
      raise notice 'Suppression bucket "covers" skip (%). À supprimer via Dashboard → Storage.', SQLERRM;
    end;
  end if;
end$$;
