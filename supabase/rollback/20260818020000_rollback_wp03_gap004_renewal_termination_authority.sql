-- Manual / emergency rollback for
-- 20260818020000_wp03_gap004_renewal_termination_authority.sql.
-- Restores the exact pre-change renew_contract_atomic / terminate_contract_atomic
-- definitions. Production remains forward-only; use a new forward migration in
-- normal use.
--
-- NOTE: the restored renew_contract_atomic is reproduced verbatim from the base
-- and still references legacy columns (no, due_day, deposit, sponsor_*,
-- organization_id, commission_rate, monthly_rent) that are absent from the
-- clean migration replay. That is the pre-existing base state; this rollback
-- exists only to undo the GAP-004 hardening, not to repair legacy drift.

begin;

create or replace function public.renew_contract_atomic(old_contract_id text, new_contract_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_company_id uuid;
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

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

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
    AND company_id = v_company_id
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

  UPDATE public.contracts SET status = 'expired', updated_at = now() WHERE id::text = old_contract_id::text
    AND company_id = v_company_id;

  INSERT INTO public.contracts (no, unit_id, tenant_id, rent_amount, due_day, start_date, end_date, deposit, status, sponsor_name, sponsor_id, sponsor_phone, property_id, organization_id, payment_cycle, commission_rate, payment_terms_id, agreement_id, monthly_rent, renewed_from_id, created_at, updated_at, deleted_at, company_id)
  VALUES (v_old.no, v_old.unit_id, v_old.tenant_id, v_new_amount, v_old.due_day, v_new_start, v_new_end, COALESCE(v_old.deposit, 0), 'active', v_old.sponsor_name, v_old.sponsor_id, v_old.sponsor_phone, v_old.property_id, v_old.organization_id, v_old.payment_cycle, v_old.commission_rate, v_old.payment_terms_id, v_effective_agreement_id, v_new_amount, v_old.id, now(), now(), NULL, v_company_id)
  RETURNING id::text INTO v_new_id;

  RETURN jsonb_build_object('status', 'renewed', 'old_contract_id', old_contract_id, 'new_contract_id', v_new_id, 'agreement_id', v_effective_agreement_id);
END;
$function$;

create or replace function public.terminate_contract_atomic(p_contract_id text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
  v_old public.contracts%rowtype;
  v_cancelled_invoice_ids text[];
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنهاء عقد' using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'سبب الإنهاء مطلوب';
  end if;

  select * into v_old
  from public.contracts
  where id = p_contract_id and deleted_at is null
  for update;

  if not found then
    raise exception 'العقد غير موجود';
  end if;

  if v_old.status not in ('active', 'draft') then
    raise exception 'لا يمكن إنهاء عقد بحالته الحالية (%): يجب أن يكون نشطاً أو مسودة', v_old.status;
  end if;

  update public.contracts
  set status = 'terminated',
      cancellation_reason = p_reason,
      updated_at = now()
  where id = p_contract_id
    AND company_id = v_company_id;

  with cancelled as (
    update public.invoices
    set status = 'CANCELLED',
        updated_at = now()
    where contract_id = p_contract_id
      and deleted_at is null
      and paid_amount = 0
      and status not in ('CANCELLED', 'PAID')
      and due_date::date > current_date
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_cancelled_invoice_ids from cancelled;

  return jsonb_build_object(
    'status', 'terminated',
    'contract_id', p_contract_id,
    'cancelled_invoice_ids', to_jsonb(v_cancelled_invoice_ids)
  );
end;
$function$;

create or replace function public.activate_contract_with_agreement_snapshot_atomic(p_contract_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_contract public.contracts%rowtype;
  v_version public.owner_agreement_versions%rowtype;
  v_start date;
  v_end date;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'CONTRACT_ACTIVATION_FORBIDDEN' using errcode='42501';
  end if;

  select * into v_contract from public.contracts
  where id::text = p_contract_id and company_id=v_company and deleted_at is null
  for update;

  if not found then raise exception 'CONTRACT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if lower(coalesce(v_contract.status,'')) <> 'draft'
     or v_contract.approval_status <> 'APPROVED' then
    raise exception 'CONTRACT_APPROVAL_REQUIRED' using errcode='23514';
  end if;
  if v_contract.maker_user_id is null or v_contract.checker_user_id is null
     or v_contract.maker_user_id = v_contract.checker_user_id
     or nullif(btrim(coalesce(v_contract.maker_signature,'')), '') is null
     or nullif(btrim(coalesce(v_contract.checker_signature,'')), '') is null
     or v_contract.approved_at is null then
    raise exception 'CONTRACT_SIGNATURE_EVIDENCE_REQUIRED' using errcode='23514';
  end if;
  if v_contract.agreement_id is null then
    raise exception 'CONTRACT_AGREEMENT_REQUIRED' using errcode='23514';
  end if;
  if btrim(coalesce(v_contract.start_date::text,'')) !~ '^\d{4}-\d{2}-\d{2}$'
     or btrim(coalesce(v_contract.end_date::text,'')) !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'CONTRACT_DATES_INVALID' using errcode='22007';
  end if;

  v_start := btrim(v_contract.start_date::text)::date;
  v_end := btrim(v_contract.end_date::text)::date;

  select v.* into v_version
  from public.owner_agreement_versions v
  join public.owner_agreements oa on oa.id=v.owner_agreement_id
  where v.owner_agreement_id=v_contract.agreement_id
    and v.company_id=v_company
    and oa.company_id=v_company
    and oa.agreement_type='property_management'
    and v.effective_from <= v_start
    and (v.effective_to is null or v.effective_to >= v_end)
  order by v.version_no desc
  limit 1;

  if not found then
    raise exception 'CONTRACT_AGREEMENT_VERSION_COVERAGE_REQUIRED' using errcode='23514';
  end if;

  update public.contracts c
  set agreement_version_id=v_version.id,
      collection_role_snapshot=v_version.collection_role,
      operating_model_snapshot=v_version.operating_model,
      status='active',
      updated_at=now()
  where c.id::text=p_contract_id and c.company_id=v_company and c.deleted_at is null
  returning to_jsonb(c) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.activate_contract_with_agreement_snapshot_atomic(text) from public, anon, authenticated;
grant execute on function public.activate_contract_with_agreement_snapshot_atomic(text) to authenticated, service_role;

revoke all on function public.renew_contract_atomic(text, jsonb) from public, anon, authenticated;
grant execute on function public.renew_contract_atomic(text, jsonb) to authenticated;

revoke all on function public.terminate_contract_atomic(text, text) from public, anon, authenticated;
grant execute on function public.terminate_contract_atomic(text, text) to authenticated;

commit;
