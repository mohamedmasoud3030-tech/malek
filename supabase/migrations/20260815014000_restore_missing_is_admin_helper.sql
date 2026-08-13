-- Some live hardening runs removed is_admin() while retaining
-- current_app_role() and is_admin_or_manager(). Later canonical migrations use
-- is_admin() in policy definitions. Restore the baseline fail-closed helper;
-- CREATE OR REPLACE makes this a no-op in canonical databases.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select public.current_app_role() = 'ADMIN'
$function$;

alter function public.is_admin() owner to postgres;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
