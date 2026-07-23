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

