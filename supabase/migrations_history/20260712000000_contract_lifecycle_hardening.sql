-- ============================================================
-- Contract Lifecycle Production Hardening
-- Phase 1 & Phase 2: soft_delete_contract_atomic and renew_contract_atomic fixes
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_contract_atomic(p_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_old public.contracts%rowtype;
  v_cancelled_invoice_ids text[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لحذف عقد' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_old
  FROM public.contracts
  WHERE id::text = p_contract_id::text AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'العقد غير موجود';
  END IF;

  UPDATE public.contracts
  SET deleted_at = now(),
      updated_at = now()
  WHERE id::text = p_contract_id::text;

  WITH cancelled AS (
    UPDATE public.invoices
    SET status = 'CANCELLED',
        updated_at = now()
    WHERE contract_id::text = p_contract_id::text
      AND deleted_at IS NULL
      AND paid_amount = 0
      AND status NOT IN ('CANCELLED', 'PAID')
      AND due_date::date > current_date
    RETURNING id::text
  )
  SELECT coalesce(array_agg(id), '{}') INTO v_cancelled_invoice_ids FROM cancelled;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'soft_deleted',
    'contract_id', p_contract_id::text,
    'cancelled_invoice_ids', to_jsonb(v_cancelled_invoice_ids)
  );
END;
$function$;

ALTER FUNCTION public.soft_delete_contract_atomic(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.soft_delete_contract_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_contract_atomic(uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.renew_contract_atomic(old_contract_id text, new_contract_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_new_id text;
  v_old public.contracts%rowtype;
  v_active_count integer;
  v_new_start text;
  v_new_end text;
  v_new_amount numeric;
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

  SELECT * INTO v_old
  FROM public.contracts
  WHERE id::text = old_contract_id::text AND status IN ('active', 'expired', 'ACTIVE') AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original contract is not active or expired';
  END IF;

  SELECT count(*) INTO v_active_count
  FROM public.contracts
  WHERE unit_id = v_old.unit_id AND status IN ('active', 'draft', 'ACTIVE') AND deleted_at IS NULL AND id::text <> old_contract_id::text;

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'Unit already has another active contract';
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
    v_new_start, v_new_end, coalesce(v_old.deposit, 0), 'active',
    v_old.sponsor_name, v_old.sponsor_id, v_old.sponsor_phone,
    v_old.property_id, v_old.organization_id, v_old.payment_cycle, v_old.commission_rate,
    v_old.payment_terms_id, v_old.agreement_id, v_new_amount,
    v_old.id,
    now(), now(), null
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
