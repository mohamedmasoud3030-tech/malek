-- Fix sessions RLS ownership checks captured from the live baseline.
--
-- The baseline intentionally preserved live reality where sessions_select_own,
-- sessions_insert_own, and sessions_delete_own compared auth.uid() to
-- public.sessions.id. public.sessions.id is the session row primary key;
-- public.sessions.user_id is the owning app user. Use user_id for ownership.

alter table public.sessions enable row level security;

drop policy if exists sessions_select_own on public.sessions;
drop policy if exists sessions_insert_own on public.sessions;
drop policy if exists sessions_delete_own on public.sessions;

create policy sessions_select_own on public.sessions
  for select to authenticated
  using (((select auth.uid()) = user_id) or app_private.is_admin_or_manager());

create policy sessions_insert_own on public.sessions
  for insert to authenticated
  with check (((select auth.uid()) = user_id) and app_private.is_app_user());

create policy sessions_delete_own on public.sessions
  for delete to authenticated
  using (((select auth.uid()) = user_id) or app_private.is_admin_or_manager());
