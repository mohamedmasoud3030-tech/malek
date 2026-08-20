-- Reconcile a legacy live-only expenses.id text shape with the canonical UUID
-- contract declared by the core schema.
--
-- This repair is intentionally fail-closed. It converts the column only when
-- the legacy text shape is present, the table contains no rows, and no foreign
-- key references expenses. Any data-bearing or referenced legacy table raises
-- a controlled exception for a dedicated data migration instead of coercing or
-- losing identifiers. Canonical databases are a no-op.

do $reconcile$
declare
  v_type text;
  v_row_count bigint;
  v_fk_count bigint;
begin
  select format_type(a.atttypid, a.atttypmod)
    into v_type
  from pg_attribute a
  where a.attrelid = 'public.expenses'::regclass
    and a.attname = 'id'
    and not a.attisdropped;

  if v_type is distinct from 'text' then
    return;
  end if;

  select count(*) into v_row_count from public.expenses;
  select count(*) into v_fk_count
  from pg_constraint
  where contype = 'f'
    and confrelid = 'public.expenses'::regclass;

  if v_row_count <> 0 or v_fk_count <> 0 then
    raise exception
      'LEGACY_EXPENSE_ID_REQUIRES_DATA_MIGRATION: rows=%, inbound_fks=%',
      v_row_count,
      v_fk_count
      using errcode = 'P0001';
  end if;

  alter table public.expenses alter column id drop default;
  alter table public.expenses
    alter column id type uuid using id::uuid;
  alter table public.expenses
    alter column id set default gen_random_uuid();
end;
$reconcile$;
