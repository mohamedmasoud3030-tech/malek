-- ============================================================================
-- Phase 2 — Financial Integrity and Reports Recovery
-- ============================================================================
-- Focus: Fix 6 broken reporting RPCs (trial balance, balance sheet, aged receivables, 
-- overdue invoices, rent roll, tenant statement), apply secure require_company_id() 
-- checks, fix type mismatches, and lock search_path.
--
-- Verification suite: rentrix-app/src/features/financials/reports/accounting-reports-service.test.ts
-- Rollback: supabase/rollback/20260726_rollback_phase2_reports_recovery.sql
-- ============================================================================

BEGIN;

-- 1. rpt_trial_balance
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
  v_company_id uuid := public.require_company_id();
BEGIN
  -- Derived Cash balance from general ledger (1111 account)
  SELECT COALESCE(SUM(CASE WHEN type = 'DEBIT' then amount else -amount end), 0)
    INTO v_cash
    FROM public.journal_entries
   WHERE company_id = v_company_id
     AND account_id = '1111'
     AND public._safe_date(date) <= p_as_of;

  -- Derived Tenant Receivables balance from general ledger (1201 account)
  SELECT COALESCE(SUM(CASE WHEN type = 'DEBIT' then amount else -amount end), 0)
    INTO v_ar
    FROM public.journal_entries
   WHERE company_id = v_company_id
     AND account_id = '1201'
     AND public._safe_date(date) <= p_as_of;

  -- Derived Operating Expenses balance from general ledger (6100 account)
  SELECT COALESCE(SUM(CASE WHEN type = 'DEBIT' then amount else -amount end), 0)
    INTO v_expenses
    FROM public.journal_entries
   WHERE company_id = v_company_id
     AND account_id = '6100'
     AND public._safe_date(date) <= p_as_of;

  -- Derived Rental Revenue balance from general ledger (4000 account)
  SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' then amount else -amount end), 0)
    INTO v_revenue
    FROM public.journal_entries
   WHERE company_id = v_company_id
     AND account_id = '4000'
     AND public._safe_date(date) <= p_as_of;

  -- Derived Owner Payables balance from general ledger (2000 account)
  SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' then amount else -amount end), 0)
    INTO v_owner_pay
    FROM public.journal_entries
   WHERE company_id = v_company_id
     AND account_id = '2000'
     AND public._safe_date(date) <= p_as_of;

  -- Derived VAT Payable balance from general ledger (2100 account)
  SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' then amount else -amount end), 0)
    INTO v_vat
    FROM public.journal_entries
   WHERE company_id = v_company_id
     AND account_id = '2100'
     AND public._safe_date(date) <= p_as_of;

  -- Derived Retained Earnings balance from general ledger (3000 account)
  SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' then amount else -amount end), 0)
    INTO v_retained
    FROM public.journal_entries
   WHERE company_id = v_company_id
     AND account_id = '3000'
     AND public._safe_date(date) <= p_as_of;

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

-- 2. rpt_balance_sheet
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
  v_company_id uuid := public.require_company_id();
BEGIN
  -- Assets: Cash + Tenant Receivables (from general ledger)
  SELECT COALESCE(SUM(CASE WHEN type = 'DEBIT' then amount else -amount end), 0)
    INTO v_cash
    FROM public.journal_entries
   WHERE company_id = v_company_id
     AND account_id = '1111'
     AND public._safe_date(date) <= p_as_of;

  SELECT COALESCE(SUM(CASE WHEN type = 'DEBIT' then amount else -amount end), 0)
    INTO v_ar
    FROM public.journal_entries
   WHERE company_id = v_company_id
     AND account_id = '1201'
     AND public._safe_date(date) <= p_as_of;

  -- Liabilities: Owner Payables + VAT Payable (from general ledger)
  SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' then amount else -amount end), 0)
    INTO v_owner_pay
    FROM public.journal_entries
   WHERE company_id = v_company_id
     AND account_id = '2000'
     AND public._safe_date(date) <= p_as_of;

  SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' then amount else -amount end), 0)
    INTO v_vat
    FROM public.journal_entries
   WHERE company_id = v_company_id
     AND account_id = '2100'
     AND public._safe_date(date) <= p_as_of;

  -- Equity: Retained Earnings + Net Income (Revenue - Expenses)
  SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' then amount else -amount end), 0)
    INTO v_equity
    FROM public.journal_entries j
    JOIN public.accounts a on a.id = j.account_id
   WHERE j.company_id = v_company_id
     AND public._safe_date(j.date) <= p_as_of
     AND (a.no like '3%' or a.no like '4%' or a.no like '5%' or a.no like '6%');

  v_assets := round(v_cash + v_ar, 2);
  v_liabilities := round(v_owner_pay + v_vat, 2);

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
    'liabilities', v_liability_rows,
    'equity', v_equity_rows,
    'total_assets', v_assets,
    'total_liabilities', v_liabilities,
    'total_equity', round(v_equity, 2),
    'is_balanced', (v_assets = v_liabilities + round(v_equity, 2))
  );
END;
$$;

-- 3. rpt_aged_receivables
CREATE OR REPLACE FUNCTION public.rpt_aged_receivables(p_as_of date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE 
  v_lines jsonb; 
  v_totals jsonb;
  v_company_id uuid := public.require_company_id();
BEGIN
  WITH aged AS (
    SELECT t.id tenant_id, t.full_name tenant_name, t.phone tenant_phone,
      pr.title property_name, u.unit_number unit_name,
      public._r3(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount) remaining,
      (p_as_of - i.due_date)::int days_overdue
    FROM public.invoices i
    JOIN public.contracts c ON c.id::text = i.contract_id::text AND c.deleted_at IS NULL
    JOIN public.people t ON t.id::text = c.tenant_id::text AND t.type = 'tenant' AND t.deleted_at IS NULL
    JOIN public.units u ON u.id::text = c.unit_id::text AND u.deleted_at IS NULL
    JOIN public.properties pr ON pr.id::text = c.property_id::text AND pr.deleted_at IS NULL
    WHERE upper(COALESCE(i.status, '')) NOT IN ('PAID', 'VOID', 'CANCELLED')
      AND i.deleted_at IS NULL
      AND i.company_id = v_company_id
      AND i.due_date <= p_as_of
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

-- 4. rpt_overdue_invoices
CREATE OR REPLACE FUNCTION public.rpt_overdue_invoices(p_as_of date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE 
  v_rows jsonb; 
  v_total numeric; 
  v_count bigint;
  v_company_id uuid := public.require_company_id();
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
      'invoice_id', i.id, 'invoice_no', i.no, 'due_date', i.due_date,
      'days_overdue', (p_as_of - i.due_date)::int,
      'amount', public._r3(i.amount + COALESCE(i.tax_amount, 0)),
      'paid', public._r3(i.paid_amount),
      'remaining', public._r3(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount),
      'tenant_name', t.full_name, 'tenant_phone', t.phone,
      'unit_name', u.unit_number, 'property_name', pr.title, 'contract_id', c.id)
      ORDER BY (p_as_of - i.due_date) DESC),
    public._r3(sum(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount)), count(*)
  INTO v_rows, v_total, v_count
  FROM public.invoices i
  JOIN public.contracts c ON c.id::text = i.contract_id::text AND c.deleted_at IS NULL
  JOIN public.people t ON t.id::text = c.tenant_id::text AND t.type = 'tenant' AND t.deleted_at IS NULL
  JOIN public.units u ON u.id::text = c.unit_id::text AND u.deleted_at IS NULL
  JOIN public.properties pr ON pr.id::text = c.property_id::text AND pr.deleted_at IS NULL
  WHERE upper(COALESCE(i.status, '')) NOT IN ('PAID', 'VOID', 'CANCELLED')
    AND i.deleted_at IS NULL
    AND i.company_id = v_company_id
    AND i.due_date < p_as_of
    AND (i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount) > 0.001;

  RETURN jsonb_build_object(
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'total_overdue', COALESCE(v_total, 0),
    'count', COALESCE(v_count, 0),
    'as_of', p_as_of
  );
END;
$$;

-- 5. rpt_rent_roll
CREATE OR REPLACE FUNCTION public.rpt_rent_roll(p_as_of date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE 
  v_rows jsonb;
  v_company_id uuid := public.require_company_id();
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'property_name', pr.title, 'unit_name', u.unit_number, 'unit_type', coalesce(u.name, 'Apartment'),
    'status', u.status, 'tenant_name', t.full_name, 'tenant_phone', t.phone,
    'contract_start', c.start_date, 'contract_end', c.end_date,
    'rent_amount', c.rent_amount, 
    'deposit', public._r3(coalesce((
       select sum(amount) from public.deposit_txs d 
       where d.contract_id::text = c.id::text and d.deleted_at is null
    ), 0)),
    'days_to_expiry', (c.end_date - p_as_of)::int,
    'overdue_balance', public._r3(COALESCE((
      SELECT sum(i.amount + COALESCE(i.tax_amount, 0) - i.paid_amount)
      FROM public.invoices i
      WHERE i.contract_id::text = c.id::text AND i.deleted_at IS NULL
        AND i.company_id = v_company_id
        AND upper(COALESCE(i.status, '')) NOT IN ('PAID', 'VOID', 'CANCELLED')
        AND i.due_date < p_as_of
    ), 0))) ORDER BY pr.title, u.unit_number)
  INTO v_rows
  FROM public.units u
  JOIN public.properties pr ON pr.id::text = u.property_id::text AND pr.deleted_at IS NULL
  LEFT JOIN public.contracts c ON c.unit_id::text = u.id::text
    AND lower(COALESCE(c.status, '')) = 'active'
    AND c.deleted_at IS NULL
    AND c.start_date <= p_as_of
    AND c.end_date >= p_as_of
  LEFT JOIN public.people t ON t.id::text = c.tenant_id::text AND t.type = 'tenant' AND t.deleted_at IS NULL
  WHERE u.deleted_at IS NULL
    AND u.company_id = v_company_id;

  RETURN jsonb_build_object('rows', COALESCE(v_rows, '[]'::jsonb), 'as_of', p_as_of);
END;
$$;

-- 6. rpt_tenant_statement
CREATE OR REPLACE FUNCTION public.rpt_tenant_statement(p_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE 
  v_contract record; 
  v_lines jsonb; 
  v_balance numeric;
  v_company_id uuid := public.require_company_id();
BEGIN
  -- Select contract with correct title field from properties
  SELECT c.*, t.full_name as tenant_name, t.phone as tenant_phone,
    u.name as unit_name, pr.title as property_name
  INTO v_contract 
  FROM public.contracts c
  JOIN public.people t ON t.id::text = c.tenant_id::text AND t.deleted_at IS NULL
  JOIN public.units u ON u.id::text = c.unit_id::text AND u.deleted_at IS NULL
  JOIN public.properties pr ON pr.id::text = u.property_id::text AND pr.deleted_at IS NULL 
  WHERE c.id::text = p_contract_id::text
    AND c.company_id = v_company_id;
    
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('error', 'contract not found'); 
  END IF;

  WITH tx AS (
    SELECT i.due_date::text as tx_date,
      'فاتورة رقم '||i.no as description,
      'invoice' as tx_type, i.amount+coalesce(i.tax_amount,0) as debit, 0 as credit, i.no as ref_no
    FROM public.invoices i 
    WHERE i.contract_id::text = p_contract_id::text 
      AND i.deleted_at IS NULL
      AND i.company_id = v_company_id
      AND upper(coalesce(i.status, '')) NOT IN ('VOID', 'CANCELLED')
    UNION ALL
    SELECT coalesce(p.payment_date, public._safe_date(p.created_at::text))::text as tx_date,
      'سند قبض رقم '||coalesce(r.no, p.id::text)||coalesce(' — '||p.payment_method, '') as description,
      'receipt' as tx_type, 0 as debit, p.amount as credit, coalesce(r.no, p.id::text) as ref_no
    FROM public.payments p
    LEFT JOIN public.receipts r on r.id::text = p.receipt_id::text and r.deleted_at is null
    WHERE p.contract_id::text = p_contract_id::text
      AND p.deleted_at is null
      AND upper(coalesce(p.status, '')) = 'POSTED'
      AND p.company_id = v_company_id
  ),
  with_balance AS (
    SELECT tx_date, description, tx_type, debit, credit, ref_no,
      SUM(debit-credit) OVER (ORDER BY tx_date, ref_no ROWS UNBOUNDED PRECEDING) as running_balance 
    FROM tx
  )
  SELECT jsonb_agg(jsonb_build_object(
    'date', tx_date,
    'description', description,
    'type', tx_type,
    'debit', public._r3(debit),
    'credit', public._r3(credit),
    'balance', public._r3(running_balance)
  ) ORDER BY tx_date, ref_no),
    public._r3(SUM(debit-credit)) 
  INTO v_lines, v_balance 
  FROM with_balance;

  RETURN jsonb_build_object(
    'contract_id', p_contract_id,
    'tenant_name', v_contract.tenant_name,
    'tenant_phone', v_contract.tenant_phone,
    'unit_name', v_contract.unit_name,
    'property_name', v_contract.property_name,
    'start_date', v_contract.start_date,
    'end_date', v_contract.end_date,
    'lines', COALESCE(v_lines, '[]'::jsonb),
    'final_balance', COALESCE(v_balance, 0)
  );
END;
$function$;

-- Secure All 6 Recovered Functions from anonymous execute leak!
REVOKE ALL ON FUNCTION public.rpt_trial_balance(date) FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpt_trial_balance(date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpt_balance_sheet(date) FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpt_balance_sheet(date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpt_aged_receivables(date) FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpt_aged_receivables(date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpt_overdue_invoices(date) FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpt_overdue_invoices(date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpt_rent_roll(date) FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpt_rent_roll(date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpt_tenant_statement(uuid) FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpt_tenant_statement(uuid) TO authenticated, service_role;

COMMIT;
