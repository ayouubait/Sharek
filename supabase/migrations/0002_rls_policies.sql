-- =====================================================================
-- ShareK — Production migration 0002
-- Row Level Security policies for every table
-- =====================================================================
-- Each policy is split into SELECT / INSERT / UPDATE / DELETE so it is
-- easy to tweak one operation without affecting the others.
-- Run AFTER 0001_helpers_and_grants.sql.

-- ---------------------------------------------------------------------
-- profiles
-- Public can read non-banned profiles. Users can update their own.
-- Only admins can ban/promote (enforced by trigger + this policy).
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all on public.profiles
  for select using (true);  -- author cards are public; bio is not sensitive

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- resources
-- Everyone can read peer_reviewed resources.
-- Authors see their own drafts. Admins see everything.
-- Authors create their own, edit their own (if not peer_reviewed locked).
-- ---------------------------------------------------------------------
alter table public.resources enable row level security;
alter table public.resources force row level security;

drop policy if exists resources_select_public on public.resources;
create policy resources_select_public on public.resources
  for select using (
    status = 'peer_reviewed'
    or author_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists resources_insert_self on public.resources;
create policy resources_insert_self on public.resources
  for insert with check (
    auth.uid() = author_id
    and not public.is_banned()
  );

drop policy if exists resources_update_owner on public.resources;
create policy resources_update_owner on public.resources
  for update using (
    auth.uid() = author_id and not public.is_banned()
  ) with check (
    auth.uid() = author_id
  );

drop policy if exists resources_update_admin on public.resources;
create policy resources_update_admin on public.resources
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists resources_delete_owner on public.resources;
create policy resources_delete_owner on public.resources
  for delete using (auth.uid() = author_id);

drop policy if exists resources_delete_admin on public.resources;
create policy resources_delete_admin on public.resources
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- resource_versions
-- Visible if the parent resource is visible. Author manages versions.
-- ---------------------------------------------------------------------
alter table public.resource_versions enable row level security;
alter table public.resource_versions force row level security;

drop policy if exists versions_select on public.resource_versions;
create policy versions_select on public.resource_versions
  for select using (
    exists (
      select 1 from public.resources r
      where r.id = resource_versions.resource_id
        and (r.status = 'peer_reviewed' or r.author_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists versions_insert_owner on public.resource_versions;
create policy versions_insert_owner on public.resource_versions
  for insert with check (
    auth.uid() = created_by
    and exists (select 1 from public.resources r where r.id = resource_id and r.author_id = auth.uid())
  );

drop policy if exists versions_delete_owner on public.resource_versions;
create policy versions_delete_owner on public.resource_versions
  for delete using (
    auth.uid() = created_by or public.is_admin()
  );

-- ---------------------------------------------------------------------
-- peer_reviews
-- Reviewers see their own. Authors see reviews on their resources.
-- Admins see everything.
-- ---------------------------------------------------------------------
alter table public.peer_reviews enable row level security;
alter table public.peer_reviews force row level security;

drop policy if exists peer_reviews_select on public.peer_reviews;
create policy peer_reviews_select on public.peer_reviews
  for select using (
    auth.uid() = reviewer_id
    or public.is_admin()
    or exists (select 1 from public.resources r where r.id = resource_id and r.author_id = auth.uid())
  );

drop policy if exists peer_reviews_insert_reviewer on public.peer_reviews;
create policy peer_reviews_insert_reviewer on public.peer_reviews
  for insert with check (
    auth.uid() = reviewer_id
    and not public.is_banned()
  );

drop policy if exists peer_reviews_insert_admin on public.peer_reviews;
create policy peer_reviews_insert_admin on public.peer_reviews
  for insert with check (public.is_admin());

drop policy if exists peer_reviews_update_reviewer on public.peer_reviews;
create policy peer_reviews_update_reviewer on public.peer_reviews
  for update using (auth.uid() = reviewer_id) with check (auth.uid() = reviewer_id);

drop policy if exists peer_reviews_update_admin on public.peer_reviews;
create policy peer_reviews_update_admin on public.peer_reviews
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists peer_reviews_delete_admin on public.peer_reviews;
create policy peer_reviews_delete_admin on public.peer_reviews
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- comments
-- Everyone authenticated can read non-deleted comments on visible resources.
-- Author manages their own. Admin can soft-delete anything.
-- ---------------------------------------------------------------------
alter table public.comments enable row level security;
alter table public.comments force row level security;

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select using (
    (is_deleted = false or public.is_admin())
    and exists (
      select 1 from public.resources r
      where r.id = comments.resource_id
        and (r.status = 'peer_reviewed' or r.author_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists comments_insert_self on public.comments;
create policy comments_insert_self on public.comments
  for insert with check (
    auth.uid() = author_id
    and not public.is_banned()
  );

drop policy if exists comments_update_self on public.comments;
create policy comments_update_self on public.comments
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists comments_update_admin on public.comments;
create policy comments_update_admin on public.comments
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists comments_delete_admin on public.comments;
create policy comments_delete_admin on public.comments
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- comment_likes
-- Anyone authenticated can read. User manages their own.
-- ---------------------------------------------------------------------
alter table public.comment_likes enable row level security;
alter table public.comment_likes force row level security;

drop policy if exists comment_likes_select on public.comment_likes;
create policy comment_likes_select on public.comment_likes
  for select using (auth.role() = 'authenticated');

drop policy if exists comment_likes_insert_self on public.comment_likes;
create policy comment_likes_insert_self on public.comment_likes
  for insert with check (auth.uid() = user_id and not public.is_banned());

drop policy if exists comment_likes_delete_self on public.comment_likes;
create policy comment_likes_delete_self on public.comment_likes
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- notifications
-- Strictly per-user. Only INSERTed by edge functions/triggers (service_role bypasses RLS).
-- ---------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.notifications force row level security;

drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists notifications_delete_self on public.notifications;
create policy notifications_delete_self on public.notifications
  for delete using (auth.uid() = user_id);

-- Allow authenticated INSERT only if creating for someone else as side-effect of an allowed action.
-- We rely on application-level invariants (comment → recipient notif).
-- Tighten later via SECURITY DEFINER triggers if abuse appears.
drop policy if exists notifications_insert_authenticated on public.notifications;
create policy notifications_insert_authenticated on public.notifications
  for insert with check (auth.role() = 'authenticated' and not public.is_banned());

-- ---------------------------------------------------------------------
-- messages (direct messages between users)
-- Sender + receiver only. Admins explicitly NOT given read access (privacy).
-- ---------------------------------------------------------------------
alter table public.messages enable row level security;
alter table public.messages force row level security;

drop policy if exists messages_select_participants on public.messages;
create policy messages_select_participants on public.messages
  for select using (
    auth.uid() = sender_id or auth.uid() = receiver_id
  );

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages
  for insert with check (
    auth.uid() = sender_id and not public.is_banned()
  );

drop policy if exists messages_update_receiver on public.messages;
create policy messages_update_receiver on public.messages
  for update using (auth.uid() = receiver_id) with check (auth.uid() = receiver_id);

drop policy if exists messages_delete_sender on public.messages;
create policy messages_delete_sender on public.messages
  for delete using (auth.uid() = sender_id);

-- ---------------------------------------------------------------------
-- recommendations
-- Visible if peer_review is visible. Reviewer creates.
-- ---------------------------------------------------------------------
alter table public.recommendations enable row level security;
alter table public.recommendations force row level security;

drop policy if exists recommendations_select on public.recommendations;
create policy recommendations_select on public.recommendations
  for select using (
    auth.uid() = reviewer_id
    or public.is_admin()
    or exists (
      select 1 from public.resources r
      where r.id = resource_id and r.author_id = auth.uid()
    )
  );

drop policy if exists recommendations_insert_self on public.recommendations;
create policy recommendations_insert_self on public.recommendations
  for insert with check (auth.uid() = reviewer_id and not public.is_banned());

drop policy if exists recommendations_delete_self on public.recommendations;
create policy recommendations_delete_self on public.recommendations
  for delete using (auth.uid() = reviewer_id or public.is_admin());

-- ---------------------------------------------------------------------
-- favorites (presumed table — adjust columns if different)
-- Per-user. Anyone authenticated can favorite peer_reviewed resources.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'favorites') then
    execute 'alter table public.favorites enable row level security';
    execute 'alter table public.favorites force row level security';

    execute 'drop policy if exists favorites_select_self on public.favorites';
    execute 'create policy favorites_select_self on public.favorites for select using (auth.uid() = user_id)';

    execute 'drop policy if exists favorites_insert_self on public.favorites';
    execute 'create policy favorites_insert_self on public.favorites for insert with check (auth.uid() = user_id and not public.is_banned())';

    execute 'drop policy if exists favorites_delete_self on public.favorites';
    execute 'create policy favorites_delete_self on public.favorites for delete using (auth.uid() = user_id)';
  end if;
end$$;

-- ---------------------------------------------------------------------
-- categories
-- Read public. Write admin-only.
-- ---------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.categories force row level security;

drop policy if exists categories_select_all on public.categories;
create policy categories_select_all on public.categories for select using (true);

drop policy if exists categories_write_admin on public.categories;
create policy categories_write_admin on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- platform_settings
-- Read public (for hero text etc.). Write admin-only.
-- ---------------------------------------------------------------------
alter table public.platform_settings enable row level security;
alter table public.platform_settings force row level security;

drop policy if exists platform_settings_select_all on public.platform_settings;
create policy platform_settings_select_all on public.platform_settings for select using (true);

drop policy if exists platform_settings_write_admin on public.platform_settings;
create policy platform_settings_write_admin on public.platform_settings
  for all using (public.is_admin()) with check (public.is_admin());
