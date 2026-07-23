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

