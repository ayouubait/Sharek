-- =====================================================================
-- ShareK — Migration 0008
-- Nettoyage final avant production : bucket legacy + buckets orphelins.
-- =====================================================================
-- Idempotente. Sûre à ré-exécuter.

-- 1. Bucket "covers" : legacy depuis le retrait de la cover de profil.
--    Les ressources utilisent le bucket "resources" sous le préfixe /covers/.
do $$
begin
  if exists (select 1 from storage.buckets where id = 'covers') then
    begin
      set local session_replication_role = 'replica';
      delete from storage.objects where bucket_id = 'covers';
      delete from storage.buckets where id = 'covers';
      raise notice 'Bucket "covers" supprimé.';
    exception when others then
      raise notice 'Cleanup "covers" skip (%). Tu peux le supprimer manuellement dans Dashboard → Storage.', SQLERRM;
    end;
  else
    raise notice 'Bucket "covers" déjà absent.';
  end if;
end$$;

-- 2. Tag VACUUM ANALYZE pour rafraîchir les stats du planner après les triggers
--    (impact perf des SELECT sur profiles/resources avec les RLS).
analyze public.profiles;
analyze public.resources;
analyze public.favorites;
analyze public.comments;

-- 3. Vérification finale : liste les buckets restants.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;
