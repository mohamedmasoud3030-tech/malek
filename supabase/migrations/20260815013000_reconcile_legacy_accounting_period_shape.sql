-- Reconcile the live S03 accounting-period hotfix shape
-- (period_start/period_end plus soft/hard close audit columns) with the
-- canonical Stage 3 contract (name/start_date/end_date/closed_at/closed_by).
-- Existing periods are preserved and deterministically projected into the
-- canonical columns. Canonical databases are a no-op.

do $reconcile$
begin
  if to_regclass('public.accounting_periods') is null
     or exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'accounting_periods'
         and column_name = 'start_date'
     ) then
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'accounting_periods'
      and column_name = 'period_start'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'accounting_periods'
      and column_name = 'period_end'
  ) then
    raise exception 'UNKNOWN_ACCOUNTING_PERIOD_SHAPE'
      using errcode = 'P0001';
  end if;

  alter table public.accounting_periods
    add column name text,
    add column start_date date,
    add column end_date date,
    add column closed_at timestamptz,
    add column closed_by uuid,
    add column reopen_reason text;

  update public.accounting_periods
  set name = 'Period ' || period_start::text || ' - ' || period_end::text,
      start_date = period_start,
      end_date = period_end,
      closed_at = case
        when status = 'HARD_CLOSED' then hard_closed_at
        when status = 'SOFT_CLOSED' then soft_closed_at
        else null
      end,
      closed_by = case
        when status = 'HARD_CLOSED' then hard_closed_by
        when status = 'SOFT_CLOSED' then soft_closed_by
        else null
      end;

  alter table public.accounting_periods
    alter column name set not null,
    alter column start_date set not null,
    alter column end_date set not null;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.accounting_periods'::regclass
      and conname = 'accounting_periods_name_company_key'
  ) then
    alter table public.accounting_periods
      add constraint accounting_periods_name_company_key
      unique (company_id, name);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.accounting_periods'::regclass
      and conname = 'accounting_periods_range_chk'
  ) then
    alter table public.accounting_periods
      add constraint accounting_periods_range_chk
      check (start_date <= end_date);
  end if;
end;
$reconcile$;
