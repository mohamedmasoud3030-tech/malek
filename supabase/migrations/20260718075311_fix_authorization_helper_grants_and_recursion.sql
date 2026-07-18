-- Restore the live authorization contract used by legacy and current RLS policies.
--
-- Legacy policies still call app_private.* helpers, so authenticated must be
-- allowed to execute both compatibility wrappers. Keep each helper pair
-- strictly one-way to prevent stack-depth recursion.

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

create or replace function public.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select auth.uid() is not null
     and upper(coalesce(public.current_app_role(), 'USER')) in ('ADMIN', 'MANAGER')
$function$;

create or replace function app_private.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select public.is_admin_or_manager()
$function$;

revoke all on function public.is_app_user() from public, anon, authenticated;
revoke all on function app_private.is_app_user() from public, anon, authenticated;
revoke all on function public.is_admin_or_manager() from public, anon, authenticated;
revoke all on function app_private.is_admin_or_manager() from public, anon, authenticated;

grant execute on function public.is_app_user() to authenticated, service_role;
grant execute on function app_private.is_app_user() to authenticated, service_role;
grant execute on function public.is_admin_or_manager() to authenticated, service_role;
grant execute on function app_private.is_admin_or_manager() to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
