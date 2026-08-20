-- Owner agreement and ownership temporal controls.
-- Prepared only; do not apply to production without live schema/RLS/RPC verification.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.owner_agreements
  DROP CONSTRAINT IF EXISTS owner_agreements_no_overlap;
ALTER TABLE public.owner_agreements
  ADD CONSTRAINT owner_agreements_no_overlap
  EXCLUDE USING gist (
    property_id WITH =,
    daterange(starts_on, COALESCE(ends_on, '9999-12-31'::date), '[]') WITH &&
  );

CREATE OR REPLACE FUNCTION public.assert_property_owner_temporal_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_range daterange;
  v_violation_date date;
BEGIN
  IF NEW.ownership_percentage IS NULL OR NEW.ownership_percentage <= 0 OR NEW.ownership_percentage > 100 THEN
    RAISE EXCEPTION 'نسبة الملكية يجب أن تكون أكبر من صفر وألا تتجاوز 100%%.';
  END IF;

  IF NEW.starts_on IS NOT NULL AND NEW.ends_on IS NOT NULL AND NEW.ends_on < NEW.starts_on THEN
    RAISE EXCEPTION 'تاريخ نهاية الملكية يجب ألا يسبق تاريخ البداية.';
  END IF;

  -- Serialize ownership edits for the same property. Without this lock, two
  -- concurrent inserts can both pass the percentage check before either row
  -- becomes visible to the other transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.property_id::text, 0));

  v_range := daterange(
    COALESCE(NEW.starts_on, '-infinity'::date),
    COALESCE(NEW.ends_on, '9999-12-31'::date),
    '[]'
  );

  -- The active total can only increase at the beginning of NEW or at the
  -- beginning of another overlapping ownership period. Evaluate those change
  -- points instead of summing every row that touches the whole range, which
  -- would incorrectly reject sequential, non-concurrent ownership periods.
  WITH candidate_dates AS (
    SELECT lower(v_range)::date AS effective_on
    UNION
    SELECT GREATEST(COALESCE(po.starts_on, '-infinity'::date), lower(v_range)::date)
    FROM public.property_owners po
    WHERE po.property_id = NEW.property_id
      AND po.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND daterange(
        COALESCE(po.starts_on, '-infinity'::date),
        COALESCE(po.ends_on, '9999-12-31'::date),
        '[]'
      ) && v_range
  )
  SELECT cd.effective_on
    INTO v_violation_date
  FROM candidate_dates cd
  WHERE NEW.ownership_percentage + COALESCE((
    SELECT sum(po.ownership_percentage)
    FROM public.property_owners po
    WHERE po.property_id = NEW.property_id
      AND po.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND COALESCE(po.starts_on, '-infinity'::date) <= cd.effective_on
      AND COALESCE(po.ends_on, '9999-12-31'::date) >= cd.effective_on
  ), 0) > 100
  ORDER BY cd.effective_on
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'نسب الملكية المتزامنة لهذا العقار تتجاوز 100%% بتاريخ %.', v_violation_date;
  END IF;

  IF NEW.is_primary AND EXISTS (
    SELECT 1
    FROM public.property_owners po
    WHERE po.property_id = NEW.property_id
      AND po.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND po.is_primary
      AND daterange(
        COALESCE(po.starts_on, '-infinity'::date),
        COALESCE(po.ends_on, '9999-12-31'::date),
        '[]'
      ) && v_range
  ) THEN
    RAISE EXCEPTION 'لا يمكن وجود أكثر من مالك أساسي لنفس العقار في فترة زمنية متداخلة.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_owners_temporal_integrity ON public.property_owners;
CREATE TRIGGER trg_property_owners_temporal_integrity
  BEFORE INSERT OR UPDATE OF property_id, ownership_percentage, is_primary, starts_on, ends_on ON public.property_owners
  FOR EACH ROW EXECUTE FUNCTION public.assert_property_owner_temporal_integrity();

CREATE OR REPLACE FUNCTION public.assert_owner_agreement_covers_linked_contracts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.agreement_id = OLD.id
        AND c.deleted_at IS NULL
        AND c.status IN ('draft', 'active', 'expired', 'ACTIVE')
    ) THEN
      RAISE EXCEPTION 'لا يمكن حذف اتفاقية مرتبطة بعقود محفوظة. أنهِ الاتفاقية أو أنشئ اتفاقية لاحقة دون حذف التاريخ.';
    END IF;
    RETURN OLD;
  END IF;

  SELECT c.id, c.start_date, c.end_date
    INTO v_contract
  FROM public.contracts c
  WHERE c.agreement_id = NEW.id
    AND c.deleted_at IS NULL
    AND c.status IN ('draft', 'active', 'expired', 'ACTIVE')
    AND (
      c.property_id <> NEW.property_id
      OR c.start_date::date < NEW.starts_on
      OR (NEW.ends_on IS NOT NULL AND c.end_date::date > NEW.ends_on)
    )
  ORDER BY c.start_date
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'لا يمكن تعديل اتفاقية المالك لأن العقد % يقع خارج الفترة الجديدة (% إلى %).', v_contract.id, v_contract.start_date, v_contract.end_date;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_owner_agreements_contract_coverage ON public.owner_agreements;
CREATE TRIGGER trg_owner_agreements_contract_coverage
  BEFORE UPDATE OR DELETE ON public.owner_agreements
  FOR EACH ROW EXECUTE FUNCTION public.assert_owner_agreement_covers_linked_contracts();

CREATE OR REPLACE FUNCTION public.create_owner_agreement_atomic(payload jsonb)
RETURNS public.owner_agreements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.owner_agreements%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يحتاج هذا الإجراء صلاحية مدير أو مشرف.';
  END IF;

  INSERT INTO public.owner_agreements (owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, notes)
  VALUES (
    (payload->>'owner_id')::uuid,
    payload->>'property_id',
    payload->>'agreement_type',
    payload->>'commission_type',
    (payload->>'commission_value')::numeric,
    (payload->>'starts_on')::date,
    NULLIF(payload->>'ends_on', '')::date,
    NULLIF(payload->>'notes', '')
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_owner_agreement_atomic(p_agreement_id uuid, payload jsonb)
RETURNS public.owner_agreements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.owner_agreements%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يحتاج هذا الإجراء صلاحية مدير أو مشرف.';
  END IF;

  SELECT * INTO v_row
  FROM public.owner_agreements
  WHERE id = p_agreement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'اتفاقية المالك غير موجودة.';
  END IF;

  UPDATE public.owner_agreements
  SET owner_id = COALESCE((payload->>'owner_id')::uuid, owner_id),
      agreement_type = COALESCE(NULLIF(payload->>'agreement_type', ''), agreement_type),
      commission_type = COALESCE(NULLIF(payload->>'commission_type', ''), commission_type),
      commission_value = COALESCE((payload->>'commission_value')::numeric, commission_value),
      starts_on = COALESCE((payload->>'starts_on')::date, starts_on),
      ends_on = CASE WHEN payload ? 'ends_on' THEN NULLIF(payload->>'ends_on', '')::date ELSE ends_on END,
      notes = CASE WHEN payload ? 'notes' THEN NULLIF(payload->>'notes', '') ELSE notes END,
      updated_at = now()
  WHERE id = p_agreement_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_contract_atomic(old_contract_id text, new_contract_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_new_id text;
  v_old public.contracts%rowtype;
  v_new_start text := new_contract_data ->> 'new_start';
  v_new_end text := new_contract_data ->> 'new_end';
  v_new_amount numeric := (new_contract_data ->> 'new_amount')::numeric;
  v_requested_agreement_id uuid := NULLIF(new_contract_data ->> 'agreement_id', '')::uuid;
  v_effective_agreement_id uuid;
  v_new_start_date date;
  v_new_end_date date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول';
  END IF;

  IF v_new_start IS NULL OR v_new_end IS NULL OR v_new_amount IS NULL THEN
    RAISE EXCEPTION 'new_start / new_end / new_amount مطلوبة';
  END IF;
  IF v_new_start !~ '^\d{4}-\d{2}-\d{2}$' OR v_new_end !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'تواريخ التجديد يجب أن تكون بصيغة YYYY-MM-DD';
  END IF;

  v_new_start_date := v_new_start::date;
  v_new_end_date := v_new_end::date;
  IF v_new_end_date <= v_new_start_date THEN RAISE EXCEPTION 'تاريخ نهاية التجديد يجب أن يكون بعد تاريخ البداية'; END IF;
  IF v_new_amount <= 0 THEN RAISE EXCEPTION 'قيمة الإيجار الجديدة يجب أن تكون أكبر من صفر'; END IF;

  SELECT * INTO v_old FROM public.contracts
  WHERE id::text = old_contract_id::text AND status IN ('active', 'expired', 'ACTIVE') AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'العقد الأصلي غير موجود أو لا يمكن تجديده'; END IF;

  SELECT oa.id INTO v_effective_agreement_id
  FROM public.owner_agreements oa
  WHERE oa.id = COALESCE(v_requested_agreement_id, v_old.agreement_id)
    AND oa.property_id = v_old.property_id
    AND oa.starts_on <= v_new_start_date
    AND (oa.ends_on IS NULL OR oa.ends_on >= v_new_end_date)
  LIMIT 1;

  IF v_effective_agreement_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد اتفاقية مكتب ومالك تغطي كامل فترة التجديد. اختر الاتفاقية السارية أو أنشئ اتفاقية لاحقة قبل التجديد.';
  END IF;

  IF v_old.unit_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.contracts
    WHERE unit_id = v_old.unit_id AND id::text <> old_contract_id::text
      AND status IN ('active', 'draft', 'ACTIVE') AND deleted_at IS NULL
      AND start_date::date <= v_new_end_date AND end_date::date >= v_new_start_date
  ) THEN RAISE EXCEPTION 'الوحدة محجوزة خلال فترة التجديد'; END IF;

  UPDATE public.contracts SET status = 'expired', updated_at = now() WHERE id::text = old_contract_id::text;

  INSERT INTO public.contracts (no, unit_id, tenant_id, rent_amount, due_day, start_date, end_date, deposit, status, sponsor_name, sponsor_id, sponsor_phone, property_id, organization_id, payment_cycle, commission_rate, payment_terms_id, agreement_id, monthly_rent, renewed_from_id, created_at, updated_at, deleted_at)
  VALUES (v_old.no, v_old.unit_id, v_old.tenant_id, v_new_amount, v_old.due_day, v_new_start, v_new_end, COALESCE(v_old.deposit, 0), 'active', v_old.sponsor_name, v_old.sponsor_id, v_old.sponsor_phone, v_old.property_id, v_old.organization_id, v_old.payment_cycle, v_old.commission_rate, v_old.payment_terms_id, v_effective_agreement_id, v_new_amount, v_old.id, now(), now(), NULL)
  RETURNING id::text INTO v_new_id;

  RETURN jsonb_build_object('status', 'renewed', 'old_contract_id', old_contract_id, 'new_contract_id', v_new_id, 'agreement_id', v_effective_agreement_id);
END;
$$;

ALTER FUNCTION public.create_owner_agreement_atomic(jsonb) OWNER TO postgres;
ALTER FUNCTION public.update_owner_agreement_atomic(uuid, jsonb) OWNER TO postgres;
ALTER FUNCTION public.renew_contract_atomic(text, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_owner_agreement_atomic(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_owner_agreement_atomic(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.renew_contract_atomic(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_owner_agreement_atomic(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_owner_agreement_atomic(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.renew_contract_atomic(text, jsonb) TO authenticated, service_role;