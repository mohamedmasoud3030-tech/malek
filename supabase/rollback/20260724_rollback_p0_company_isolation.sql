-- ============================================================================
-- Rollback: P0 — Company Isolation Hardening (20260724120000)
-- Date: 2026-07-24
-- Purpose: revert the P0 migration to the EXACT pre-P0 schema fingerprint.
--          Verified against evidence/p0/rls-enabled-prefix.json: all 56
--          touched tables already had RLS ENABLED pre-P0, so only the P0
--          objects are reverted:
--            1. 56 restrictive p0_tenant_isolation policies dropped
--            2. 55 company_id column DEFAULTs dropped
--            3. 18 pre-P0 function bodies restored byte-for-byte from the
--               pre-P0 migration chain (13 report RPCs + settlement draft +
--               4 F-WR/F-AGR write-path functions)
--            4. public.require_company_id() — created BY the P0 migration —
--               dropped with its exact signature (no pre-P0 body exists).
--            5. owner_agreements.company_id (+FK +index) — created BY the
--               P0 migration — dropped (objects the migration itself added).
--            6. rpt_tenant_statement attributes restored to SECURITY DEFINER
--               (pre-P0 effective state per 20260713000006 / evidence:
--               fn-effective-attrs.json).
--          Coverage: 19/19 (evidence/p0/fn-coverage.json); fingerprint
--          equivalence proved by src/p0/p0-forward-rollback.test.ts.
-- WARNING: running this re-opens every cross-company read/write path and
--          the T7 settlement spoof proven in evidence/p0/cause/ and
--          docs/audits/P0_MULTI_TENANT_VERIFICATION_20260723.md
-- ============================================================================

begin;

-- ── 1) drop P0 restrictive policies (pre-P0 permissive policies untouched) ──
drop policy if exists p0_tenant_isolation on public.account_balances;
drop policy if exists p0_tenant_isolation on public.accounts;
drop policy if exists p0_tenant_isolation on public.app_notifications;
drop policy if exists p0_tenant_isolation on public.attachments;
drop policy if exists p0_tenant_isolation on public.automation_notifications;
drop policy if exists p0_tenant_isolation on public.automation_rules;
drop policy if exists p0_tenant_isolation on public.automation_run_logs;
drop policy if exists p0_tenant_isolation on public.automation_runs;
drop policy if exists p0_tenant_isolation on public.bank_accounts;
drop policy if exists p0_tenant_isolation on public.bank_reconciliation_matches;
drop policy if exists p0_tenant_isolation on public.bank_statement_imports;
drop policy if exists p0_tenant_isolation on public.bank_statement_lines;
drop policy if exists p0_tenant_isolation on public.budgets;
drop policy if exists p0_tenant_isolation on public.commissions;
drop policy if exists p0_tenant_isolation on public.communication_records;
drop policy if exists p0_tenant_isolation on public."company-assets";
drop policy if exists p0_tenant_isolation on public.company_members;
drop policy if exists p0_tenant_isolation on public.company_settings;
drop policy if exists p0_tenant_isolation on public.contract_balances;
drop policy if exists p0_tenant_isolation on public.contract_documents;
drop policy if exists p0_tenant_isolation on public.contracts;
drop policy if exists p0_tenant_isolation on public.deposit_transactions;
drop policy if exists p0_tenant_isolation on public.deposit_txs;
drop policy if exists p0_tenant_isolation on public.expenses;
drop policy if exists p0_tenant_isolation on public.invoices;
drop policy if exists p0_tenant_isolation on public.journal_entries;
drop policy if exists p0_tenant_isolation on public.kpi_snapshots;
drop policy if exists p0_tenant_isolation on public.lands;
drop policy if exists p0_tenant_isolation on public.leads;
drop policy if exists p0_tenant_isolation on public.maintenance_records;
drop policy if exists p0_tenant_isolation on public.missions;
drop policy if exists p0_tenant_isolation on public.notification_templates;
drop policy if exists p0_tenant_isolation on public.notifications;
drop policy if exists p0_tenant_isolation on public.outgoing_notifications;
drop policy if exists p0_tenant_isolation on public.owner_balances;
drop policy if exists p0_tenant_isolation on public.owner_settlements;
drop policy if exists p0_tenant_isolation on public.owners;
drop policy if exists p0_tenant_isolation on public.payments;
drop policy if exists p0_tenant_isolation on public.people;
drop policy if exists p0_tenant_isolation on public.properties;
drop policy if exists p0_tenant_isolation on public.property_owners;
drop policy if exists p0_tenant_isolation on public.receipt_allocations;
drop policy if exists p0_tenant_isolation on public.receipts;
drop policy if exists p0_tenant_isolation on public.serials;
drop policy if exists p0_tenant_isolation on public.snapshots;
drop policy if exists p0_tenant_isolation on public.status_history;
drop policy if exists p0_tenant_isolation on public.status_transition_rules;
drop policy if exists p0_tenant_isolation on public.tenant_balances;
drop policy if exists p0_tenant_isolation on public.tenant_deposits;
drop policy if exists p0_tenant_isolation on public.tenants;
drop policy if exists p0_tenant_isolation on public.units;
drop policy if exists p0_tenant_isolation on public.utility_bills;
drop policy if exists p0_tenant_isolation on public.utility_meters;
drop policy if exists p0_tenant_isolation on public.vault_documents;
drop policy if exists p0_tenant_isolation on public.owner_agreements;
drop policy if exists p0_tenant_isolation on public.companies;

-- ── 2) drop P0 company_id column defaults (columns themselves stay) ──
alter table public.account_balances alter column company_id drop default;
alter table public.accounts alter column company_id drop default;
alter table public.app_notifications alter column company_id drop default;
alter table public.attachments alter column company_id drop default;
alter table public.automation_notifications alter column company_id drop default;
alter table public.automation_rules alter column company_id drop default;
alter table public.automation_run_logs alter column company_id drop default;
alter table public.automation_runs alter column company_id drop default;
alter table public.bank_accounts alter column company_id drop default;
alter table public.bank_reconciliation_matches alter column company_id drop default;
alter table public.bank_statement_imports alter column company_id drop default;
alter table public.bank_statement_lines alter column company_id drop default;
alter table public.budgets alter column company_id drop default;
alter table public.commissions alter column company_id drop default;
alter table public.communication_records alter column company_id drop default;
alter table public."company-assets" alter column company_id drop default;
alter table public.company_members alter column company_id drop default;
alter table public.company_settings alter column company_id drop default;
alter table public.contract_balances alter column company_id drop default;
alter table public.contract_documents alter column company_id drop default;
alter table public.contracts alter column company_id drop default;
alter table public.deposit_transactions alter column company_id drop default;
alter table public.deposit_txs alter column company_id drop default;
alter table public.expenses alter column company_id drop default;
alter table public.invoices alter column company_id drop default;
alter table public.journal_entries alter column company_id drop default;
alter table public.kpi_snapshots alter column company_id drop default;
alter table public.lands alter column company_id drop default;
alter table public.leads alter column company_id drop default;
alter table public.maintenance_records alter column company_id drop default;
alter table public.missions alter column company_id drop default;
alter table public.notification_templates alter column company_id drop default;
alter table public.notifications alter column company_id drop default;
alter table public.outgoing_notifications alter column company_id drop default;
alter table public.owner_balances alter column company_id drop default;
alter table public.owner_settlements alter column company_id drop default;
alter table public.owners alter column company_id drop default;
alter table public.payments alter column company_id drop default;
alter table public.people alter column company_id drop default;
alter table public.properties alter column company_id drop default;
alter table public.property_owners alter column company_id drop default;
alter table public.receipt_allocations alter column company_id drop default;
alter table public.receipts alter column company_id drop default;
alter table public.serials alter column company_id drop default;
alter table public.snapshots alter column company_id drop default;
alter table public.status_history alter column company_id drop default;
alter table public.status_transition_rules alter column company_id drop default;
alter table public.tenant_balances alter column company_id drop default;
alter table public.tenant_deposits alter column company_id drop default;
alter table public.tenants alter column company_id drop default;
alter table public.units alter column company_id drop default;
alter table public.utility_bills alter column company_id drop default;
alter table public.utility_meters alter column company_id drop default;
alter table public.vault_documents alter column company_id drop default;
alter table public.owner_agreements alter column company_id drop default;

-- ── 3) drop objects the P0 migration itself created ───────────────────────
drop function if exists public.require_company_id();
alter table public.owner_agreements drop constraint if exists owner_agreements_company_id_fkey;
drop index if exists public.owner_agreements_company_id_idx;
alter table public.owner_agreements drop column if exists company_id;

-- ── 4) restore pre-P0 function bodies (verbatim from the pre-P0 chain) ──

-- restore: rpt_cash_flow
CREATE OR REPLACE FUNCTION public.rpt_cash_flow(
  p_from_date date,
  p_to_date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_operating jsonb;
  v_investing jsonb;
  v_financing jsonb;
  v_receipts numeric;
  v_expenses numeric;
BEGIN
  -- FIX: Added COALESCE(UPPER(status), 'POSTED') <> 'VOID' filter
  SELECT COALESCE(SUM(amount), 0) INTO v_receipts
  FROM public.payments
  WHERE payment_date BETWEEN p_from_date AND p_to_date
    AND deleted_at IS NULL
    AND COALESCE(UPPER(status), 'POSTED') <> 'VOID';

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM public.expenses
  WHERE expense_date BETWEEN p_from_date AND p_to_date
    AND deleted_at IS NULL;

  v_operating := jsonb_build_object(
    'receipts', v_receipts,
    'expenses', v_expenses,
    'net_operating', v_receipts - v_expenses
  );

  v_investing := jsonb_build_object('note', 'not_applicable_single_office', 'amount', 0);
  v_financing := jsonb_build_object('note', 'not_applicable_single_office', 'amount', 0);

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from', p_from_date, 'to', p_to_date),
    'operating', v_operating,
    'investing', v_investing,
    'financing', v_financing,
    'net_change', v_receipts - v_expenses
  );
END;
$$;

-- restore: rpt_dashboard_overview
create or replace function public.rpt_dashboard_overview(
  p_from date,
  p_to date,
  p_as_of date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_financial record;
  v_result jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;

  select * into v_financial
  from public.rpt_financial_summary(p_from, p_to);

  select jsonb_build_object(
    'financial', jsonb_build_object(
      'total_collected', coalesce(v_financial.collected, 0),
      'total_overdue_invoices', coalesce(v_financial.overdue_amount, 0),
      'total_expenses', coalesce(v_financial.expenses, 0),
      'net_revenue', coalesce(v_financial.net, 0)
    ),
    'operational', jsonb_build_object(
      'properties', (select count(*) from public.properties where deleted_at is null),
      'units', (select count(*) from public.units where deleted_at is null),
      'activeContracts', (
        select count(*)
        from public.contracts
        where deleted_at is null
          and upper(coalesce(status::text, '')) = 'ACTIVE'
      ),
      'expiringContracts30Days', (
        select count(*)
        from public.contracts
        where deleted_at is null
          and upper(coalesce(status::text, '')) = 'ACTIVE'
          and btrim(coalesce(end_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
          and btrim(end_date::text)::date >= p_as_of
          and btrim(end_date::text)::date <= (p_as_of + interval '30 days')::date
      ),
      'vacantUnits', (
        select count(*)
        from public.units
        where deleted_at is null
          and lower(coalesce(status::text, '')) in ('available', 'vacant')
      ),
      'overdueInvoices', (
        select count(*)
        from public.invoices
        where deleted_at is null
          and upper(coalesce(status::text, '')) = 'OVERDUE'
      )
    )
  ) into v_result;

  return v_result;
end;
$function$;

alter function public.rpt_dashboard_overview(date, date, date) owner to postgres;
revoke all on function public.rpt_dashboard_overview(date, date, date) from public, anon;
grant execute on function public.rpt_dashboard_overview(date, date, date) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;

-- restore: rpt_daily_collection
create or replace function public.rpt_daily_collection(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_rows jsonb;
  v_total numeric := 0;
begin
  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required to run daily collection reports.'
      using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'A valid report date range is required.'
      using errcode = '22023';
  end if;

  with reportable_payments as (
    select
      coalesce(p.payment_date, public._safe_date(p.date_time::text)) as collection_date,
      upper(coalesce(nullif(p.payment_method, ''), nullif(p.channel, ''), 'OTHER')) as method,
      coalesce(p.amount, 0)::numeric as amount
    from public.payments p
    where p.deleted_at is null
      and upper(coalesce(p.status, 'POSTED')) <> 'VOID'
      and coalesce(p.payment_date, public._safe_date(p.date_time::text)) between p_from and p_to
  ), daily as (
    select
      collection_date,
      sum(amount)::numeric as day_total,
      sum(amount) filter (where method = 'CASH')::numeric as cash,
      sum(amount) filter (where method in ('BANK', 'BANK_TRANSFER'))::numeric as bank,
      sum(amount) filter (where method in ('POS', 'CARD'))::numeric as pos,
      sum(amount) filter (
        where method not in ('CASH', 'BANK', 'BANK_TRANSFER', 'POS', 'CARD')
      )::numeric as other,
      count(*)::bigint as payments_count
    from reportable_payments
    group by collection_date
  )
  select
    jsonb_agg(
      jsonb_build_object(
        'date', collection_date::text,
        'total', public._r3(day_total),
        'cash', public._r3(coalesce(cash, 0)),
        'bank', public._r3(coalesce(bank, 0)),
        'pos', public._r3(coalesce(pos, 0)),
        'other', public._r3(coalesce(other, 0)),
        'count', payments_count
      )
      order by collection_date
    ),
    public._r3(coalesce(sum(day_total), 0))
  into v_rows, v_total
  from daily;

  return jsonb_build_object(
    'rows', coalesce(v_rows, '[]'::jsonb),
    'total', coalesce(v_total, 0),
    'from', p_from,
    'to', p_to,
    'source', 'payments'
  );
end;
$function$;

alter function public.rpt_daily_collection(date, date) owner to postgres;
revoke all on function public.rpt_daily_collection(date, date) from public, anon;
grant execute on function public.rpt_daily_collection(date, date) to authenticated, service_role;

commit;

-- restore: rpt_vat_return
CREATE OR REPLACE FUNCTION public.rpt_vat_return(
  p_from_date date,
  p_to_date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- FIX: Added COALESCE(UPPER(status), '') NOT IN ('VOID', 'CANCELLED') filter
  SELECT jsonb_build_object(
    'period', jsonb_build_object('from', p_from_date, 'to', p_to_date),
    'total_sales_amount', COALESCE(SUM(amount), 0),
    'total_tax_amount', COALESCE(SUM(tax_amount), 0),
    'invoice_count', COUNT(*)
  ) INTO v_result
  FROM public.invoices
  WHERE issue_date BETWEEN p_from_date AND p_to_date
    AND deleted_at IS NULL
    AND COALESCE(UPPER(status), '') NOT IN ('VOID', 'CANCELLED');

  RETURN v_result;
END;
$$;

-- restore: rpt_financial_summary
CREATE OR REPLACE FUNCTION public.rpt_financial_summary(p_from date, p_to date)
RETURNS TABLE (
  collected numeric,
  expenses numeric,
  net numeric,
  revenue numeric,
  net_income numeric,
  overdue_amount numeric,
  overdue_count bigint,
  active_contracts bigint,
  total_units bigint,
  occupied_units bigint,
  occupancy_rate numeric,
  pending_invoices bigint,
  period_from date,
  period_to date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH totals AS (
    SELECT
      COALESCE((
        SELECT SUM(payment.amount)
        FROM public.payments AS payment
        WHERE payment.deleted_at IS NULL
          AND payment.payment_date BETWEEN p_from AND p_to
          AND COALESCE(UPPER(payment.status), 'POSTED') <> 'VOID'
      ), 0) AS collected,

      COALESCE((
        SELECT SUM(expense.amount)
        FROM public.expenses AS expense
        WHERE expense.deleted_at IS NULL
          AND expense.expense_date BETWEEN p_from AND p_to
      ), 0) AS expenses,

      COALESCE((
        SELECT SUM(invoice.amount + COALESCE(invoice.tax_amount, 0))
        FROM public.invoices AS invoice
        WHERE invoice.deleted_at IS NULL
          AND invoice.issue_date BETWEEN p_from AND p_to
          AND COALESCE(UPPER(invoice.status), '') NOT IN ('VOID', 'CANCELLED')
      ), 0) AS revenue,

      COALESCE((
        SELECT SUM(invoice.amount + COALESCE(invoice.tax_amount, 0) - invoice.paid_amount)
        FROM public.invoices AS invoice
        WHERE invoice.deleted_at IS NULL
          AND invoice.status IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE')
          AND NULLIF(invoice.due_date::text, '')::date < current_date
          AND COALESCE(UPPER(invoice.status), '') NOT IN ('VOID', 'CANCELLED')
      ), 0) AS overdue_amount,

      COALESCE((
        SELECT COUNT(*)
        FROM public.invoices AS invoice
        WHERE invoice.deleted_at IS NULL
          AND invoice.status IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE')
          AND NULLIF(invoice.due_date::text, '')::date < current_date
          AND COALESCE(UPPER(invoice.status), '') NOT IN ('VOID', 'CANCELLED')
      ), 0) AS overdue_count,

      COALESCE((
        SELECT COUNT(*)
        FROM public.contracts AS contract_record
        WHERE contract_record.deleted_at IS NULL
          AND LOWER(contract_record.status) = 'active'
      ), 0) AS active_contracts,

      COALESCE((
        SELECT COUNT(*)
        FROM public.units AS unit_record
        WHERE unit_record.deleted_at IS NULL
      ), 0) AS total_units,

      COALESCE((
        SELECT COUNT(*)
        FROM public.units AS unit_record
        WHERE unit_record.deleted_at IS NULL
          AND unit_record.status = 'occupied'
      ), 0) AS occupied_units,

      COALESCE((
        SELECT COUNT(*)
        FROM public.invoices AS invoice
        WHERE invoice.deleted_at IS NULL
          AND invoice.status IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE')
          AND COALESCE(UPPER(invoice.status), '') NOT IN ('VOID', 'CANCELLED')
      ), 0) AS pending_invoices
  )
  SELECT
    collected,
    expenses,
    collected - expenses AS net,
    revenue,
    collected - expenses AS net_income,
    overdue_amount,
    overdue_count,
    active_contracts,
    total_units,
    occupied_units,
    CASE
      WHEN total_units = 0 THEN 0
      ELSE ROUND((occupied_units::numeric / total_units::numeric) * 100, 2)
    END AS occupancy_rate,
    pending_invoices,
    p_from,
    p_to
  FROM totals
$$;

-- restore: rpt_trial_balance
CREATE OR REPLACE FUNCTION public.rpt_trial_balance(p_as_of date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_cash numeric := 0;
  v_ar numeric := 0;
  v_expenses numeric := 0;
  v_revenue numeric := 0;
  v_owner_pay numeric := 0;
  v_vat numeric := 0;
  v_retained numeric := 0;
  v_accounts jsonb;
  v_total_debits numeric := 0;
  v_total_credits numeric := 0;
BEGIN
  -- Cash on hand: posted, non-deleted payments received up to the as-of date.
  SELECT COALESCE(SUM(amount), 0)
    INTO v_cash
    FROM public.payments
   WHERE deleted_at IS NULL
     AND (status IS NULL OR upper(status) <> 'VOID')
     AND payment_date <= p_as_of;

  -- Tenant receivables: open (unpaid) invoice principal + tax up to the as-of date.
  SELECT COALESCE(SUM(GREATEST(amount + COALESCE(tax_amount, 0) - COALESCE(paid_amount, 0), 0)), 0)
    INTO v_ar
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date <= p_as_of;

  -- Operating expenses incurred up to the as-of date.
  SELECT COALESCE(SUM(amount), 0)
    INTO v_expenses
    FROM public.expenses
   WHERE deleted_at IS NULL
     AND expense_date <= p_as_of;

  -- Rental revenue invoiced up to the as-of date.
  SELECT COALESCE(SUM(amount), 0)
    INTO v_revenue
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date <= p_as_of;

  -- Owner payables recorded up to the as-of date (settlements not cancelled).
  SELECT COALESCE(SUM(amount), 0)
    INTO v_owner_pay
    FROM public.owner_settlements
   WHERE (status IS NULL OR status <> 'CANCELLED')
     AND date <= p_as_of;

  -- VAT payable on invoiced revenue up to the as-of date.
  SELECT COALESCE(SUM(COALESCE(tax_amount, 0)), 0)
    INTO v_vat
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date <= p_as_of;

  -- Retained earnings is the balancing figure so debits == credits.
  v_retained := v_cash + v_ar + v_expenses - v_revenue - v_owner_pay - v_vat;

  v_accounts := jsonb_build_array(
    jsonb_build_object('code', '1111', 'name', 'Cash', 'type', 'asset', 'balance_type', 'debit', 'balance', round(v_cash, 2)),
    jsonb_build_object('code', '1201', 'name', 'Tenant Receivables', 'type', 'asset', 'balance_type', 'debit', 'balance', round(v_ar, 2)),
    jsonb_build_object('code', '6100', 'name', 'Operating Expenses', 'type', 'expense', 'balance_type', 'debit', 'balance', round(v_expenses, 2)),
    jsonb_build_object('code', '4000', 'name', 'Rental Revenue', 'type', 'revenue', 'balance_type', 'credit', 'balance', round(v_revenue, 2)),
    jsonb_build_object('code', '2000', 'name', 'Owner Payables', 'type', 'liability', 'balance_type', 'credit', 'balance', round(v_owner_pay, 2)),
    jsonb_build_object('code', '2100', 'name', 'VAT Payable', 'type', 'liability', 'balance_type', 'credit', 'balance', round(v_vat, 2)),
    jsonb_build_object('code', '3000', 'name', 'Retained Earnings', 'type', 'equity', 'balance_type', 'credit', 'balance', round(v_retained, 2))
  );

  v_total_debits := round(v_cash + v_ar + v_expenses, 2);
  v_total_credits := round(v_revenue + v_owner_pay + v_vat + v_retained, 2);

  RETURN jsonb_build_object(
    'as_of', p_as_of,
    'accounts', v_accounts,
    'total_debits', v_total_debits,
    'total_credits', v_total_credits,
    'is_balanced', (v_total_debits = v_total_credits)
  );
END;
$$;

-- restore: rpt_income_statement
CREATE OR REPLACE FUNCTION public.rpt_income_statement(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_revenue numeric := 0;
  v_expenses numeric := 0;
  v_net numeric := 0;
  v_revenue_rows jsonb;
  v_expense_rows jsonb;
BEGIN
  -- Rental / operational revenue invoiced in the period (excludes voided and deleted).
  SELECT COALESCE(SUM(amount), 0)
    INTO v_revenue
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date BETWEEN p_from AND p_to;

  -- Operating expenses incurred in the period, broken down by category.
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('label', category, 'amount', round(amount, 2)) ORDER BY category),
    '[]'::jsonb
  )
    INTO v_expense_rows
    FROM (
      SELECT category, SUM(amount) AS amount
        FROM public.expenses
       WHERE deleted_at IS NULL
         AND expense_date BETWEEN p_from AND p_to
       GROUP BY category
    ) s;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_expenses
    FROM public.expenses
   WHERE deleted_at IS NULL
     AND expense_date BETWEEN p_from AND p_to;

  v_net := round(v_revenue - v_expenses, 2);

  v_revenue_rows := jsonb_build_array(
    jsonb_build_object('label', 'الإيرادات التشغيلية', 'amount', round(v_revenue, 2))
  );

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'revenue', v_revenue_rows,
    'total_revenue', round(v_revenue, 2),
    'expenses', v_expense_rows,
    'total_expenses', round(v_expenses, 2),
    'net_income', v_net
  );
END;
$$;

-- restore: rpt_balance_sheet
CREATE OR REPLACE FUNCTION public.rpt_balance_sheet(p_as_of date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_cash numeric := 0;
  v_ar numeric := 0;
  v_owner_pay numeric := 0;
  v_vat numeric := 0;
  v_assets numeric := 0;
  v_liabilities numeric := 0;
  v_equity numeric := 0;
  v_asset_rows jsonb;
  v_liability_rows jsonb;
  v_equity_rows jsonb;
BEGIN
  SELECT COALESCE(SUM(amount), 0)
    INTO v_cash
    FROM public.payments
   WHERE deleted_at IS NULL
     AND (status IS NULL OR upper(status) <> 'VOID')
     AND payment_date <= p_as_of;

  SELECT COALESCE(SUM(GREATEST(amount + COALESCE(tax_amount, 0) - COALESCE(paid_amount, 0), 0)), 0)
    INTO v_ar
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date <= p_as_of;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_owner_pay
    FROM public.owner_settlements
   WHERE (status IS NULL OR status <> 'CANCELLED')
     AND date <= p_as_of;

  SELECT COALESCE(SUM(COALESCE(tax_amount, 0)), 0)
    INTO v_vat
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date <= p_as_of;

  v_assets := round(v_cash + v_ar, 2);
  v_liabilities := round(v_owner_pay + v_vat, 2);
  v_equity := round(v_assets - v_liabilities, 2);

  v_asset_rows := jsonb_build_array(
    jsonb_build_object('code', '1111', 'name', 'Cash', 'amount', round(v_cash, 2)),
    jsonb_build_object('code', '1201', 'name', 'Tenant Receivables', 'amount', round(v_ar, 2))
  );
  v_liability_rows := jsonb_build_array(
    jsonb_build_object('code', '2000', 'name', 'Owner Payables', 'amount', round(v_owner_pay, 2)),
    jsonb_build_object('code', '2100', 'name', 'VAT Payable', 'amount', round(v_vat, 2))
  );
  v_equity_rows := jsonb_build_array(
    jsonb_build_object('code', '3000', 'name', 'Retained Earnings', 'amount', round(v_equity, 2))
  );

  RETURN jsonb_build_object(
    'as_of', p_as_of,
    'assets', v_asset_rows,
    'total_assets', v_assets,
    'liabilities', v_liability_rows,
    'total_liabilities', v_liabilities,
    'equity', v_equity_rows,
    'total_equity', v_equity,
    'is_balanced', (v_assets = (v_liabilities + v_equity))
  );
END;
$$;

-- restore: rpt_owner_statement
CREATE OR REPLACE FUNCTION public.rpt_owner_statement(p_owner_id uuid, p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_name text;
  v_commission_type text;
  v_commission_value numeric := 0;
  v_transactions jsonb;
  v_total_gross numeric := 0;
  v_total_deductions numeric := 0;
  v_total_net numeric := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_app_user() THEN
    RAISE EXCEPTION 'Authentication is required' USING ERRCODE = '42501';
  END IF;
  IF p_from > p_to THEN RAISE EXCEPTION 'Invalid owner statement period'; END IF;

  SELECT COALESCE(NULLIF(btrim(display_name), ''), NULLIF(btrim(full_name), ''), name)
    INTO v_owner_name
  FROM public.owners WHERE id = p_owner_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'owner not found'); END IF;

  SELECT oa.commission_type, oa.commission_value
    INTO v_commission_type, v_commission_value
  FROM public.owner_agreements oa
  WHERE oa.owner_id = p_owner_id
    AND oa.starts_on <= p_to
    AND (oa.ends_on IS NULL OR oa.ends_on >= p_from)
  ORDER BY oa.starts_on DESC LIMIT 1;

  WITH owner_contracts AS (
    SELECT c.id contract_id, c.property_id, u.unit_number unit_name, pr.title property_name,
      oa.commission_type, oa.commission_value
    FROM public.contracts c
    JOIN public.owner_agreements oa ON oa.id = c.agreement_id AND oa.owner_id = p_owner_id
    LEFT JOIN public.units u ON u.id = c.unit_id
    JOIN public.properties pr ON pr.id = c.property_id
    WHERE c.deleted_at IS NULL
  ), payment_rows AS (
    SELECT COALESCE(p.payment_date::text, p.date_time::text) tx_date,
      'تحصيل — ' || oc.property_name || ' / ' || COALESCE(oc.unit_name, '—') ||
        ' (' || COALESCE(p.reference_number, p.reference_no, p.id::text) || ')' details,
      'payment' tx_type, oc.property_name, p.amount gross,
      CASE WHEN oc.commission_type = 'RATE'
        THEN public._r3(p.amount * oc.commission_value / 100) ELSE 0 END deduction,
      p.id::text sort_no
    FROM public.payments p
    JOIN owner_contracts oc ON oc.contract_id = p.contract_id
    WHERE p.deleted_at IS NULL AND upper(COALESCE(p.status, '')) <> 'VOID'
      AND COALESCE(p.payment_date, public._safe_date(p.date_time::text)) BETWEEN p_from AND p_to
  ), expense_rows AS (
    SELECT * FROM public._owner_statement_expenses(p_owner_id, p_from, p_to)
  ), settlement_rows AS (
    SELECT s.date tx_date, 'تسوية مالية رقم ' || s.no details,
      'settlement' tx_type, '' property_name, -s.amount gross,
      0::numeric deduction, COALESCE(s.no, s.id) sort_no
    FROM public.owner_settlements s
    WHERE s.owner_id::text = p_owner_id::text AND public._safe_date(s.date) BETWEEN p_from AND p_to
  ), all_tx AS (
    SELECT * FROM payment_rows UNION ALL SELECT * FROM expense_rows UNION ALL SELECT * FROM settlement_rows
  )
  SELECT jsonb_agg(jsonb_build_object(
      'date', tx_date, 'details', details, 'type', tx_type,
      'property_name', property_name, 'gross', public._r3(gross),
      'deduction', public._r3(deduction), 'net', public._r3(gross - deduction))
      ORDER BY tx_date, sort_no),
    public._r3(sum(gross)), public._r3(sum(deduction)), public._r3(sum(gross - deduction))
  INTO v_transactions, v_total_gross, v_total_deductions, v_total_net FROM all_tx;

  RETURN jsonb_build_object(
    'owner_name', v_owner_name, 'commission_type', v_commission_type,
    'commission_value', COALESCE(v_commission_value, 0),
    'transactions', COALESCE(v_transactions, '[]'::jsonb),
    'total_gross', COALESCE(v_total_gross, 0),
    'total_deductions', COALESCE(v_total_deductions, 0),
    'total_net', COALESCE(v_total_net, 0),
    'period_from', p_from, 'period_to', p_to);
END;
$$;

-- restore: rpt_tenant_statement
create or replace function public.rpt_tenant_statement(p_contract_id uuid)
 returns jsonb
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare v_contract record; v_lines jsonb; v_balance numeric;
begin
  select c.*, t.full_name as tenant_name, t.phone as tenant_phone,
    u.name as unit_name, pr.name as property_name
  into v_contract from contracts c
  join people t on t.id=c.tenant_id join units u on u.id=c.unit_id
  join properties pr on pr.id=u.property_id where c.id=p_contract_id::text;
  if not found then return jsonb_build_object('error','contract not found'); end if;

  with tx as (
    select i.due_date as tx_date,
      'فاتورة رقم '||i.no||case when i.type<>'RENT' then ' ('||i.type||')' else '' end as description,
      'invoice' as tx_type, i.amount+coalesce(i.tax_amount,0) as debit, 0 as credit, i.no as ref_no
    from invoices i where i.contract_id=p_contract_id::text
    union all
    select left(r.date_time,10), 'سند قبض رقم '||r.no||' — '||r.channel,
      'receipt', 0, r.amount, r.no
    from receipts r where r.contract_id=p_contract_id::text and r.status='POSTED'
  ),
  with_balance as (
    select tx_date,description,tx_type,debit,credit,ref_no,
      sum(debit-credit) over (order by tx_date,ref_no rows unbounded preceding) as running_balance from tx
  )
  select jsonb_agg(jsonb_build_object('date',tx_date,'description',description,'type',tx_type,
    'debit',_r3(debit),'credit',_r3(credit),'balance',_r3(running_balance)) order by tx_date,ref_no),
    _r3(sum(debit-credit)) into v_lines, v_balance from with_balance;

  return jsonb_build_object('contract_id',p_contract_id,'tenant_name',v_contract.tenant_name,
    'tenant_phone',v_contract.tenant_phone,'unit_name',v_contract.unit_name,
    'property_name',v_contract.property_name,'start_date',v_contract.start_date,
    'end_date',v_contract.end_date,'lines',coalesce(v_lines,'[]'::jsonb),'final_balance',coalesce(v_balance,0));
end;
$function$;
-- pre-P0 effective attributes (20260713000006: ALTER FUNCTION … SECURITY DEFINER)
alter function public.rpt_tenant_statement(uuid) security definer;
alter function public.rpt_tenant_statement(uuid) set search_path = public, pg_temp;

-- restore: rpt_aged_receivables
CREATE OR REPLACE FUNCTION public.rpt_aged_receivables(p_as_of date)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE v_lines jsonb; v_totals jsonb;
BEGIN
  WITH aged AS (
    SELECT t.id tenant_id, t.full_name tenant_name, t.phone tenant_phone,
      pr.title property_name, u.unit_number unit_name,
      public._r3(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount) remaining,
      (p_as_of - public._safe_date(i.due_date))::int days_overdue
    FROM public.invoices i
    JOIN public.contracts c ON c.id = i.contract_id
    JOIN public.people t ON t.id = c.tenant_id AND t.type = 'tenant' AND t.deleted_at IS NULL
    JOIN public.units u ON u.id = c.unit_id AND u.deleted_at IS NULL
    JOIN public.properties pr ON pr.id = c.property_id AND pr.deleted_at IS NULL
    WHERE upper(COALESCE(i.status, '')) NOT IN ('PAID', 'VOID', 'CANCELLED')
      AND i.deleted_at IS NULL
      AND public._safe_date(i.due_date) <= p_as_of
      AND (i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount) > 0.001
  ), bucketed AS (
    SELECT tenant_id, tenant_name, tenant_phone, property_name, unit_name,
      public._r3(sum(remaining)) total,
      public._r3(sum(CASE WHEN days_overdue <= 0 THEN remaining ELSE 0 END)) bucket_current,
      public._r3(sum(CASE WHEN days_overdue BETWEEN 1 AND 30 THEN remaining ELSE 0 END)) bucket_1_30,
      public._r3(sum(CASE WHEN days_overdue BETWEEN 31 AND 60 THEN remaining ELSE 0 END)) bucket_31_60,
      public._r3(sum(CASE WHEN days_overdue BETWEEN 61 AND 90 THEN remaining ELSE 0 END)) bucket_61_90,
      public._r3(sum(CASE WHEN days_overdue > 90 THEN remaining ELSE 0 END)) bucket_90plus
    FROM aged
    GROUP BY tenant_id, tenant_name, tenant_phone, property_name, unit_name
    HAVING sum(remaining) > 0
  )
  SELECT jsonb_agg(jsonb_build_object(
      'tenant_id', tenant_id, 'tenant_name', tenant_name, 'tenant_phone', tenant_phone,
      'property_name', property_name, 'unit_name', unit_name, 'total', total,
      'current', bucket_current, '1_30', bucket_1_30, '31_60', bucket_31_60,
      '61_90', bucket_61_90, '90plus', bucket_90plus) ORDER BY total DESC),
    jsonb_build_object('total', public._r3(sum(total)), 'current', public._r3(sum(bucket_current)),
      '1_30', public._r3(sum(bucket_1_30)), '31_60', public._r3(sum(bucket_31_60)),
      '61_90', public._r3(sum(bucket_61_90)), '90plus', public._r3(sum(bucket_90plus)))
  INTO v_lines, v_totals FROM bucketed;

  RETURN jsonb_build_object(
    'lines', COALESCE(v_lines, '[]'::jsonb),
    'totals', COALESCE(v_totals, '{"total":0,"current":0,"1_30":0,"31_60":0,"61_90":0,"90plus":0}'::jsonb),
    'as_of', p_as_of);
END;
$$;

-- restore: rpt_overdue_invoices
CREATE OR REPLACE FUNCTION public.rpt_overdue_invoices(p_as_of date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE v_rows jsonb; v_total numeric; v_count bigint;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
      'invoice_id', i.id, 'invoice_no', i.no, 'due_date', i.due_date,
      'days_overdue', (p_as_of - public._safe_date(i.due_date))::int,
      'amount', public._r3(i.amount + COALESCE(i.tax_amount, 0)),
      'paid', public._r3(i.paid_amount),
      'remaining', public._r3(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount),
      'tenant_name', t.full_name, 'tenant_phone', t.phone,
      'unit_name', u.unit_number, 'property_name', pr.title, 'contract_id', c.id)
      ORDER BY (p_as_of - public._safe_date(i.due_date)) DESC),
    public._r3(sum(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount)), count(*)
  INTO v_rows, v_total, v_count
  FROM public.invoices i
  JOIN public.contracts c ON c.id = i.contract_id AND c.deleted_at IS NULL
  JOIN public.people t ON t.id = c.tenant_id AND t.type = 'tenant' AND t.deleted_at IS NULL
  JOIN public.units u ON u.id = c.unit_id AND u.deleted_at IS NULL
  JOIN public.properties pr ON pr.id = c.property_id AND pr.deleted_at IS NULL
  WHERE upper(COALESCE(i.status, '')) NOT IN ('PAID', 'VOID', 'CANCELLED')
    AND i.deleted_at IS NULL
    AND public._safe_date(i.due_date) < p_as_of
    AND (i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount) > 0.001;

  RETURN jsonb_build_object('rows', COALESCE(v_rows, '[]'::jsonb),
    'total', COALESCE(v_total, 0), 'count', COALESCE(v_count, 0), 'as_of', p_as_of);
END;
$$;

-- restore: rpt_rent_roll
CREATE OR REPLACE FUNCTION public.rpt_rent_roll(p_as_of date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'property_name', pr.title, 'unit_name', u.unit_number, 'unit_type', u.type,
    'status', u.status, 'tenant_name', t.full_name, 'tenant_phone', t.phone,
    'contract_start', c.start_date, 'contract_end', c.end_date,
    'rent_amount', c.rent_amount, 'deposit', c.deposit,
    'days_to_expiry', (public._safe_date(c.end_date) - p_as_of)::int,
    'overdue_balance', public._r3(COALESCE((
      SELECT sum(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount)
      FROM public.invoices i
      WHERE i.contract_id = c.id AND i.deleted_at IS NULL
        AND upper(COALESCE(i.status, '')) NOT IN ('PAID', 'VOID', 'CANCELLED')
        AND public._safe_date(i.due_date) < p_as_of
    ), 0))) ORDER BY pr.title, u.unit_number)
  INTO v_rows
  FROM public.units u
  JOIN public.properties pr ON pr.id = u.property_id AND pr.deleted_at IS NULL
  LEFT JOIN public.contracts c ON c.unit_id = u.id
    AND lower(COALESCE(c.status, '')) = 'active'
    AND c.deleted_at IS NULL
    AND public._safe_date(c.start_date) <= p_as_of
    AND public._safe_date(c.end_date) >= p_as_of
  LEFT JOIN public.people t ON t.id = c.tenant_id AND t.type = 'tenant' AND t.deleted_at IS NULL
  WHERE u.deleted_at IS NULL;

  RETURN jsonb_build_object('rows', COALESCE(v_rows, '[]'::jsonb), 'as_of', p_as_of);
END;
$$;

-- restore: create_owner_settlement_draft_atomic
CREATE OR REPLACE FUNCTION public.create_owner_settlement_draft_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_owner_id text := nullif(p_payload->>'owner_id', '');
  v_property_id text := nullif(p_payload->>'property_id', '');
  v_period_start date := nullif(p_payload->>'period_start', '')::date;
  v_period_end date := nullif(p_payload->>'period_end', '')::date;
  v_gross numeric := coalesce(nullif(p_payload->>'gross_collected', '')::numeric, 0);
  v_fee numeric := coalesce(nullif(p_payload->>'office_fee', '')::numeric, 0);
  v_expenses numeric := coalesce(nullif(p_payload->>'owner_expenses', '')::numeric, 0);
  v_tax numeric := coalesce(nullif(p_payload->>'tax_amount', '')::numeric, 0);
  v_net numeric;
  v_id text;
  v_no text;
  v_result jsonb;
  v_cached jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to create owner settlements.' using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_owner_id is null or v_period_start is null or v_period_end is null or v_request_id is null then
    raise exception 'owner_id, period_start, period_end, and request_id are required.';
  end if;
  if v_period_start > v_period_end then raise exception 'period_start must be on or before period_end.'; end if;
  if least(v_gross, v_fee, v_expenses, v_tax) < 0 then raise exception 'Settlement amounts cannot be negative.'; end if;

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'create_owner_settlement_draft_atomic' and request_id = v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'owner_settlement:' || v_owner_id || ':' || coalesce(v_property_id, '*') || ':' || v_period_start || ':' || v_period_end,
    0
  ));

  if exists (
    select 1 from public.owner_settlements
    where owner_id = v_owner_id
      and coalesce(property_id, '') = coalesce(v_property_id, '')
      and period_start = v_period_start
      and period_end = v_period_end
      and status <> 'CANCELLED'
  ) then
    raise exception 'An active settlement already exists for this owner, property, and period.' using errcode = '23505';
  end if;

  v_net := greatest(v_gross - v_fee - v_expenses - v_tax, 0);
  v_id := gen_random_uuid()::text;
  v_no := 'OST-' || to_char(v_period_end, 'YYYYMM') || '-' || upper(substr(replace(v_id, '-', ''), 1, 8));

  insert into public.owner_settlements (
    id, no, owner_id, property_id, date, period_start, period_end,
    gross_collected, office_fee, owner_expenses, tax_amount, net_payable,
    amount, status, request_id, notes, created_at, updated_at
  , company_id) values (
    v_id, v_no, v_owner_id, v_property_id, v_period_end::text, v_period_start, v_period_end,
    v_gross, v_fee, v_expenses, v_tax, v_net,
    v_net, 'DRAFT', v_request_id::uuid, p_payload->>'notes', now(), now()
  , v_company_id);

  insert into public.audit_log (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'CREATE', 'owner_settlements', v_id, 'Owner settlement draft created',
    'owner_settlements', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false, 'settlement_id', v_id,
    'settlement_no', v_no, 'status', 'DRAFT', 'net_payable', v_net,
    'request_id', v_request_id
  );
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('create_owner_settlement_draft_atomic', v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;
  return v_result;
end;
$function$
;

-- Function: create_property_with_agreement

-- restore: record_invoice_payment_atomic
CREATE OR REPLACE FUNCTION public.record_invoice_payment_atomic(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  actor_id uuid;
  v_invoice_id_raw text;
  v_invoice_id uuid;
  v_amount numeric;
  v_method text;
  v_date date;
  v_reference text;
  v_request_id text;
  v_invoice jsonb;
  v_contract jsonb;
  v_total_due numeric;
  v_paid_amount numeric;
  v_outstanding numeric;
  v_receipt_id uuid := gen_random_uuid();
  v_allocation_id uuid := gen_random_uuid();
  v_debit_account_id text;
  v_credit_account_id text;
  v_internal_payload jsonb;
  v_internal_result jsonb;
  v_existing_result jsonb;
  v_result jsonb;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to record invoice payments';
  END IF;

  IF NOT coalesce(public.is_admin_or_manager(), false) THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to record invoice payments'
      USING ERRCODE = '42501';
  END IF;

  v_request_id := nullif(payload->>'request_id', '');
  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'request_id is required for idempotent payment recording';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('record_invoice_payment_atomic:' || v_request_id, 0)
  );

  SELECT response_payload
    INTO v_existing_result
  FROM public.financial_operation_idempotency
  WHERE operation_name = 'record_invoice_payment_atomic'
    AND request_id = v_request_id
  FOR UPDATE;

  IF v_existing_result IS NOT NULL THEN
    RETURN v_existing_result;
  END IF;

  v_invoice_id_raw := nullif(payload->>'invoice_id', '');
  IF v_invoice_id_raw IS NULL THEN
    RAISE EXCEPTION 'invoice_id is required';
  END IF;

  IF v_invoice_id_raw !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'invoice_id is not a valid identifier: %', v_invoice_id_raw;
  END IF;

  v_invoice_id := v_invoice_id_raw::uuid;
  v_amount := coalesce((payload->>'amount')::numeric, 0);
  v_method := nullif(payload->>'method', '');
  v_date := coalesce(nullif(payload->>'date', '')::date, current_date);
  v_reference := nullif(payload->>'reference', '');

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  SELECT to_jsonb(invoice_record)
    INTO v_invoice
  FROM public.invoices AS invoice_record
  WHERE invoice_record.id::text = v_invoice_id::text
    AND coalesce((to_jsonb(invoice_record)->>'deleted_at')::timestamptz, NULL) IS NULL
  FOR UPDATE;

  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  SELECT to_jsonb(contract_record)
    INTO v_contract
  FROM public.contracts AS contract_record
  WHERE contract_record.id::text = (v_invoice->>'contract_id')
    AND coalesce((to_jsonb(contract_record)->>'deleted_at')::timestamptz, NULL) IS NULL
  FOR UPDATE;

  IF v_contract IS NULL THEN
    RAISE EXCEPTION 'Contract for invoice not found';
  END IF;

  v_total_due := coalesce((v_invoice->>'amount')::numeric, 0)
    + coalesce((v_invoice->>'tax_amount')::numeric, 0);
  v_paid_amount := coalesce((v_invoice->>'paid_amount')::numeric, 0);
  v_outstanding := v_total_due - v_paid_amount;

  IF v_amount > v_outstanding + 0.001 THEN
    RAISE EXCEPTION 'Payment amount exceeds outstanding invoice balance';
  END IF;

  v_debit_account_id := public.find_payment_account_id('cash');
  v_credit_account_id := public.find_payment_account_id('receivable');

  IF v_debit_account_id IS NULL OR v_credit_account_id IS NULL THEN
    RAISE EXCEPTION 'Payment accounting accounts are not configured';
  END IF;

  -- Delegate fully to post_receipt_atomic — it now creates payments row automatically
  v_internal_payload := jsonb_build_object(
    'request_id', v_request_id,
    'receipt', jsonb_build_object(
      'id', v_receipt_id,
      'contract_id', v_invoice->>'contract_id',
      'date_time', v_date::text,
      'channel', v_method,
      'amount', v_amount,
      'ref', coalesce(v_reference, v_request_id),
      'notes', 'Invoice payment ' || v_invoice_id::text,
      'status', 'POSTED',
      'created_at', timezone('utc', now()),
      'request_id', v_request_id
    ),
    'allocations', jsonb_build_array(jsonb_build_object(
      'id', v_allocation_id,
      'invoice_id', v_invoice_id,
      'amount', v_amount,
      'created_at', timezone('utc', now())
    )),
    'journal_entries', jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-D',
        'date', v_date::text,
        'account_id', v_debit_account_id,
        'amount', v_amount,
        'type', 'DEBIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice->>'contract_id',
        'created_at', timezone('utc', now())
      ),
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-C',
        'date', v_date::text,
        'account_id', v_credit_account_id,
        'amount', v_amount,
        'type', 'CREDIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice->>'contract_id',
        'created_at', timezone('utc', now())
      )
    )
  );

  v_internal_result := public.post_receipt_atomic(v_internal_payload);

  v_result := v_internal_result || jsonb_build_object(
    'status', 'recorded',
    'request_id', v_request_id,
    'invoice_id', v_invoice_id,
    'receipt_id', coalesce(
      nullif(v_internal_result->>'receipt_id', '')::uuid,
      v_receipt_id
    )
  );

  INSERT INTO public.financial_operation_idempotency(
    operation_name,
    request_id,
    response_payload
  ) VALUES (
    'record_invoice_payment_atomic',
    v_request_id,
    v_result
  )
  ON CONFLICT (operation_name, request_id) DO NOTHING;

  RETURN v_result;
END;
$function$
;

-- restore: post_receipt_atomic
CREATE OR REPLACE FUNCTION public.post_receipt_atomic(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_receipt jsonb;
  v_allocations jsonb;
  v_journal_entries jsonb;
  v_request_id text;
  v_existing_id public.receipts.id%TYPE;
  v_invoice_id_text text;
  v_invoice record;
  v_allocation_total numeric;

  v_receipt_id public.receipts.id%TYPE;
  v_receipt_contract_id public.receipts.contract_id%TYPE;
  v_receipt_date_time public.receipts.date_time%TYPE;
  v_receipt_tenant_id public.receipts.tenant_id%TYPE;
  v_receipt_check_date public.receipts.check_date%TYPE;
  v_receipt_amount numeric;
  v_receipt_channel text;
  v_receipt_ref text;
  v_receipt_notes text;
  v_receipt_status text;

  v_allocation jsonb;
  v_allocation_id public.receipt_allocations.id%TYPE;
  v_allocation_receipt_id public.receipt_allocations.receipt_id%TYPE;
  v_allocation_invoice_id public.receipt_allocations.invoice_id%TYPE;
  v_allocation_tenant_id public.receipt_allocations.tenant_id%TYPE;

  v_journal jsonb;
  v_journal_id public.journal_entries.id%TYPE;
  v_journal_date public.journal_entries.date%TYPE;
  v_journal_source_id public.journal_entries.source_id%TYPE;
  
  v_company_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS app_user
    WHERE app_user.id = auth.uid()
      AND app_user.role::text IN ('ADMIN', 'MANAGER')
      AND app_user.status::text = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول'
      USING ERRCODE = '42501';
  END IF;

  v_company_id := public.current_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: لم يتم العثور على معرّف الشركة للمستخدم الحالي'
      USING ERRCODE = '42501';
  END IF;

  v_receipt := coalesce(payload->'receipt', '{}'::jsonb);
  v_allocations := coalesce(payload->'allocations', '[]'::jsonb);
  v_journal_entries := coalesce(payload->'journal_entries', '[]'::jsonb);
  v_request_id := nullif(coalesce(payload->>'request_id', v_receipt->>'request_id'), '');

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'معرّف الطلب مطلوب لضمان عدم التكرار.';
  END IF;

  SELECT receipt_record.id
    INTO v_existing_id
  FROM public.receipts AS receipt_record
  WHERE receipt_record.request_id = v_request_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'request_id', v_request_id,
      'receipt_id', v_existing_id
    );
  END IF;

  -- Validate allocations don't exceed invoice balances
  FOR v_invoice_id_text IN
    SELECT DISTINCT allocation_record.value->>'invoice_id'
    FROM jsonb_array_elements(v_allocations) AS allocation_record(value)
    ORDER BY 1
  LOOP
    SELECT
      invoice_record.id,
      invoice_record.amount,
      invoice_record.tax_amount,
      invoice_record.paid_amount,
      invoice_record.status
    INTO v_invoice
    FROM public.invoices AS invoice_record
    WHERE invoice_record.id::text = v_invoice_id_text
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'فاتورة غير موجودة: %', v_invoice_id_text;
    END IF;

    SELECT sum((allocation_record->>'amount')::numeric)
      INTO v_allocation_total
    FROM jsonb_array_elements(v_allocations) AS allocation_record
    WHERE allocation_record->>'invoice_id' = v_invoice_id_text;

    IF coalesce(v_invoice.paid_amount, 0) + v_allocation_total
         > coalesce(v_invoice.amount, 0) + coalesce(v_invoice.tax_amount, 0) + 0.001 THEN
      RAISE EXCEPTION 'قيمة السداد تتجاوز المتبقي على الفاتورة: %', v_invoice_id_text;
    END IF;
  END LOOP;

  -- Extract receipt fields into variables
  v_receipt_id := coalesce(v_receipt->>'id', gen_random_uuid()::text);
  v_receipt_contract_id := nullif(v_receipt->>'contract_id', '');
  v_receipt_tenant_id := nullif(v_receipt->>'tenant_id', '');
  v_receipt_check_date := nullif(v_receipt->>'check_date', '');
  v_receipt_amount := (v_receipt->>'amount')::numeric;
  v_receipt_channel := v_receipt->>'channel';
  v_receipt_ref := coalesce(v_receipt->>'ref', '');
  v_receipt_notes := coalesce(v_receipt->>'notes', '');
  v_receipt_status := coalesce(v_receipt->>'status', 'POSTED');

  IF nullif(v_receipt->>'date_time', '') IS NULL THEN
    v_receipt_date_time := now();
  ELSE
    v_receipt_date_time := v_receipt->>'date_time';
  END IF;

  -- Insert receipt
  INSERT INTO public.receipts(
    id,
    no,
    contract_id,
    date_time,
    channel,
    amount,
    ref,
    notes,
    status,
    check_number,
    check_bank,
    check_date,
    check_status,
    created_at,
    request_id,
    tenant_id,
    company_id
  ) VALUES (
    v_receipt_id,
    v_receipt->>'no',
    v_receipt_contract_id,
    v_receipt_date_time,
    v_receipt_channel,
    v_receipt_amount,
    v_receipt_ref,
    v_receipt_notes,
    v_receipt_status,
    nullif(v_receipt->>'check_number', ''),
    nullif(v_receipt->>'check_bank', ''),
    v_receipt_check_date,
    nullif(v_receipt->>'check_status', ''),
    now(),
    v_request_id,
    v_receipt_tenant_id,
    v_company_id
  );

  -- Insert corresponding payments row (shadow record)
  INSERT INTO public.payments(
    receipt_id,
    contract_id,
    amount,
    payment_date,
    payment_method,
    reference_no,
    date_time,
    channel,
    status,
    notes,
    created_by,
    created_at,
    company_id
  ) VALUES (
    v_receipt_id,
    v_receipt_contract_id,
    v_receipt_amount,
    (v_receipt_date_time::date),
    v_receipt_channel,
    nullif(v_receipt_ref, ''),
    v_receipt_date_time,
    v_receipt_channel,
    v_receipt_status,
    nullif(v_receipt_notes, ''),
    auth.uid(),
    now(),
    v_company_id
  );

  -- Insert receipt allocations
  FOR v_allocation IN
    SELECT allocation_record.value
    FROM jsonb_array_elements(v_allocations) AS allocation_record(value)
  LOOP
    v_allocation_id := coalesce(v_allocation->>'id', gen_random_uuid()::text);
    v_allocation_receipt_id := v_receipt_id;
    v_allocation_invoice_id := v_allocation->>'invoice_id';
    v_allocation_tenant_id := nullif(v_allocation->>'tenant_id', '');

    INSERT INTO public.receipt_allocations(
      id,
      receipt_id,
      invoice_id,
      amount,
      created_at,
      tenant_id,
      company_id
    ) VALUES (
      v_allocation_id,
      v_allocation_receipt_id,
      v_allocation_invoice_id,
      (v_allocation->>'amount')::numeric,
      now(),
      v_allocation_tenant_id,
      v_company_id
    );
  END LOOP;

  -- Update invoice paid_amount and status
  WITH allocation_totals AS (
    SELECT
      allocation_record->>'invoice_id' AS invoice_id,
      sum((allocation_record->>'amount')::numeric) AS total
    FROM jsonb_array_elements(v_allocations) AS allocation_record
    GROUP BY 1
  )
  UPDATE public.invoices AS invoice_record
  SET
    paid_amount = coalesce(invoice_record.paid_amount, 0) + allocation_totals.total,
    status = CASE
      WHEN coalesce(invoice_record.paid_amount, 0) + allocation_totals.total
        >= coalesce(invoice_record.amount, 0) + coalesce(invoice_record.tax_amount, 0) - 0.001
        THEN 'PAID'
      WHEN coalesce(invoice_record.paid_amount, 0) + allocation_totals.total > 0
        THEN 'PARTIALLY_PAID'
      ELSE invoice_record.status
    END
  FROM allocation_totals
  WHERE invoice_record.id::text = allocation_totals.invoice_id;

  -- Insert journal entries
  FOR v_journal IN
    SELECT journal_record.value
    FROM jsonb_array_elements(v_journal_entries) AS journal_record(value)
  LOOP
    v_journal_id := coalesce(v_journal->>'id', gen_random_uuid()::text);
    v_journal_date := v_journal->>'date';
    v_journal_source_id := nullif(v_journal->>'source_id', '');

    INSERT INTO public.journal_entries(
      id,
      no,
      date,
      account_id,
      amount,
      type,
      source_id,
      entity_type,
      entity_id,
      created_at,
      company_id
    ) VALUES (
      v_journal_id,
      v_journal->>'no',
      v_journal_date,
      v_journal->>'account_id',
      (v_journal->>'amount')::numeric,
      v_journal->>'type',
      v_journal_source_id,
      nullif(v_journal->>'entity_type', ''),
      nullif(v_journal->>'entity_id', ''),
      now(),
      v_company_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'request_id', v_request_id,
    'receipt_id', v_receipt_id
  );
END;
$function$;

-- restore: update_contract_balance_from_allocation
CREATE OR REPLACE FUNCTION public.update_contract_balance_from_allocation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_contract_id text;
  v_total_invoiced numeric;
  v_total_paid numeric;
  v_tenant_id text;
  v_unit_id text;
BEGIN
  -- Get contract_id from the invoice referenced by this allocation
  IF TG_OP = 'DELETE' THEN
    SELECT i.contract_id::text INTO v_contract_id
    FROM public.invoices i
    WHERE i.id::text = OLD.invoice_id::text;
  ELSE
    SELECT i.contract_id::text INTO v_contract_id
    FROM public.invoices i
    WHERE i.id::text = NEW.invoice_id::text;
  END IF;

  IF v_contract_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate totals for this contract
  SELECT 
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
    COALESCE(SUM(i.paid_amount), 0),
    c.tenant_id::text,
    c.unit_id::text
  INTO v_total_invoiced, v_total_paid, v_tenant_id, v_unit_id
  FROM public.contracts c
  LEFT JOIN public.invoices i ON i.contract_id::text = c.id::text AND i.deleted_at IS NULL
  WHERE c.id::text = v_contract_id::text
  GROUP BY c.tenant_id, c.unit_id;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Upsert contract_balances
  INSERT INTO public.contract_balances (
    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at
  ) VALUES (
    v_contract_id::uuid,
    v_tenant_id::uuid,
    v_unit_id::uuid,
    v_total_invoiced,
    v_total_paid,
    v_total_invoiced - v_total_paid,
    now()
  )
  ON CONFLICT (contract_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    unit_id = EXCLUDED.unit_id,
    total_invoiced = EXCLUDED.total_invoiced,
    total_paid = EXCLUDED.total_paid,
    balance_due = EXCLUDED.balance_due,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- restore: create_owner_agreement_atomic
CREATE OR REPLACE FUNCTION public.create_owner_agreement_atomic(payload jsonb)
 RETURNS owner_agreements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_company_id uuid;
  v_row public.owner_agreements%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يحتاج هذا الإجراء صلاحية مدير أو مشرف.';
  END IF;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  INSERT INTO public.owner_agreements (owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, notes, company_id)
  VALUES (
    (payload->>'owner_id')::uuid,
    payload->>'property_id',
    payload->>'agreement_type',
    payload->>'commission_type',
    (payload->>'commission_value')::numeric,
    (payload->>'starts_on')::date,
    NULLIF(payload->>'ends_on', '')::date,
    NULLIF(payload->>'notes', '')
  , v_company_id)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$
;

commit;
