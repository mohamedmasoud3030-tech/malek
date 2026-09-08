-- SEC-001/SEC-002: role predicates must be total booleans.
-- Reproduced: a disabled identity yields NULL from current_app_role(); the
-- legacy `IF actor IS NULL OR NOT is_admin_or_manager()` deposit guard then
-- evaluates to NULL rather than TRUE and admits a write. Fix the shared
-- predicates, not a parallel permission resolver or per-RPC identity copy.
-- current_app_role()/active_company_role() remain the sole role authority.
-- Forward-only; no data updates, grants, role catalog or resolver changes.
-- Deployment requires authorized hosted schema/ACL verification. Local replay
-- proves repository behavior only. Existing function ownership/ACLs survive
-- CREATE OR REPLACE; no newly browser-executable function is introduced.

begin;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(public.current_app_role() = 'ADMIN', false);
$function$;

create or replace function public.is_admin_or_manager()
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(public.current_app_role() in ('ADMIN', 'MANAGER'), false);
$function$;

create or replace function public.is_accountant()
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(public.current_app_role() = 'ACCOUNTANT', false);
$function$;

create or replace function public.is_operations()
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(public.current_app_role() = 'OPERATIONS', false);
$function$;

create or replace function public.is_viewer()
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(public.current_app_role() = 'VIEWER', false);
$function$;

commit;
