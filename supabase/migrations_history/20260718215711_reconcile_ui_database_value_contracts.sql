-- Reconciles live check constraints and trigger helpers with the canonical values
-- already used by the Rentrix application. This closes write failures where the
-- UI submitted lowercase domain values while Production still enforced legacy
-- uppercase values captured from the historical schema.

begin;

-- Fail closed if Production contains an unknown value that cannot be mapped
-- without a product decision. Known historical aliases are normalized below.
do $preflight_value_contracts$
declare
  v_bad_values text;
begin
  select string_agg(format('priority=%s,status=%s', coalesce(priority, '<null>'), coalesce(status, '<null>')), '; ')
    into v_bad_values
  from (
    select distinct priority, status
    from public.maintenance_records
    where (
      priority is not null
      and lower(btrim(priority)) not in ('low', 'medium', 'normal', 'high', 'urgent')
    ) or (
      status is not null
      and lower(btrim(status)) not in (
        'open', 'new', 'reported', 'assigned', 'in_progress',
        'resolved', 'completed', 'closed', 'cancelled'
      )
    )
  ) invalid_maintenance_values;

  if v_bad_values is not null then
    raise exception 'Unknown maintenance value contract(s): %', v_bad_values;
  end if;

  select string_agg(coalesce(status, '<null>'), ', ')
    into v_bad_values
  from (
    select distinct status
    from public.commissions
    where status is not null
      and lower(btrim(status)) not in (
        'pending', 'approved', 'paid', 'rejected', 'cancelled', 'canceled'
      )
  ) invalid_commission_values;

  if v_bad_values is not null then
    raise exception 'Unknown commission status contract(s): %', v_bad_values;
  end if;
end
$preflight_value_contracts$;

alter table public.maintenance_records
  drop constraint if exists maintenance_records_priority_check,
  drop constraint if exists maintenance_records_status_check;

update public.maintenance_records
set priority = case lower(btrim(priority))
  when 'normal' then 'medium'
  else lower(btrim(priority))
end
where priority is not null;

update public.maintenance_records
set status = case lower(btrim(status))
  when 'new' then 'open'
  when 'reported' then 'open'
  when 'assigned' then 'open'
  when 'completed' then 'resolved'
  when 'cancelled' then 'closed'
  else lower(btrim(status))
end
where status is not null;

alter table public.maintenance_records
  alter column priority set default 'medium',
  alter column status set default 'open',
  add constraint maintenance_records_priority_check
    check (priority is null or priority = any (array['low', 'medium', 'high', 'urgent'])),
  add constraint maintenance_records_status_check
    check (status is null or status = any (array['open', 'in_progress', 'resolved', 'closed']));

alter table public.commissions
  drop constraint if exists check_commission_status;

update public.commissions
set status = case lower(btrim(status))
  when 'rejected' then 'cancelled'
  when 'canceled' then 'cancelled'
  else lower(btrim(status))
end
where status is not null;

alter table public.commissions
  alter column status set default 'pending',
  add constraint check_commission_status
    check (status is null or status = any (array['pending', 'approved', 'paid', 'cancelled']));

-- The historical trigger wrote ACTIVE/OCCUPIED/MAINTENANCE/AVAILABLE even though
-- contracts and units use lowercase canonical values. Recompute both the old and
-- new unit on UPDATE so moving a contract/request cannot leave the previous unit stale.
create or replace function public.update_unit_status()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_unit_id uuid;
  v_unit_ids uuid[];
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

    if exists (
      select 1
      from public.contracts c
      where c.unit_id = v_unit_id
        and lower(coalesce(c.status, '')) = 'active'
        and c.deleted_at is null
    ) then
      v_target_status := 'occupied';
    elsif exists (
      select 1
      from public.maintenance_records m
      where m.unit_id = v_unit_id
        and lower(coalesce(m.status, '')) in ('open', 'in_progress')
        and m.deleted_at is null
    ) then
      v_target_status := 'maintenance';
    else
      v_target_status := 'available';
    end if;

    update public.units
    set status = v_target_status
    where id = v_unit_id
      and status is distinct from v_target_status;
  end loop;

  return coalesce(new, old);
end;
$function$;

-- The unit blocker still searched for legacy NEW/IN_PROGRESS values and omitted
-- soft-delete filtering, so it could miss every request created by the current UI.
create or replace function public.check_unit_maintenance_block(p_unit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_count integer;
  v_requests jsonb;
begin
  select count(*),
    jsonb_agg(jsonb_build_object(
      'id', m.id,
      'title', coalesce(m.title, m.description, ''),
      'priority', coalesce(m.priority, 'medium'),
      'status', m.status
    ))
  into v_count, v_requests
  from public.maintenance_records m
  where m.unit_id = p_unit_id
    and lower(coalesce(m.status, '')) in ('open', 'in_progress')
    and m.deleted_at is null;

  return jsonb_build_object(
    'blocked', v_count > 0,
    'count', coalesce(v_count, 0),
    'requests', coalesce(v_requests, '[]'::jsonb)
  );
end;
$function$;

-- Replay/Production assertions: stop the migration if a future edit leaves the
-- database enforcing a different vocabulary from the application.
do $verify_value_contracts$
declare
  v_definition text;
begin
  select pg_get_constraintdef(c.oid)
    into v_definition
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'maintenance_records'
    and c.conname = 'maintenance_records_priority_check';

  if v_definition is null
     or v_definition not like '%''low''%'
     or v_definition not like '%''medium''%'
     or v_definition not like '%''high''%'
     or v_definition not like '%''urgent''%' then
    raise exception 'Maintenance priority value contract was not installed';
  end if;

  select pg_get_constraintdef(c.oid)
    into v_definition
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'maintenance_records'
    and c.conname = 'maintenance_records_status_check';

  if v_definition is null
     or v_definition not like '%''open''%'
     or v_definition not like '%''in_progress''%'
     or v_definition not like '%''resolved''%'
     or v_definition not like '%''closed''%' then
    raise exception 'Maintenance status value contract was not installed';
  end if;

  select pg_get_constraintdef(c.oid)
    into v_definition
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'commissions'
    and c.conname = 'check_commission_status';

  if v_definition is null
     or v_definition not like '%''pending''%'
     or v_definition not like '%''approved''%'
     or v_definition not like '%''paid''%'
     or v_definition not like '%''cancelled''%' then
    raise exception 'Commission status value contract was not installed';
  end if;

  select pg_get_functiondef('public.update_unit_status()'::regprocedure)
    into v_definition;

  if v_definition like '%''OCCUPIED''%'
     or v_definition like '%''AVAILABLE''%'
     or v_definition like '%''MAINTENANCE''%'
     or v_definition like '%''ACTIVE''%' then
    raise exception 'update_unit_status still contains legacy uppercase domain values';
  end if;
end
$verify_value_contracts$;

commit;
