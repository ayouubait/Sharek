-- =====================================================================
-- ShareK — Migration 0013
-- Sweep complet des policies legacy storage (toutes les "Allow ...").
-- =====================================================================
--
-- 0011 et 0012 ont droppé certaines policies mais d'autres ont surgi
-- du setup Bolt/Readdy.ai. Cette fois on dégage TOUT ce qui commence
-- par "Allow " dans storage.objects.
--
-- Les policies structurées qu'on garde (issues de 0003) :
--   avatars_*, msg_attach_*, resources_storage_*

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'Allow %'
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
    raise notice 'Drop legacy policy: %', pol.policyname;
  end loop;
end$$;

-- Vérification finale : seules les policies structurées doivent rester.
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
