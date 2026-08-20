-- Live S08 hotfix views predate the canonical S08 column contracts. PostgreSQL
-- cannot replace a view when existing column order/names differ. These are
-- read-only derived surfaces (no stored rows), so drop only the named legacy
-- views; the canonical migration recreates them immediately.

do $reconcile$
declare
  v_third_column text;
begin
  select a.attname into v_third_column
  from pg_attribute a
  where a.attrelid = to_regclass('public.s08_analysis_scope')
    and a.attnum = 3
    and not a.attisdropped;

  -- The legacy live hotfix exposes currency_code as column 3. Canonical S08
  -- exposes accounting_period_id there. Never remove canonical objects.
  if v_third_column is distinct from 'currency_code' then
    return;
  end if;

  drop view if exists public.s08_retroactive_version_differences cascade;
  drop view if exists public.s08_master_lease_readiness cascade;
  drop view if exists public.s08_subledger_gl_reconciliation cascade;
  drop view if exists public.s08_liability_balances_by_period cascade;
  drop view if exists public.s08_analysis_scope cascade;

  drop function if exists public.s08_analyze_settlement_duplicates(uuid, uuid);
  drop function if exists public.s08_analyze_expense_misclassification(uuid, uuid);
  drop function if exists public.s08_analyze_deposit_exceptions(uuid, uuid);
  drop function if exists public.s08_orphan_postings(uuid, uuid);
end;
$reconcile$;
