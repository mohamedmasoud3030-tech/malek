-- Align owner statements with the authoritative collection source and temporal owner agreements.
-- Prepared migration only. Apply after live schema reconciliation.

CREATE OR REPLACE FUNCTION public.rpt_owner_statement(p_owner_id uuid, p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_owner_name       text;
  v_transactions     jsonb;
  v_total_gross      numeric := 0;
  v_total_deductions numeric := 0;
  v_total_net        numeric := 0;
BEGIN
  SELECT name INTO v_owner_name
  FROM public.owners
  WHERE id = p_owner_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'owner not found');
  END IF;

  WITH payment_context AS (
    SELECT
      p.id,
      COALESCE(p.payment_date::date, public._safe_date(p.date_time)) AS tx_day,
      p.amount,
      COALESCE(p.contract_id, i.contract_id) AS contract_id,
      COALESCE(p.reference_no, p.reference_number, p.id::text) AS reference_no
    FROM public.payments p
    LEFT JOIN public.invoices i ON i.id = p.invoice_id
    WHERE upper(COALESCE(p.status, 'POSTED')) = 'POSTED'
      AND p.deleted_at IS NULL
      AND COALESCE(p.payment_date::date, public._safe_date(p.date_time)) BETWEEN p_from AND p_to
  ),
  owner_payments AS (
    SELECT
      pc.id,
      pc.tx_day,
      pc.amount,
      pc.reference_no,
      c.id AS contract_id,
      oa.id AS agreement_id,
      oa.commission_type,
      oa.commission_value,
      pr.name AS property_name,
      u.name AS unit_name
    FROM payment_context pc
    JOIN public.contracts c ON c.id = pc.contract_id
    JOIN public.owner_agreements oa ON oa.id = c.agreement_id
      AND oa.owner_id = p_owner_id
      AND oa.property_id = c.property_id
      AND oa.starts_on <= pc.tx_day
      AND (oa.ends_on IS NULL OR oa.ends_on >= pc.tx_day)
    LEFT JOIN public.units u ON u.id = c.unit_id
    LEFT JOIN public.properties pr ON pr.id = c.property_id
    WHERE c.deleted_at IS NULL
  ),
  payment_rows AS (
    SELECT
      op.tx_day::text AS tx_date,
      'تحصيل — ' || COALESCE(op.property_name, '') ||
        CASE WHEN op.unit_name IS NOT NULL THEN ' / ' || op.unit_name ELSE '' END ||
        ' (دفعة ' || op.reference_no || ')' AS details,
      'payment' AS tx_type,
      COALESCE(op.property_name, '') AS property_name,
      op.amount AS gross,
      CASE WHEN op.commission_type = 'RATE'
        THEN public._r3(op.amount * op.commission_value / 100)
        ELSE 0
      END AS deduction,
      op.tx_day AS sort_date,
      op.id::text AS sort_key
    FROM owner_payments op
  ),
  fixed_commission_rows AS (
    SELECT
      month_start::text AS tx_date,
      'عمولة إدارة شهرية — ' || COALESCE(property_name, '') AS details,
      'commission' AS tx_type,
      COALESCE(property_name, '') AS property_name,
      0::numeric AS gross,
      public._r3(commission_value) AS deduction,
      month_start AS sort_date,
      agreement_id::text || ':' || month_start::text AS sort_key
    FROM (
      SELECT DISTINCT
        op.agreement_id,
        date_trunc('month', op.tx_day)::date AS month_start,
        op.property_name,
        op.commission_value
      FROM owner_payments op
      WHERE op.commission_type = 'FIXED_MONTHLY'
    ) fixed_months
  ),
  expense_rows AS (
    SELECT
      e.date_time::text AS tx_date,
      'مصروف — ' || COALESCE(e.description, e.category) AS details,
      'expense' AS tx_type,
      COALESCE(pr.name, '') AS property_name,
      -e.amount AS gross,
      0::numeric AS deduction,
      public._safe_date(e.date_time) AS sort_date,
      e.id::text AS sort_key
    FROM public.expenses e
    LEFT JOIN public.contracts c ON c.id = e.contract_id
    LEFT JOIN public.units u ON u.id = c.unit_id
    LEFT JOIN public.properties pr ON pr.id = COALESCE(u.property_id, e.property_id)
    WHERE e.status = 'POSTED'
      AND e.charged_to = 'OWNER'
      AND public._safe_date(e.date_time) BETWEEN p_from AND p_to
      AND EXISTS (
        SELECT 1
        FROM public.owner_agreements oa
        WHERE oa.owner_id = p_owner_id
          AND oa.property_id = pr.id
          AND oa.starts_on <= public._safe_date(e.date_time)
          AND (oa.ends_on IS NULL OR oa.ends_on >= public._safe_date(e.date_time))
      )
  ),
  settlement_rows AS (
    SELECT
      s.date::text AS tx_date,
      'تسوية مالية رقم ' || s.no AS details,
      'settlement' AS tx_type,
      '' AS property_name,
      -s.amount AS gross,
      0::numeric AS deduction,
      public._safe_date(s.date) AS sort_date,
      s.id::text AS sort_key
    FROM public.owner_settlements s
    WHERE s.owner_id = p_owner_id::text
      AND public._safe_date(s.date) BETWEEN p_from AND p_to
  ),
  all_tx AS (
    SELECT * FROM payment_rows
    UNION ALL SELECT * FROM fixed_commission_rows
    UNION ALL SELECT * FROM expense_rows
    UNION ALL SELECT * FROM settlement_rows
  )
  SELECT
    jsonb_agg(jsonb_build_object(
      'date', tx_date,
      'details', details,
      'type', tx_type,
      'property_name', property_name,
      'gross', public._r3(gross),
      'deduction', public._r3(deduction),
      'net', public._r3(gross - deduction)
    ) ORDER BY sort_date, sort_key),
    public._r3(SUM(gross)),
    public._r3(SUM(deduction)),
    public._r3(SUM(gross - deduction))
  INTO v_transactions, v_total_gross, v_total_deductions, v_total_net
  FROM all_tx;

  RETURN jsonb_build_object(
    'owner_name', v_owner_name,
    'commission_type', 'AGREEMENT_BASED',
    'commission_value', 0,
    'transactions', COALESCE(v_transactions, '[]'::jsonb),
    'total_gross', COALESCE(v_total_gross, 0),
    'total_deductions', COALESCE(v_total_deductions, 0),
    'total_net', COALESCE(v_total_net, 0),
    'period_from', p_from,
    'period_to', p_to
  );
END;
$function$;

ALTER FUNCTION public.rpt_owner_statement(uuid, date, date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpt_owner_statement(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpt_owner_statement(uuid, date, date) TO authenticated, service_role;
