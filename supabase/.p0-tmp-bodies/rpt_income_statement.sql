CREATE OR REPLACE FUNCTION public.rpt_income_statement(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_revenue numeric := 0;
  v_expenses numeric := 0;
  v_net numeric := 0;
  v_revenue_rows jsonb;
  v_expense_rows jsonb;
BEGIN
  -- Rental / operational revenue invoiced in the period (excludes voided and deleted).
  SELECT COALESCE(SUM(amount), 0)
    INTO v_revenue
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date BETWEEN p_from AND p_to;

  -- Operating expenses incurred in the period, broken down by category.
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('label', category, 'amount', round(amount, 2)) ORDER BY category),
    '[]'::jsonb
  )
    INTO v_expense_rows
    FROM (
      SELECT category, SUM(amount) AS amount
        FROM public.expenses
       WHERE deleted_at IS NULL
         AND expense_date BETWEEN p_from AND p_to
       GROUP BY category
    ) s;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_expenses
    FROM public.expenses
   WHERE deleted_at IS NULL
     AND expense_date BETWEEN p_from AND p_to;

  v_net := round(v_revenue - v_expenses, 2);

  v_revenue_rows := jsonb_build_array(
    jsonb_build_object('label', 'الإيرادات التشغيلية', 'amount', round(v_revenue, 2))
  );

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'revenue', v_revenue_rows,
    'total_revenue', round(v_revenue, 2),
    'expenses', v_expense_rows,
    'total_expenses', round(v_expenses, 2),
    'net_income', v_net
  );
END;
$$;

