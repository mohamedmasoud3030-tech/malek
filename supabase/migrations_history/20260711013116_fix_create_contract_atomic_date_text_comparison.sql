-- public.contracts.start_date and end_date are `text` columns (not `date`),
-- but create_contract_atomic's unit-overlap check compared them directly
-- against the function's `date`-typed parameters (p_start_date/p_end_date),
-- which has no operator (text < date) and fails at query-plan time
-- unconditionally -- even with zero rows in public.contracts. This meant
-- create_contract_atomic could never successfully create a contract in
-- production. Fixed by casting the stored text columns to date for the
-- comparison, consistent with how other RPCs (e.g. renew_contract_atomic)
-- already treat these columns as text everywhere except comparisons.
CREATE OR REPLACE FUNCTION public.create_contract_atomic(
  p_property_id text,
  p_unit_id uuid,
  p_tenant_id uuid,
  p_agreement_id uuid,
  p_start_date date,
  p_end_date date,
  p_rent_amount numeric,
  p_payment_cycle text,
  p_payment_terms_id uuid,
  p_status text,
  p_cancellation_reason text,
  p_notes text,
  p_attachment_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عقد' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.people
    WHERE id = p_tenant_id::text AND type = 'tenant' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'المستأجر غير موجود أو نوعه غير صحيح';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.properties WHERE id = p_property_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'العقار غير موجود';
  END IF;

  IF p_unit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.units
    WHERE id = p_unit_id AND property_id = p_property_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'الوحدة لا تنتمي إلى العقار المحدد';
  END IF;

  IF p_unit_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.contracts
    WHERE unit_id = p_unit_id
      AND deleted_at IS NULL
      AND status IN ('active', 'draft')
      AND start_date::date < p_end_date
      AND end_date::date > p_start_date
  ) THEN
    RAISE EXCEPTION 'الوحدة محجوزة خلال هذه الفترة';
  END IF;

  IF p_agreement_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد اتفاقية مالك نشطة تغطي فترة العقد — أنشئ اتفاقية مالك أولاً';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.owner_agreements
    WHERE id = p_agreement_id
      AND property_id = p_property_id
      AND starts_on <= p_start_date
      AND (ends_on IS NULL OR ends_on >= p_end_date)
  ) THEN
    RAISE EXCEPTION 'اتفاقية المالك لا تغطي فترة العقد بالكامل أو لا تنتمي لهذا العقار';
  END IF;

  INSERT INTO public.contracts (
    property_id, unit_id, tenant_id, agreement_id,
    start_date, end_date, rent_amount, payment_cycle,
    payment_terms_id, status, cancellation_reason, notes, attachment_url
  ) VALUES (
    p_property_id, p_unit_id, p_tenant_id, p_agreement_id,
    p_start_date, p_end_date, p_rent_amount, p_payment_cycle,
    p_payment_terms_id, p_status, p_cancellation_reason, p_notes, p_attachment_url
  )
  RETURNING id INTO v_id;

  RETURN (SELECT to_jsonb(c) FROM public.contracts c WHERE c.id = v_id::text);
END;
$function$;
