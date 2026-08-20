-- Contract renewal must not create a lease outside the office-owner agreement
-- period.  The existing renewal RPC copied the original agreement_id without
-- checking its coverage for the new dates, so a renewal could become an
-- ungoverned contract after an agreement had expired.
--
-- Live contract dates and identifiers are text in the deployed schema; cast
-- deliberately at comparison boundaries and keep the existing RPC signature.

CREATE OR REPLACE FUNCTION public.renew_contract_atomic(old_contract_id text, new_contract_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_new_id text;
  v_old public.contracts%rowtype;
  v_new_start text;
  v_new_end text;
  v_new_amount numeric;
  v_new_start_date date;
  v_new_end_date date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول';
  END IF;

  v_new_start := new_contract_data ->> 'new_start';
  v_new_end := new_contract_data ->> 'new_end';
  v_new_amount := (new_contract_data ->> 'new_amount')::numeric;

  IF v_new_start IS NULL OR v_new_end IS NULL OR v_new_amount IS NULL THEN
    RAISE EXCEPTION 'new_start / new_end / new_amount مطلوبة';
  END IF;

  IF v_new_start !~ '^\\d{4}-\\d{2}-\\d{2}$' OR v_new_end !~ '^\\d{4}-\\d{2}-\\d{2}$' THEN
    RAISE EXCEPTION 'تواريخ التجديد يجب أن تكون بصيغة YYYY-MM-DD';
  END IF;

  v_new_start_date := v_new_start::date;
  v_new_end_date := v_new_end::date;

  IF v_new_end_date <= v_new_start_date THEN
    RAISE EXCEPTION 'تاريخ نهاية التجديد يجب أن يكون بعد تاريخ البداية';
  END IF;

  IF v_new_amount <= 0 THEN
    RAISE EXCEPTION 'قيمة الإيجار الجديدة يجب أن تكون أكبر من صفر';
  END IF;

  -- Lock before checks and state transition so concurrent renewals cannot race.
  SELECT * INTO v_old
  FROM public.contracts
  WHERE id::text = old_contract_id::text
    AND status IN ('active', 'expired', 'ACTIVE')
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'العقد الأصلي غير موجود أو لا يمكن تجديده';
  END IF;

  IF v_old.agreement_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.owner_agreements
    WHERE id = v_old.agreement_id
      AND property_id = v_old.property_id
      AND starts_on <= v_new_start_date
      AND (ends_on IS NULL OR ends_on >= v_new_end_date)
  ) THEN
    RAISE EXCEPTION 'اتفاقية المكتب والمالك لا تغطي كامل فترة التجديد. أنشئ عقداً جديداً تحت الاتفاقية السارية.';
  END IF;

  IF v_old.unit_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.contracts
    WHERE unit_id = v_old.unit_id
      AND id::text <> old_contract_id::text
      AND status IN ('active', 'draft', 'ACTIVE')
      AND deleted_at IS NULL
      AND start_date::date <= v_new_end_date
      AND end_date::date >= v_new_start_date
  ) THEN
    RAISE EXCEPTION 'الوحدة محجوزة خلال فترة التجديد';
  END IF;

  UPDATE public.contracts
  SET status = 'expired',
      updated_at = now()
  WHERE id::text = old_contract_id::text;

  INSERT INTO public.contracts (
    no, unit_id, tenant_id, rent_amount, due_day,
    start_date, end_date, deposit, status,
    sponsor_name, sponsor_id, sponsor_phone,
    property_id, organization_id, payment_cycle, commission_rate,
    payment_terms_id, agreement_id, monthly_rent,
    renewed_from_id,
    created_at, updated_at, deleted_at
  )
  VALUES (
    v_old.no, v_old.unit_id, v_old.tenant_id, v_new_amount, v_old.due_day,
    v_new_start, v_new_end, COALESCE(v_old.deposit, 0), 'active',
    v_old.sponsor_name, v_old.sponsor_id, v_old.sponsor_phone,
    v_old.property_id, v_old.organization_id, v_old.payment_cycle, v_old.commission_rate,
    v_old.payment_terms_id, v_old.agreement_id, v_new_amount,
    v_old.id,
    now(), now(), NULL
  )
  RETURNING id::text INTO v_new_id;

  RETURN jsonb_build_object(
    'status', 'renewed',
    'old_contract_id', old_contract_id,
    'new_contract_id', v_new_id
  );
END;
$function$;

ALTER FUNCTION public.renew_contract_atomic(text, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.renew_contract_atomic(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_contract_atomic(text, jsonb) TO authenticated, service_role;
