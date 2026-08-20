-- ============================================================
-- create_contract_atomic: enforces agreement coverage, unit/property
-- matching, tenant validity, and unit availability before insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_contract_atomic(
  p_property_id      text,
  p_unit_id          uuid,
  p_tenant_id        uuid,
  p_agreement_id     uuid,
  p_start_date       date,
  p_end_date         date,
  p_rent_amount      numeric,
  p_payment_cycle    text,
  p_payment_terms_id uuid,
  p_status           text,
  p_cancellation_reason text,
  p_notes            text,
  p_attachment_url   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عقد' USING ERRCODE = '42501';
  END IF;

  -- Validate tenant exists and is of type tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.people
    WHERE id = p_tenant_id AND type = 'tenant' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'المستأجر غير موجود أو نوعه غير صحيح';
  END IF;

  -- Validate property exists
  IF NOT EXISTS (
    SELECT 1 FROM public.properties WHERE id = p_property_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'العقار غير موجود';
  END IF;

  -- Validate unit belongs to property (if provided)
  IF p_unit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.units
    WHERE id = p_unit_id AND property_id = p_property_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'الوحدة لا تنتمي إلى العقار المحدد';
  END IF;

  -- Validate unit availability: no overlapping active/draft contract
  IF p_unit_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.contracts
    WHERE unit_id = p_unit_id
      AND deleted_at IS NULL
      AND status IN ('active', 'draft')
      AND start_date < p_end_date
      AND end_date > p_start_date
  ) THEN
    RAISE EXCEPTION 'الوحدة محجوزة خلال هذه الفترة';
  END IF;

  -- Validate agreement coverage (agreement_id required, must cover the full contract range)
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

  -- All validations passed — insert
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

  RETURN (SELECT to_jsonb(c) FROM public.contracts c WHERE c.id = v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text) TO authenticated;
