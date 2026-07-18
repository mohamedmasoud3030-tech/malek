-- Unit creation/editing and contract linking must remain one coherent data contract.
begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'units'
      and indexname = 'units_property_unit_number_active_uidx'
      and indexdef like '%lower(btrim(unit_number))%'
      and indexdef like '%deleted_at IS NULL%'
  ),
  'active unit numbers are unique within each property'
);

select ok(
  (
    select pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'contracts'
      and c.conname = 'contracts_unit_property_fkey'
  ) like '%FOREIGN KEY (unit_id, property_id)%REFERENCES units(id, property_id)%',
  'a contract cannot link a unit from another property'
);

select ok(
  position("then 'maintenance'" in pg_get_functiondef('public.resolve_unit_operational_status(uuid,text)'::regprocedure))
    < position("then 'occupied'" in pg_get_functiondef('public.resolve_unit_operational_status(uuid,text)'::regprocedure))
  and pg_get_functiondef('public.resolve_unit_operational_status(uuid,text)'::regprocedure)
    like '%current_date between btrim(c.start_date)::date and btrim(c.end_date)::date%'
  and pg_get_functiondef('public.resolve_unit_operational_status(uuid,text)'::regprocedure)
    like '%then ''reserved''%',
  'unit status derives from maintenance, current contracts, then manual reservation'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class rel on rel.oid = t.tgrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'units'
      and t.tgname = 'enforce_unit_operational_status_on_units'
      and not t.tgisinternal
  ),
  'direct unit edits cannot contradict operational activity'
);

select ok(
  exists (
    select 1
    from cron.job
    where jobname = 'rentrix-unit-status-hourly'
      and schedule = '5 * * * *'
      and active
      and command like '%recalculate_unit_statuses%'
  ),
  'time-based contract starts and ends reconcile unit status hourly'
);

select ok(
  pg_get_functiondef('public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text)'::regprocedure)
    like '%u.status in (''maintenance'', ''reserved'')%'
  and pg_get_functiondef('public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text)'::regprocedure)
    like '%btrim(c.start_date)::date <= p_end_date%'
  and pg_get_functiondef('public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text)'::regprocedure)
    like '%btrim(c.end_date)::date >= p_start_date%',
  'contract creation rejects blocked units and inclusive overlaps'
);

select ok(
  pg_get_functiondef('public.update_contract_atomic(text,text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text)'::regprocedure)
    like '%p_unit_id is distinct from v_old.unit_id%'
  and pg_get_functiondef('public.update_contract_atomic(text,text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text)'::regprocedure)
    like '%c.id <> p_contract_id%'
  and pg_get_functiondef('public.update_contract_atomic(text,text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text)'::regprocedure)
    like '%btrim(c.start_date)::date <= p_end_date%'
  and pg_get_functiondef('public.update_contract_atomic(text,text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text)'::regprocedure)
    like '%btrim(c.end_date)::date >= p_start_date%',
  'contract editing keeps its current unit while rejecting invalid moves and overlaps'
);

select ok(
  not has_function_privilege('anon', 'public.resolve_unit_operational_status(uuid,text)'::regprocedure, 'execute')
  and not has_function_privilege('anon', 'public.recalculate_unit_statuses()'::regprocedure, 'execute')
  and not has_function_privilege('authenticated', 'public.recalculate_unit_statuses()'::regprocedure, 'execute'),
  'unit status helper privileges stay least-privilege'
);

select * from finish();
rollback;
