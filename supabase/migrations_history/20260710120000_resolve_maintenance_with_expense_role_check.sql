-- Production readiness audit (2026-07-10): resolve_maintenance_with_expense only
-- checked auth.uid() IS NOT NULL, so any authenticated user -- including the
-- frontend USER role, which the app permission model restricts to dashboard-view
-- only -- could call the RPC directly and post a real, arbitrary-amount expense
-- row. Add the same ADMIN/MANAGER role check already used by
-- post_receipt_atomic / record_invoice_payment_atomic / void_receipt_atomic.
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

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'MANAGER')
  ) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' USING ERRCODE = '42501';
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
