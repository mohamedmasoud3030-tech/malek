-- Migration: Fix rpt_vat_return VOID/CANCELLED invoice filter
-- Phase: 2 Wave 2 - Report Accuracy
-- Finding: A-07
--
-- Problem:
-- rpt_vat_return includes VOID and CANCELLED invoices in the VAT calculation,
-- which inflates the VAT liability. The function only filters deleted_at IS NULL
-- but doesn't check invoice status.
--
-- Solution:
-- Add filter to exclude invoices where status IN ('VOID', 'CANCELLED')
--
-- Risk: LOW - additive filter, no schema changes
-- Rollback: Revert to original function (see ORIGINAL FUNCTION below)

-- ============================================================================
-- ORIGINAL FUNCTION (for rollback reference)
-- ============================================================================
-- CREATE OR REPLACE FUNCTION public.rpt_vat_return(
--   p_from_date date,
--   p_to_date date
-- ) RETURNS jsonb
-- LANGUAGE plpgsql SECURITY DEFINER
-- SET search_path TO 'public', 'pg_temp' AS $$
-- DECLARE
--   v_result jsonb;
-- BEGIN
--   SELECT jsonb_build_object(
--     'period', jsonb_build_object('from', p_from_date, 'to', p_to_date),
--     'total_sales_amount', COALESCE(SUM(amount), 0),
--     'total_tax_amount', COALESCE(SUM(tax_amount), 0),
--     'invoice_count', COUNT(*)
--   ) INTO v_result
--   FROM public.invoices
--   WHERE issue_date BETWEEN p_from_date AND p_to_date
--     AND deleted_at IS NULL;
--
--   RETURN v_result;
-- END;
-- $$;
-- ============================================================================

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

-- Preserve grants
REVOKE ALL ON FUNCTION public.rpt_vat_return(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_vat_return(date, date) TO authenticated, service_role;
