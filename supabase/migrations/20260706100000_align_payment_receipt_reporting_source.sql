-- Migration: align_payment_receipt_reporting_source
-- Description: Make the daily collection reporting RPC use payments as the
-- canonical receipt/collection source, matching the Receipts UI and financial
-- report services. VOID payments and soft-deleted payments are excluded from
-- report totals while the Receipts UI may still display void status history.

CREATE OR REPLACE FUNCTION public.rpt_daily_collection(p_from date, p_to date)
RETURNS TABLE(
  collection_date date,
  payment_method text,
  total_amount numeric,
  payments_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p.payment_date::date AS collection_date,
    COALESCE(NULLIF(p.payment_method, ''), 'other')::text AS payment_method,
    COALESCE(SUM(p.amount), 0)::numeric AS total_amount,
    COUNT(*)::bigint AS payments_count
  FROM public.payments p
  WHERE p.deleted_at IS NULL
    AND UPPER(COALESCE(p.status, 'POSTED')) <> 'VOID'
    AND p.payment_date::date BETWEEN p_from AND p_to
  GROUP BY p.payment_date::date, COALESCE(NULLIF(p.payment_method, ''), 'other')
  ORDER BY collection_date, payment_method;
$$;

REVOKE ALL ON FUNCTION public.rpt_daily_collection(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_daily_collection(date, date) TO authenticated, service_role;
