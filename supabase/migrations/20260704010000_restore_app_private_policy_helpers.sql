-- Restore historical app_private policy helpers before live-capture migrations.
--
-- The code-first baseline exposes the canonical authorization helpers in public,
-- while later captured migrations reference app_private.* in RLS policies.
-- These wrappers preserve the same authorization decisions without duplicating
-- role logic or widening privileges.

create schema if not exists app_private;

create or replace function app_private.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_app_user()
$$;

create or replace function app_private.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin_or_manager()
$$;

revoke all on schema app_private from public;
revoke all on function app_private.is_app_user() from public;
revoke all on function app_private.is_admin_or_manager() from public;

grant usage on schema app_private to authenticated;
grant execute on function app_private.is_app_user() to authenticated;
grant execute on function app_private.is_admin_or_manager() to authenticated;
