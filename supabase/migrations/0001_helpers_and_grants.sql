-- =====================================================================
-- ShareK — Production migration 0001
-- Helpers, role function, default grants
-- =====================================================================
-- Idempotent: safe to run multiple times.
-- Run this BEFORE 0002_rls_policies.sql.

-- Make sure the `authenticated` and `anon` roles cannot run arbitrary
-- functions on internal schemas (Supabase default — re-asserted).
revoke all on schema public from public;
grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------
-- is_admin(): server-side admin check. Use in every admin-only RLS policy.
-- SECURITY DEFINER so it can read profiles even when the caller cannot.
-- ---------------------------------------------------------------------
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = uid),
    false
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------
-- is_banned(): server-side ban check.
-- ---------------------------------------------------------------------
create or replace function public.is_banned(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_banned from public.profiles where id = uid),
    false
  );
$$;

revoke all on function public.is_banned(uuid) from public;
grant execute on function public.is_banned(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- handle_new_user(): auto-create profile row when a new auth user signs up.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, created_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'teacher'),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Block role escalation: a regular user must never set their own role to admin.
-- ---------------------------------------------------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only admins can change the role column.
  if (new.role is distinct from old.role) and not public.is_admin(auth.uid()) then
    raise exception 'Forbidden: only admins can change role';
  end if;
  -- Only admins can change ban status.
  if (new.is_banned is distinct from old.is_banned) and not public.is_admin(auth.uid()) then
    raise exception 'Forbidden: only admins can change ban status';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();
