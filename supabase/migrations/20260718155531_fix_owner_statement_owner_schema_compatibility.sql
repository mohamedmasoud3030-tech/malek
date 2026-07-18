-- Keep the clean replay owner lifecycle contract aligned with the supported
-- production schema. Owner reports and services exclude soft-deleted owners,
-- while historical clean baselines created public.owners without this column.
-- Production already has the column, so the table change is a no-op there.

ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.owners.deleted_at IS
  'Soft-delete timestamp used by owner reads, reports, and lifecycle checks.';

-- Historical production stores payments.date_time as text while the clean
-- baseline stores timestamptz. Cast the compatibility field explicitly before
-- using it as display text or passing it through the safe-date parser.

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

ALTER FUNCTION public.rpt_owner_statement(uuid,date,date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpt_owner_statement(uuid,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpt_owner_statement(uuid,date,date) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
