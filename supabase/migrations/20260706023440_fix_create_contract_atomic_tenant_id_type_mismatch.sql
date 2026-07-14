-- people.id is text, but create_contract_atomic(p_tenant_id uuid) compared
-- id = p_tenant_id directly, which has no text/uuid operator and raised a
-- hard error on every single call (verified: 0 contracts exist on
-- production - contract creation has never once succeeded). The final
-- `WHERE c.id = v_id` had the same issue (c.id text vs v_id uuid). Same
-- class of bug as renew_contract_atomic / void_receipt_atomic. Signature is
-- unchanged (no overload risk) - only the internal comparisons get an
-- explicit cast.

create or replace function public.create_contract_atomic(p_property_id text, p_unit_id uuid, p_tenant_id uuid, p_agreement_id uuid, p_start_date date, p_end_date date, p_rent_amount numeric, p_payment_cycle text, p_payment_terms_id uuid, p_status text, p_cancellation_reason text, p_notes text, p_attachment_url text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_id public.contracts.id%TYPE;
  v_property_id public.contracts.property_id%TYPE;
  v_unit_id public.contracts.unit_id%TYPE;
  v_tenant_id public.contracts.tenant_id%TYPE;
  v_agreement_id public.contracts.agreement_id%TYPE;
BEGIN
  -- Assign through the target column types so the clean UUID baseline and the
  -- historical text capture share the same function body.
  v_property_id := p_property_id;
  v_unit_id := p_unit_id;
  v_tenant_id := p_tenant_id;
  v_agreement_id := p_agreement_id;

  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عقد' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.people
    WHERE id = v_tenant_id AND type = 'tenant' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'المستأجر غير موجود أو نوعه غير صحيح';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.properties WHERE id = v_property_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'العقار غير موجود';
  END IF;

  IF p_unit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.units
    WHERE id = v_unit_id AND property_id = v_property_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'الوحدة لا تنتمي إلى العقار المحدد';
  END IF;

  IF p_unit_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.contracts
    WHERE unit_id = v_unit_id
      AND deleted_at IS NULL
      AND status IN ('active', 'draft')
      AND start_date < p_end_date
      AND end_date > p_start_date
  ) THEN
    RAISE EXCEPTION 'الوحدة محجوزة خلال هذه الفترة';
  END IF;

  IF p_agreement_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد اتفاقية مالك نشطة تغطي فترة العقد — أنشئ اتفاقية مالك أولاً';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.owner_agreements
    WHERE id = v_agreement_id
      AND property_id = v_property_id
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
    v_property_id, v_unit_id, v_tenant_id, v_agreement_id,
    p_start_date, p_end_date, p_rent_amount, p_payment_cycle,
    p_payment_terms_id, p_status, p_cancellation_reason, p_notes, p_attachment_url
  )
  RETURNING id INTO v_id;

  RETURN (SELECT to_jsonb(c) FROM public.contracts c WHERE c.id = v_id);
END;
$function$;
