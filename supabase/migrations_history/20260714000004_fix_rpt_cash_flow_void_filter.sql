-- Migration: Fix rpt_cash_flow VOID payment filter
-- Phase: 2 Wave 2 - Report Accuracy
-- Finding: A-06
--
-- Problem:
-- rpt_cash_flow includes VOID payments in the receipts total, which overstates
-- cash collections. The function only filters deleted_at IS NULL but doesn't
-- check payment status.
--
-- Solution:
-- Add filter to exclude payments where status = 'VOID'
--
-- Risk: LOW - additive filter, no schema changes
-- Rollback: Revert to original function (see ORIGINAL FUNCTION below)

-- ============================================================================
-- ORIGINAL FUNCTION (for rollback reference)
-- ============================================================================
-- CREATE OR REPLACE FUNCTION public.rpt_cash_flow(
--   p_from_date date,
--   p_to_date date
-- ) RETURNS jsonb
-- LANGUAGE plpgsql SECURITY DEFINER
-- SET search_path TO 'public', 'pg_temp' AS $$
-- DECLARE
--   v_operating jsonb;
--   v_investing jsonb;
--   v_financing jsonb;
--   v_receipts numeric;
--   v_expenses numeric;
-- BEGIN
--   SELECT COALESCE(SUM(amount), 0) INTO v_receipts
--   FROM public.payments
--   WHERE payment_date BETWEEN p_from_date AND p_to_date
--     AND deleted_at IS NULL;
--
--   SELECT COALESCE(SUM(amount), 0) INTO v_expenses
--   FROM public.expenses
--   WHERE expense_date BETWEEN p_from_date AND p_to_date
--     AND deleted_at IS NULL;
--
--   v_operating := jsonb_build_object(
--     'receipts', v_receipts,
--     'expenses', v_expenses,
--     'net_operating', v_receipts - v_expenses
--   );
--
--   v_investing := jsonb_build_object('note', 'not_applicable_single_office', 'amount', 0);
--   v_financing := jsonb_build_object('note', 'not_applicable_single_office', 'amount', 0);
--
--   RETURN jsonb_build_object(
--     'period', jsonb_build_object('from', p_from_date, 'to', p_to_date),
--     'operating', v_operating,
--     'investing', v_investing,
--     'financing', v_financing,
--     'net_change', v_receipts - v_expenses
--   );
-- END;
-- $$;
-- ============================================================================

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

-- Preserve grants
REVOKE ALL ON FUNCTION public.rpt_cash_flow(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_cash_flow(date, date) TO authenticated, service_role;
