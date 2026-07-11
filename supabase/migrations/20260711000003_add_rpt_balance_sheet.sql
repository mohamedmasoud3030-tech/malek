-- Migration: add_rpt_balance_sheet
-- Description: Production-ready accounting foundation report.
--
-- Presents an operational Balance Sheet as of a given date. Assets = Cash +
-- Tenant Receivables; Liabilities = Owner Payables + VAT Payable; Equity
-- (Retained Earnings) is the balancing figure so that Assets == Liabilities +
-- Equity by construction. It is an OPERATIONAL view derived from source tables,
-- not a formal GL balance sheet, and is labelled as such in the UI.
--
-- Security posture matches this project's baseline:
--   * SECURITY DEFINER
--   * SET search_path TO 'public', 'pg_temp'
--   * REVOKE ALL FROM public, anon
--   * GRANT EXECUTE TO authenticated, service_role

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

REVOKE ALL ON FUNCTION public.rpt_balance_sheet(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_balance_sheet(date) TO authenticated, service_role;
