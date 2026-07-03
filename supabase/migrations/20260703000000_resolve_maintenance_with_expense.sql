-- Closes the gap where maintenance_records.expense_id / cost were never populated:
-- resolving a maintenance request now atomically records the actual cost as a real
-- expense row (flowing into financial reports) and stamps resolved_at/status/cost.
CREATE OR REPLACE FUNCTION public.resolve_maintenance_with_expense(
  p_request_id text,
  p_cost numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_record public.maintenance_records;
  v_expense_id text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول' USING ERRCODE = '42501';
  END IF;

  IF p_cost IS NULL OR p_cost < 0 THEN
    RAISE EXCEPTION 'التكلفة يجب أن تكون رقماً موجباً';
  END IF;

  SELECT * INTO v_record
  FROM public.maintenance_records
  WHERE id = p_request_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب الصيانة غير موجود';
  END IF;

  IF v_record.status IN ('resolved', 'closed') THEN
    RAISE EXCEPTION 'تم إغلاق هذا الطلب مسبقاً';
  END IF;

  IF p_cost > 0 THEN
    INSERT INTO public.expenses (
      property_id, category, amount, expense_date, description, notes, ref, status
    ) VALUES (
      v_record.property_id, 'صيانة', p_cost, CURRENT_DATE,
      coalesce(v_record.title, 'مصروف صيانة'),
      p_notes, v_record.id, 'posted'
    )
    RETURNING id INTO v_expense_id;
  END IF;

  UPDATE public.maintenance_records
  SET status = 'resolved',
      cost = p_cost,
      resolved_at = now(),
      notes = coalesce(p_notes, notes)
  WHERE id = p_request_id
  RETURNING * INTO v_record;

  RETURN jsonb_build_object(
    'maintenance', to_jsonb(v_record),
    'expense_id', v_expense_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_maintenance_with_expense(text, numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.resolve_maintenance_with_expense(text, numeric, text) TO authenticated;
