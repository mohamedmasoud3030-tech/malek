-- Align reporting with the canonical identities and financial sources:
--   tenants  -> people(type = 'tenant')
--   receipts -> payments (POSTED, non-VOID, non-deleted)
--   properties.owner_id / owners.commission_* -> contract owner_agreement
-- FIXED_MONTHLY fees remain settlement inputs until the product accounting
-- policy defines their accrual timing; they are deliberately not treated as
-- percentages here.

CREATE OR REPLACE FUNCTION public._r3(v numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT round(COALESCE(v, 0), 3)
$$;

CREATE OR REPLACE FUNCTION public._safe_date(v text)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN v ~ '^\d{4}-\d{2}-\d{2}' THEN v::date ELSE NULL END
$$;

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
    SELECT COALESCE(p.payment_date::text, p.date_time) tx_date,
      'تحصيل — ' || oc.property_name || ' / ' || COALESCE(oc.unit_name, '—') ||
        ' (' || COALESCE(p.reference_number, p.reference_no, p.id::text) || ')' details,
      'payment' tx_type, oc.property_name, p.amount gross,
      CASE WHEN oc.commission_type = 'RATE'
        THEN public._r3(p.amount * oc.commission_value / 100) ELSE 0 END deduction,
      p.id::text sort_no
    FROM public.payments p
    JOIN owner_contracts oc ON oc.contract_id = p.contract_id
    WHERE p.deleted_at IS NULL AND upper(COALESCE(p.status, '')) <> 'VOID'
      AND COALESCE(p.payment_date, public._safe_date(p.date_time)) BETWEEN p_from AND p_to
  ), expense_rows AS (
    SELECT e.date_time tx_date,
      'مصروف — ' || COALESCE(e.description, e.category) details,
      'expense' tx_type, COALESCE(oc.property_name, pr.title, '') property_name,
      -e.amount gross, 0::numeric deduction, COALESCE(e.no, e.id) sort_no
    FROM public.expenses e
    LEFT JOIN owner_contracts oc ON oc.contract_id = e.contract_id
    LEFT JOIN public.properties pr ON pr.id = e.property_id
    WHERE e.deleted_at IS NULL AND upper(COALESCE(e.status, '')) = 'POSTED'
      AND upper(COALESCE(e.charged_to, '')) = 'OWNER'
      AND public._safe_date(e.date_time) BETWEEN p_from AND p_to
      AND (
        oc.contract_id IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM public.property_owners po
          WHERE po.property_id = e.property_id AND po.owner_id = p_owner_id
            AND (po.starts_on IS NULL OR po.starts_on <= public._safe_date(e.date_time))
            AND (po.ends_on IS NULL OR po.ends_on >= public._safe_date(e.date_time))
        )
      )
  ), settlement_rows AS (
    SELECT s.date tx_date, 'تسوية مالية رقم ' || s.no details,
      'settlement' tx_type, '' property_name, -s.amount gross,
      0::numeric deduction, COALESCE(s.no, s.id) sort_no
    FROM public.owner_settlements s
    WHERE s.owner_id = p_owner_id::text AND public._safe_date(s.date) BETWEEN p_from AND p_to
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

ALTER FUNCTION public.rpt_owner_statement(uuid,date,date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpt_owner_statement(uuid,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpt_owner_statement(uuid,date,date) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
