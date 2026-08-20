-- Live hardening parity: inactive memberships must not retain RLS access,
-- and read-only helpers should not run with elevated definer privileges.
begin;

create or replace function public.is_company_member(
  target_company_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select
    (auth.uid() is null or target_user_id = auth.uid())
    and exists (
      select 1
      from public.company_members cm
      join public.companies c on c.id = cm.company_id
      where cm.company_id = target_company_id
        and cm.user_id = target_user_id
        and cm.is_active
        and c.is_active
    );
$function$;

revoke all on function public.is_company_member(uuid, uuid) from public, anon;
grant execute on function public.is_company_member(uuid, uuid) to authenticated, service_role;

create or replace function public.require_company_id()
returns uuid
language plpgsql
stable security invoker
set search_path to 'public', 'pg_temp'
as $function$
begin
  if public.current_company_id() is null then
    raise exception 'Company context is required (no company_id claim in JWT).' using errcode = '42501';
  end if;
  return public.current_company_id();
end;
$function$;

revoke all on function public.require_company_id() from public, anon;
grant execute on function public.require_company_id() to authenticated, service_role;

create or replace function public.resolve_unit_operational_status(
  p_unit_id uuid,
  p_fallback_status text default 'available'::text
)
returns text
language sql
stable security invoker
set search_path to 'public', 'pg_temp'
as $function$
  select case
    when exists (
      select 1
      from public.maintenance_records m
      where m.unit_id = p_unit_id
        and m.deleted_at is null
        and lower(coalesce(m.status, '')) in ('open', 'in_progress')
    ) then 'maintenance'
    when exists (
      select 1
      from public.contracts c
      where c.unit_id = p_unit_id
        and c.deleted_at is null
        and lower(coalesce(c.status, '')) = 'active'
        and btrim(coalesce(c.start_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
        and btrim(coalesce(c.end_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
        and current_date between btrim(c.start_date::text)::date and btrim(c.end_date::text)::date
    ) then 'occupied'
    when lower(coalesce(p_fallback_status, '')) = 'reserved' then 'reserved'
    else 'available'
  end;
$function$;

revoke all on function public.resolve_unit_operational_status(uuid, text) from public, anon;
grant execute on function public.resolve_unit_operational_status(uuid, text) to authenticated, service_role;

commit;
