begin;

create or replace function public.resolve_unit_operational_status(
  p_unit_id uuid,
  p_fallback_status text default 'available'
)
returns text
language sql
stable
security definer
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

revoke execute on function public.resolve_unit_operational_status(uuid, text) from public, anon;
grant execute on function public.resolve_unit_operational_status(uuid, text) to authenticated, service_role;

commit;
