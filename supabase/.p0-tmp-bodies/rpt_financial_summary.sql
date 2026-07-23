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

