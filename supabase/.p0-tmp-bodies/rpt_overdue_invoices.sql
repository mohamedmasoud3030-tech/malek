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

