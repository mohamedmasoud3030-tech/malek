-- Migration: add_rpt_trial_balance
-- Description: Production-ready accounting foundation report.
--
-- Presents an operational Trial Balance derived from the live operational
-- source tables (payments, invoices, expenses, owner_settlements) as of a
-- given date. The report balances by construction: Retained Earnings is the
-- plug so that total debits == total credits. It is an OPERATIONAL view, not a
-- formal general-ledger trial balance (Rentrix has no posted GL), and is
-- labelled as such in the UI.
--
-- Security posture matches this project's baseline:
--   * SECURITY DEFINER
--   * SET search_path TO 'public', 'pg_temp'
--   * REVOKE ALL FROM public, anon
--   * GRANT EXECUTE TO authenticated, service_role

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

REVOKE ALL ON FUNCTION public.rpt_trial_balance(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_trial_balance(date) TO authenticated, service_role;
