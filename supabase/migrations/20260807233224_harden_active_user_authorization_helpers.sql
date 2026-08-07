-- Live hardening parity: database user state is authoritative for authorization.
-- A stale JWT must not preserve access after a user is disabled/deleted/demoted.
begin;

create or replace function public.current_app_role()
returns text
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    (
      select u.role::text
      from public.users u
      where u.id = auth.uid()
        and u.deleted_at is null
        and u.is_active
        and u.status::text = 'ACTIVE'
    ),
    'USER'::text
  );
$function$;

revoke all on function public.current_app_role() from public, anon, authenticated;
grant execute on function public.current_app_role() to service_role;

create or replace function public.is_app_user()
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select auth.uid() is not null
     and exists (
       select 1
       from public.users u
       where u.id = auth.uid()
         and u.deleted_at is null
         and u.is_active
         and u.status::text = 'ACTIVE'
     );
$function$;

revoke all on function public.is_app_user() from public, anon;
grant execute on function public.is_app_user() to authenticated, service_role;

create or replace function public.is_admin_or_manager()
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select auth.uid() is not null
     and exists (
       select 1
       from public.users u
       where u.id = auth.uid()
         and u.deleted_at is null
         and u.is_active
         and u.status::text = 'ACTIVE'
         and upper(coalesce(u.role::text, 'USER')) in ('ADMIN', 'MANAGER')
     );
$function$;

revoke all on function public.is_admin_or_manager() from public, anon;
grant execute on function public.is_admin_or_manager() to authenticated, service_role;

commit;
