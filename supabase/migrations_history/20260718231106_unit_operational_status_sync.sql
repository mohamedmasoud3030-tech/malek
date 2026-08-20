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

create or replace function public.enforce_unit_operational_status()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  new.status := public.resolve_unit_operational_status(new.id, new.status);
  return new;
end;
$function$;

drop trigger if exists enforce_unit_operational_status_on_units on public.units;
create trigger enforce_unit_operational_status_on_units
before insert or update of status on public.units
for each row execute function public.enforce_unit_operational_status();

create or replace function public.update_unit_status()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_unit_id uuid;
  v_unit_ids uuid[];
  v_current_status text;
  v_target_status text;
begin
  if tg_op = 'DELETE' then
    v_unit_ids := array[old.unit_id];
  elsif tg_op = 'INSERT' then
    v_unit_ids := array[new.unit_id];
  else
    v_unit_ids := array[old.unit_id, new.unit_id];
  end if;

  foreach v_unit_id in array v_unit_ids
  loop
    if v_unit_id is null then
      continue;
    end if;

    select u.status into v_current_status
    from public.units u
    where u.id = v_unit_id;

    if not found then
      continue;
    end if;

    v_target_status := public.resolve_unit_operational_status(v_unit_id, v_current_status);

    update public.units
    set status = v_target_status
    where id = v_unit_id
      and status is distinct from v_target_status;
  end loop;

  return coalesce(new, old);
end;
$function$;

create or replace function public.recalculate_unit_statuses()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_updated integer;
begin
  update public.units u
  set status = public.resolve_unit_operational_status(u.id, u.status)
  where u.deleted_at is null
    and u.status is distinct from public.resolve_unit_operational_status(u.id, u.status);

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$function$;

revoke execute on function public.recalculate_unit_statuses() from public, anon, authenticated;
grant execute on function public.recalculate_unit_statuses() to service_role;

select public.recalculate_unit_statuses();

commit;
