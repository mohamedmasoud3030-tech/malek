-- Fix the live authorization-helper recursion that made RLS-protected
-- reads and writes fail with "stack depth limit exceeded".
--
-- Canonical contract:
--   public.is_app_user() answers directly from auth.uid().
--   app_private.is_app_user() remains a compatibility wrapper for legacy
--   policies, but only delegates one way to the canonical public helper.
--
-- No table data or user role is changed by this migration.

begin;

create or replace function public.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select auth.uid() is not null
$function$;

create or replace function app_private.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select public.is_app_user()
$function$;

revoke all on function public.is_app_user() from public, anon, authenticated;
revoke all on function app_private.is_app_user() from public, anon, authenticated;
grant execute on function public.is_app_user() to authenticated, service_role;
grant execute on function app_private.is_app_user() to service_role;

commit;
