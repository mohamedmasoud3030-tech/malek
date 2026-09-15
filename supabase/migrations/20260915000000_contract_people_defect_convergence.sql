-- MALEK production-defect convergence: contract determinism, person lifecycle,
-- capability-correct direct writes, and normalized identity safeguards.
--
-- No live business rows are inserted or backfilled here. Duplicate preflight is
-- intentionally fail-closed; any live cleanup must be separately evidenced and
-- dependency-safe before this migration is applied.

begin;

drop function if exists public.create_contract_atomic_v2(
  text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text,
  text, integer, integer, text, numeric
);

CREATE OR REPLACE FUNCTION "public"."create_contract_atomic_v2"(
  "p_property_id" "text",
  "p_unit_id" "uuid",
  "p_tenant_id" "uuid",
  "p_agreement_id" "uuid",
  "p_start_date" "date",
  "p_end_date" "date",
  "p_rent_amount" numeric,
  "p_payment_cycle" "text",
  "p_payment_terms_id" "uuid",
  "p_status" "text",
  "p_cancellation_reason" "text",
  "p_notes" "text",
  "p_attachment_url" "text",
  "p_billing_day" integer DEFAULT 1,
  "p_grace_days" integer DEFAULT 0,
  "p_lease_mode" "text" DEFAULT 'long_term',
  "p_daily_reference_rate" numeric DEFAULT NULL,
  "p_request_id" "text" DEFAULT NULL
) RETURNS "jsonb"
  LANGUAGE "plpgsql" SECURITY DEFINER
  SET "search_path" TO 'public', 'pg_temp'
  AS $_$
declare
  v_company_id uuid;
  v_contract_id public.contracts.id%type;
  v_property_id public.contracts.property_id%type;
  v_unit_id public.contracts.unit_id%type;
  v_tenant_id public.contracts.tenant_id%type;
  v_agreement_id public.contracts.agreement_id%type;
  v_payment_terms_id public.contracts.payment_terms_id%type;
  v_start_date public.contracts.start_date%type;
  v_end_date public.contracts.end_date%type;
  v_lease_mode public.contracts.lease_mode%type;
  v_request_id text;
  v_operation_name text;
  v_request_fingerprint text;
  v_cached jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not public.current_user_has_effective_app_permission('contracts.create') then
    raise exception 'غير مصرح: لا تملك صلاحية إنشاء العقد' using errcode = '42501';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'سياق الشركة مطلوب لإنشاء العقد' using errcode = '42501';
  end if;

  v_request_id := nullif(btrim(p_request_id), '');
  if v_request_id is null then
    -- Legacy callers remain valid, but browser retries always provide a stable
    -- request id from the form mutation boundary.
    v_request_id := gen_random_uuid()::text;
  end if;
  if length(v_request_id) > 200 then
    raise exception 'CONTRACT_REQUEST_ID_INVALID: معرّف الطلب طويل جداً' using errcode = '22023';
  end if;
  v_operation_name := 'create_contract_atomic_v2:' || v_company_id::text;
  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'property_id', p_property_id,
    'unit_id', p_unit_id,
    'tenant_id', p_tenant_id,
    'agreement_id', p_agreement_id,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'rent_amount', p_rent_amount,
    'payment_cycle', p_payment_cycle,
    'payment_terms_id', p_payment_terms_id,
    'status', p_status,
    'cancellation_reason', p_cancellation_reason,
    'notes', p_notes,
    'attachment_url', p_attachment_url,
    'billing_day', p_billing_day,
    'grace_days', p_grace_days,
    'lease_mode', p_lease_mode,
    'daily_reference_rate', p_daily_reference_rate
  )::text, 'UTF8')), 'hex');

  -- The request lock closes the race between two retries before the unique
  -- idempotency key is inserted. A reused key is accepted only for the exact
  -- same command payload; this prevents a stale retry from returning another
  -- contract's result.
  perform pg_advisory_xact_lock(hashtextextended(v_operation_name || ':' || v_request_id, 0));
  select response_payload into v_cached
    from public.financial_operation_idempotency
   where operation_name = v_operation_name
     and request_id = v_request_id
   for update;
  if v_cached is not null then
    if v_cached->>'_request_fingerprint' is distinct from v_request_fingerprint
       or not (v_cached ? 'response') then
      raise exception 'CONTRACT_CREATE_IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        using errcode = '22023';
    end if;
    return (v_cached->'response') || jsonb_build_object('idempotent', true);
  end if;

  v_property_id := p_property_id;
  v_unit_id := p_unit_id;
  v_tenant_id := p_tenant_id;
  v_agreement_id := p_agreement_id;
  v_payment_terms_id := p_payment_terms_id;
  v_start_date := p_start_date;
  v_end_date := p_end_date;
  v_lease_mode := coalesce(lower(btrim(p_lease_mode)), 'long_term');

  if p_start_date is null or p_end_date is null or p_end_date <= p_start_date then
    raise exception 'تاريخ نهاية العقد يجب أن يكون بعد تاريخ البداية';
  end if;
  if p_rent_amount is null or p_rent_amount <= 0 then
    raise exception 'قيمة الإيجار يجب أن تكون أكبر من صفر';
  end if;
  if p_status not in ('draft', 'active', 'expired', 'terminated') then
    raise exception 'حالة العقد غير مدعومة';
  end if;
  if lower(coalesce(p_status, '')) <> 'draft' then
    raise exception 'CONTRACT_CREATE_MUST_BE_DRAFT' using errcode = '23514';
  end if;
  if p_payment_cycle not in ('monthly', 'quarterly', 'semi_annual', 'annual') then
    raise exception 'دورة السداد غير مدعومة';
  end if;
  if p_billing_day is null or p_billing_day < 1 or p_billing_day > 28 then
    raise exception 'CONTRACT_BILLING_DAY_INVALID: يوم الفوترة يجب أن يكون بين 1 و28' using errcode = '23514';
  end if;
  if p_grace_days is null or p_grace_days < 0 or p_grace_days > 90 then
    raise exception 'CONTRACT_GRACE_DAYS_INVALID: أيام السماح يجب أن تكون بين 0 و90' using errcode = '23514';
  end if;
  if v_lease_mode not in ('long_term', 'short_stay') then
    raise exception 'CONTRACT_LEASE_MODE_INVALID: نوع العقد يجب أن يكون إيجاراً طويل المدى أو إقامة قصيرة' using errcode = '23514';
  end if;
  if v_lease_mode = 'long_term' and p_daily_reference_rate is not null then
    raise exception 'CONTRACT_DAILY_RATE_REQUIRES_SHORT_STAY: سعر اليوم المرجعي خاص بعقود الإقامة القصيرة' using errcode = '23514';
  end if;
  if p_daily_reference_rate is not null and (
    p_daily_reference_rate < 0 or round(p_daily_reference_rate, 3) <> p_daily_reference_rate
  ) then
    raise exception 'CONTRACT_DAILY_RATE_OMR_3DP_INVALID: سعر اليوم المرجعي يجب أن يكون قيمة غير سالبة بدقة ثلاث خانات عشرية' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.people person_record
    where person_record.id::text = v_tenant_id::text
      and person_record.type = 'tenant'
      and person_record.company_id = v_company_id
      and person_record.deleted_at is null
  ) then
    raise exception 'المستأجر غير موجود أو نوعه غير صحيح';
  end if;

  if not exists (
    select 1 from public.properties property_record
    where property_record.id::text = v_property_id::text
      and property_record.company_id = v_company_id
      and property_record.deleted_at is null
  ) then
    raise exception 'العقار غير موجود';
  end if;

  if not exists (
    select 1 from public.units unit_record
    where unit_record.id::text = v_unit_id::text
      and unit_record.company_id = v_company_id
      and unit_record.property_id::text = v_property_id::text
      and unit_record.deleted_at is null
  ) then
    raise exception 'الوحدة غير موجودة أو لا تتبع العقار المحدد';
  end if;

  if exists (
    select 1 from public.units unit_record
    where unit_record.id::text = v_unit_id::text
      and lower(unit_record.status) in ('maintenance', 'reserved')
  ) then
    raise exception 'لا يمكن إنشاء عقد على وحدة تحت الصيانة أو محجوزة تشغيلياً';
  end if;

  -- Restored GAP-004 guard: reject inclusive date overlaps with any live
  -- draft/active contract on the same unit (defensive against text-typed
  -- live date columns; the DB exclusion constraint remains the last line).
  -- Serialize all writers targeting this unit before evaluating the
  -- overlap and one-live-draft invariants. The exclusion/unique indexes remain
  -- the final database backstop, while this lock makes the RPC decision
  -- deterministic under concurrent browser retries.
  perform pg_advisory_xact_lock(hashtextextended(
    'contract_unit:' || v_company_id::text || ':' || coalesce(v_unit_id::text, ''), 0
  ));

  if exists (
    select 1 from public.contracts contract_record
    where contract_record.unit_id::text = v_unit_id::text
      and contract_record.company_id = v_company_id
      and contract_record.deleted_at is null
      and lower(contract_record.status) in ('active', 'draft')
      and btrim(coalesce(contract_record.start_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
      and btrim(coalesce(contract_record.end_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
      and btrim(contract_record.start_date::text)::date <= p_end_date
      and btrim(contract_record.end_date::text)::date >= p_start_date
  ) then
    raise exception 'الوحدة محجوزة خلال هذه الفترة';
  end if;

  if v_agreement_id is null or not exists (
    select 1 from public.owner_agreements agreement_record
    where agreement_record.id::text = v_agreement_id::text
      and agreement_record.company_id = v_company_id
      and agreement_record.property_id::text = v_property_id::text
      and agreement_record.starts_on <= p_start_date
      and (agreement_record.ends_on is null or agreement_record.ends_on >= p_end_date)
  ) then
    raise exception 'اتفاقية المالك لا تغطي فترة العقد بالكامل أو لا تنتمي لهذا العقار';
  end if;

  insert into public.contracts (
    property_id, unit_id, tenant_id, agreement_id, start_date, end_date,
    rent_amount, payment_cycle, payment_terms_id, status, company_id,
    cancellation_reason, notes, attachment_url, billing_day, grace_days,
    lease_mode, daily_reference_rate
  ) values (
    v_property_id, v_unit_id, v_tenant_id, v_agreement_id,
    v_start_date, v_end_date, p_rent_amount,
    p_payment_cycle, v_payment_terms_id, p_status, v_company_id,
    p_cancellation_reason, p_notes, p_attachment_url, p_billing_day, p_grace_days,
    v_lease_mode, p_daily_reference_rate
  )
  returning id into v_contract_id;

  v_result := (select to_jsonb(c) from public.contracts c where c.id::text = v_contract_id::text)
    || jsonb_build_object('idempotent', false);

  insert into public.financial_operation_idempotency(operation_name, request_id, response_payload)
  values (
    v_operation_name,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_request_fingerprint,
      'response', v_result
    )
  );

  return v_result;
end;
$_$;

CREATE OR REPLACE FUNCTION "public"."update_contract_atomic_v2"(
  "p_contract_id" "text",
  "p_property_id" "text",
  "p_unit_id" "uuid",
  "p_tenant_id" "uuid",
  "p_agreement_id" "uuid",
  "p_start_date" "date",
  "p_end_date" "date",
  "p_rent_amount" numeric,
  "p_payment_cycle" "text",
  "p_payment_terms_id" "uuid",
  "p_status" "text",
  "p_cancellation_reason" "text",
  "p_notes" "text",
  "p_attachment_url" "text",
  "p_lease_mode" "text" DEFAULT 'long_term',
  "p_daily_reference_rate" numeric DEFAULT NULL
) RETURNS "jsonb"
  LANGUAGE "plpgsql" SECURITY DEFINER
  SET "search_path" TO 'public', 'pg_temp'
  AS $_$
declare
  v_company_id uuid;
  v_old public.contracts%rowtype;
  v_property_id public.contracts.property_id%type;
  v_unit_id public.contracts.unit_id%type;
  v_tenant_id public.contracts.tenant_id%type;
  v_agreement_id public.contracts.agreement_id%type;
  v_payment_terms_id public.contracts.payment_terms_id%type;
  v_result jsonb;
  v_lease_mode public.contracts.lease_mode%type;
begin
  if auth.uid() is null or not public.current_user_has_effective_app_permission('contracts.edit') then
    raise exception 'غير مصرح: لا تملك صلاحية تعديل العقد'
      using errcode = '42501';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'سياق الشركة مطلوب لتعديل العقد'
      using errcode = '42501';
  end if;

  -- Assignment through destination-column types keeps this RPC compatible
  -- with both the clean UUID replay and the live text compatibility schema.
  v_property_id := p_property_id;
  v_unit_id := p_unit_id;
  v_tenant_id := p_tenant_id;
  v_agreement_id := p_agreement_id;
  v_payment_terms_id := p_payment_terms_id;
  v_lease_mode := coalesce(lower(btrim(p_lease_mode)), 'long_term');

  select *
    into v_old
  from public.contracts
  where id::text = p_contract_id
    and company_id = v_company_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'العقد غير موجود'
      using errcode = 'P0002';
  end if;

  if v_old.unit_id is not null and v_unit_id is not null
     and v_old.unit_id::text is distinct from v_unit_id::text then
    if v_old.unit_id::text < v_unit_id::text then
      perform pg_advisory_xact_lock(hashtextextended(
        'contract_unit:' || v_company_id::text || ':' || v_old.unit_id::text, 0
      ));
      perform pg_advisory_xact_lock(hashtextextended(
        'contract_unit:' || v_company_id::text || ':' || v_unit_id::text, 0
      ));
    else
      perform pg_advisory_xact_lock(hashtextextended(
        'contract_unit:' || v_company_id::text || ':' || v_unit_id::text, 0
      ));
      perform pg_advisory_xact_lock(hashtextextended(
        'contract_unit:' || v_company_id::text || ':' || v_old.unit_id::text, 0
      ));
    end if;
  else
    perform pg_advisory_xact_lock(hashtextextended(
      'contract_unit:' || v_company_id::text || ':' || coalesce(v_unit_id::text, ''), 0
    ));
  end if;

  if lower(coalesce(v_old.status, '')) = 'terminated'
     and lower(coalesce(p_status, '')) <> 'terminated' then
    raise exception 'لا يمكن إعادة فتح عقد تم إنهاؤه بالفعل';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date <= p_start_date then
    raise exception 'تاريخ نهاية العقد يجب أن يكون بعد تاريخ البداية';
  end if;
  if p_rent_amount is null or p_rent_amount <= 0 then
    raise exception 'قيمة الإيجار يجب أن تكون أكبر من صفر';
  end if;
  if lower(coalesce(p_status, '')) not in ('draft', 'active', 'expired', 'terminated') then
    raise exception 'حالة العقد غير مدعومة';
  end if;
  if p_payment_cycle not in ('monthly', 'quarterly', 'semi_annual', 'annual') then
    raise exception 'دورة السداد غير مدعومة';
  end if;
  if v_lease_mode not in ('long_term', 'short_stay') then
    raise exception 'CONTRACT_LEASE_MODE_INVALID: نوع العقد يجب أن يكون إيجاراً طويل المدى أو إقامة قصيرة' using errcode = '23514';
  end if;
  if v_lease_mode = 'long_term' and p_daily_reference_rate is not null then
    raise exception 'CONTRACT_DAILY_RATE_REQUIRES_SHORT_STAY: سعر اليوم المرجعي خاص بعقود الإقامة القصيرة' using errcode = '23514';
  end if;
  if p_daily_reference_rate is not null and (
    p_daily_reference_rate < 0 or round(p_daily_reference_rate, 3) <> p_daily_reference_rate
  ) then
    raise exception 'CONTRACT_DAILY_RATE_OMR_3DP_INVALID: سعر اليوم المرجعي يجب أن يكون قيمة غير سالبة بدقة ثلاث خانات عشرية' using errcode = '23514';
  end if;

  if v_unit_id::text is distinct from v_old.unit_id::text and exists (
    select 1
    from public.units u
    where u.id::text = v_unit_id::text
      and u.company_id = v_company_id
      and u.deleted_at is null
      and lower(u.status) in ('maintenance', 'reserved')
  ) then
    raise exception 'لا يمكن نقل العقد إلى وحدة تحت الصيانة أو محجوزة تشغيلياً';
  end if;

  if exists (
    select 1
    from public.contracts contract_record
    where contract_record.unit_id::text = v_unit_id::text
      and contract_record.id::text <> p_contract_id
      and contract_record.company_id = v_company_id
      and contract_record.deleted_at is null
      and lower(contract_record.status) in ('active', 'draft')
      and btrim(coalesce(contract_record.start_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
      and btrim(coalesce(contract_record.end_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
      and btrim(contract_record.start_date::text)::date <= p_end_date
      and btrim(contract_record.end_date::text)::date >= p_start_date
  ) then
    raise exception 'الوحدة محجوزة خلال هذه الفترة';
  end if;

  -- GAP-004 hardening: the canonical lifecycle owns status transitions, and
  -- signed/approved commercial terms are never silently overwritten.
  --
  -- a) Company isolation: every referenced entity must belong to the current
  --    company and the agreement must belong to the selected property. UUID
  --    secrecy is never relied upon (SEC-003).
  if not exists (
    select 1 from public.people person_ref
    where person_ref.id::text = v_tenant_id::text
      and person_ref.company_id = v_company_id
      and person_ref.type = 'tenant'
      and person_ref.deleted_at is null
  ) then
    raise exception 'CONTRACT_REFERENCE_CROSS_COMPANY'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.properties property_ref
    where property_ref.id::text = v_property_id::text
      and property_ref.company_id = v_company_id
      and property_ref.deleted_at is null
  ) then
    raise exception 'CONTRACT_REFERENCE_CROSS_COMPANY'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.units unit_ref
    where unit_ref.id::text = v_unit_id::text
      and unit_ref.company_id = v_company_id
      and unit_ref.property_id::text = v_property_id::text
      and unit_ref.deleted_at is null
  ) then
    raise exception 'CONTRACT_REFERENCE_CROSS_COMPANY'
      using errcode = '42501';
  end if;
  if v_agreement_id is null or not exists (
    select 1 from public.owner_agreements agreement_ref
    where agreement_ref.id::text = v_agreement_id::text
      and agreement_ref.company_id = v_company_id
      and agreement_ref.property_id::text = v_property_id::text
      and agreement_ref.starts_on <= p_start_date
      and (agreement_ref.ends_on is null or agreement_ref.ends_on >= p_end_date)
  ) then
    raise exception 'CONTRACT_REFERENCE_CROSS_COMPANY'
      using errcode = '42501';
  end if;

  -- b) Lifecycle state is preserved by generic editing. The only status value a
  --    generic edit may supply is the contract's current status; every other
  --    transition is owned by a dedicated command (the activation RPC,
  --    terminate_contract_atomic, the controlled renewal workflow, or the
  --    submit/approve/reject RPCs). This makes draft->expired, draft->terminated,
  --    terminated->active, active->draft, active->expired and approved-draft
  --    status flips all fail closed through the generic editor.
  if lower(coalesce(p_status, '')) <> lower(coalesce(v_old.status, '')) then
    if lower(coalesce(v_old.status, '')) = 'active' then
      raise exception 'CONTRACT_ACTIVE_STATUS_IMMUTABLE'
        using errcode = '23514';
    elsif lower(coalesce(p_status, '')) = 'active' then
      raise exception 'CONTRACT_ACTIVATION_VIA_RPC'
        using errcode = '23514';
    else
      raise exception 'CONTRACT_LIFECYCLE_STATUS_IMMUTABLE'
        using errcode = '23514';
    end if;
  end if;

  -- c) Signed/approved commercial terms are never silently overwritten. An
  --    active or APPROVED contract's material terms are frozen; changes flow
  --    through reject/re-submit, termination or the renewal/amendment workflow.
  --    The lease mode and reference daily rate are commercial terms too.
  if lower(coalesce(v_old.status, '')) = 'active'
     and (
       v_property_id::text is distinct from v_old.property_id::text
       or v_unit_id::text is distinct from v_old.unit_id::text
       or v_tenant_id::text is distinct from v_old.tenant_id::text
       or v_agreement_id::text is distinct from v_old.agreement_id::text
       or btrim(coalesce(p_start_date::text, '')) is distinct from btrim(coalesce(v_old.start_date::text, ''))
       or btrim(coalesce(p_end_date::text, '')) is distinct from btrim(coalesce(v_old.end_date::text, ''))
       or p_rent_amount is distinct from v_old.rent_amount
       or p_payment_cycle is distinct from v_old.payment_cycle
       or v_payment_terms_id::text is distinct from v_old.payment_terms_id::text
       or v_lease_mode is distinct from coalesce(v_old.lease_mode, 'long_term')
       or p_daily_reference_rate is distinct from v_old.daily_reference_rate
     ) then
    raise exception 'CONTRACT_SIGNED_TERMS_IMMUTABLE'
      using errcode = '23514';
  elsif coalesce(v_old.approval_status, '') = 'APPROVED'
    and (
      v_property_id::text is distinct from v_old.property_id::text
      or v_unit_id::text is distinct from v_old.unit_id::text
      or v_tenant_id::text is distinct from v_old.tenant_id::text
      or v_agreement_id::text is distinct from v_old.agreement_id::text
      or btrim(coalesce(p_start_date::text, '')) is distinct from btrim(coalesce(v_old.start_date::text, ''))
      or btrim(coalesce(p_end_date::text, '')) is distinct from btrim(coalesce(v_old.end_date::text, ''))
      or p_rent_amount is distinct from v_old.rent_amount
      or p_payment_cycle is distinct from v_old.payment_cycle
      or v_payment_terms_id::text is distinct from v_old.payment_terms_id::text
      or v_lease_mode is distinct from coalesce(v_old.lease_mode, 'long_term')
      or p_daily_reference_rate is distinct from v_old.daily_reference_rate
    ) then
    raise exception 'CONTRACT_APPROVED_TERMS_IMMUTABLE'
      using errcode = '23514';
  end if;

  update public.contracts as contract_record
  set
    property_id = v_property_id,
    unit_id = v_unit_id,
    tenant_id = v_tenant_id,
    agreement_id = v_agreement_id,
    start_date = p_start_date,
    end_date = p_end_date,
    rent_amount = p_rent_amount,
    payment_cycle = p_payment_cycle,
    payment_terms_id = v_payment_terms_id,
    status = lower(p_status),
    cancellation_reason = nullif(btrim(p_cancellation_reason), ''),
    notes = nullif(btrim(p_notes), ''),
    attachment_url = nullif(btrim(p_attachment_url), ''),
    lease_mode = v_lease_mode,
    daily_reference_rate = p_daily_reference_rate,
    updated_at = now()
  where contract_record.id::text = p_contract_id
    and contract_record.company_id = v_company_id
    and contract_record.deleted_at is null
  returning to_jsonb(contract_record) into v_result;

  if v_result is null then
    raise exception 'العقد غير موجود'
      using errcode = 'P0002';
  end if;

  return v_result;
end;
$_$;

create or replace function public.update_contract_with_billing_atomic(
  p_contract_id text,
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
  p_attachment_url text,
  p_billing_day integer,
  p_grace_days integer,
  p_lease_mode text default 'long_term',
  p_daily_reference_rate numeric default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null
     or not public.current_user_has_effective_app_permission('contracts.edit') then
    raise exception 'غير مصرح: لا تملك صلاحية تعديل العقد' using errcode = '42501';
  end if;

  -- Both calls execute inside this one request transaction. If the general
  -- contract edit fails, the billing-policy update is rolled back as well.
  perform public.update_contract_billing_policy_atomic(
    p_contract_id, p_billing_day, p_grace_days
  );
  v_result := public.update_contract_atomic_v2(
    p_contract_id, p_property_id, p_unit_id, p_tenant_id, p_agreement_id,
    p_start_date, p_end_date, p_rent_amount, p_payment_cycle,
    p_payment_terms_id, p_status, p_cancellation_reason, p_notes,
    p_attachment_url, p_lease_mode, p_daily_reference_rate
  );
  return v_result;
end;
$function$;

alter function public.update_contract_with_billing_atomic(
  text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text,
  text, text, text, integer, integer, text, numeric
) owner to postgres;

revoke all on function public.update_contract_with_billing_atomic(
  text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text,
  text, text, text, integer, integer, text, numeric
) from public;
grant all on function public.update_contract_with_billing_atomic(
  text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text,
  text, text, text, integer, integer, text, numeric
) to authenticated;
grant all on function public.update_contract_with_billing_atomic(
  text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text,
  text, text, text, integer, integer, text, numeric
) to service_role;


create or replace function public.terminate_contract_atomic(
  p_contract_id text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
  v_old public.contracts%rowtype;
  v_cancelled_invoice_ids text[];
begin
  if auth.uid() is null or not public.current_user_has_effective_app_permission('contracts.cancel') then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنهاء عقد' using errcode = '42501';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'سياق الشركة مطلوب لإنهاء العقد' using errcode = '42501';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'سبب الإنهاء مطلوب';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'contract_terminate:' || v_company_id::text || ':' || p_contract_id, 0
  ));

  select * into v_old
  from public.contracts
  where id::text = p_contract_id
    and company_id = v_company_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'العقد غير موجود' using errcode = '42501';
  end if;

  if lower(coalesce(v_old.status, '')) not in ('active', 'draft') then
    raise exception 'لا يمكن إنهاء عقد بحالته الحالية (%): يجب أن يكون نشطاً أو مسودة', v_old.status;
  end if;

  update public.contracts
  set status = 'terminated',
      cancellation_reason = p_reason,
      updated_at = now()
  where id::text = p_contract_id
    and company_id = v_company_id;

  with cancelled as (
    update public.invoices
    set status = 'CANCELLED',
        updated_at = now()
    where contract_id::text = p_contract_id
      and company_id = v_company_id
      and deleted_at is null
      and paid_amount = 0
      and status not in ('CANCELLED', 'PAID')
      and due_date::date > current_date
    returning id
  )
  select coalesce(array_agg(id::text), '{}')
    into v_cancelled_invoice_ids
  from cancelled;

  return jsonb_build_object(
    'status', 'terminated',
    'contract_id', p_contract_id,
    'cancelled_invoice_ids', to_jsonb(v_cancelled_invoice_ids)
  );
end;
$function$;


-- ---------------------------------------------------------------------------
-- People identity/lifecycle hardening.
-- Direct person writes stay direct PostgREST writes, but the database owns
-- normalization, duplicate prevention, archive safety, and capability gates.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_person_identity_text(p_value text)
returns text
language sql
immutable
parallel safe
set search_path to 'public', 'pg_temp'
as $function$
  select lower(regexp_replace(
    translate(
      regexp_replace(btrim(coalesce(p_value, '')), '[ًٌٍَُِّْـ]', '', 'g'),
      'أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      'اااايهوي01234567890123456789'
    ),
    '[[:space:][:punct:]]', '', 'g'
  ));
$function$;

create or replace function public.normalize_person_phone(p_value text)
returns text
language plpgsql
immutable
parallel safe
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_digits text;
begin
  v_digits := regexp_replace(translate(coalesce(p_value, ''),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[^0-9]', '', 'g');
  if v_digits ~ '^968([0-9]{8})$' then
    return substr(v_digits, 4);
  end if;
  return nullif(v_digits, '');
end;
$function$;

-- Index expressions are evaluated in the caller's INSERT/UPDATE statement;
-- permit the controlled browser role to execute only these pure normalizers.
revoke all on function public.normalize_person_identity_text(text) from public;
grant execute on function public.normalize_person_identity_text(text) to authenticated, service_role;
revoke all on function public.normalize_person_phone(text) from public;
grant execute on function public.normalize_person_phone(text) to authenticated, service_role;

-- Fail closed rather than silently choosing a canonical person when legacy
-- live data already collides after normalization. A separately evidenced,
-- dependency-safe cleanup must precede this migration in that environment.
do $preflight$
begin
  if exists (
    select 1
      from public.people
     where deleted_at is null
       and nullif(public.normalize_person_identity_text(full_name), '') is not null
       and nullif(public.normalize_person_phone(phone), '') is not null
     group by company_id,
              public.normalize_person_identity_text(full_name),
              public.normalize_person_phone(phone)
    having count(*) > 1
  ) then
    raise exception 'PEOPLE_DUPLICATE_NAME_PHONE_NORMALIZATION_PRECONDITION';
  end if;
  if exists (
    select 1
      from public.people
     where deleted_at is null
       and nullif(public.normalize_person_identity_text(national_id), '') is not null
     group by company_id, public.normalize_person_identity_text(national_id)
    having count(*) > 1
  ) then
    raise exception 'PEOPLE_DUPLICATE_NATIONAL_ID_NORMALIZATION_PRECONDITION';
  end if;
  if exists (
    select 1
      from public.people
     where deleted_at is null
       and nullif(lower(regexp_replace(btrim(coalesce(email, '')), '[[:space:]]+', '', 'g')), '') is not null
     group by company_id, lower(regexp_replace(btrim(coalesce(email, '')), '[[:space:]]+', '', 'g'))
    having count(*) > 1
  ) then
    raise exception 'PEOPLE_DUPLICATE_EMAIL_NORMALIZATION_PRECONDITION';
  end if;
end
$preflight$;

create unique index if not exists people_live_name_phone_uidx
  on public.people (
    company_id,
    public.normalize_person_identity_text(full_name),
    public.normalize_person_phone(phone)
  )
  where deleted_at is null
    and nullif(public.normalize_person_identity_text(full_name), '') is not null
    and nullif(public.normalize_person_phone(phone), '') is not null;

create unique index if not exists people_live_national_id_uidx
  on public.people (
    company_id,
    public.normalize_person_identity_text(national_id)
  )
  where deleted_at is null
    and nullif(public.normalize_person_identity_text(national_id), '') is not null;

create unique index if not exists people_live_email_uidx
  on public.people (
    company_id,
    lower(regexp_replace(btrim(coalesce(email, '')), '[[:space:]]+', '', 'g'))
  )
  where deleted_at is null
    and nullif(lower(regexp_replace(btrim(coalesce(email, '')), '[[:space:]]+', '', 'g')), '') is not null;

create or replace function public.guard_people_archive_history()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if old.deleted_at is null and new.deleted_at is not null
     and exists (
       select 1
         from public.contracts c
        where c.tenant_id = old.id
          and c.deleted_at is null
          and lower(coalesce(c.status, '')) in ('draft', 'active')
     ) then
    raise exception 'PERSON_ARCHIVE_BLOCKED_LIVE_CONTRACT: لا يمكن أرشفة شخص مرتبط بعقد نشط أو مسودة؛ أنهِ أو أرشف العقد أولاً.'
      using errcode = '23514';
  end if;
  return new;
end;
$function$;

create or replace trigger people_archive_guard
before update of deleted_at on public.people
for each row execute function public.guard_people_archive_history();

-- Replace the broad legacy manager policy. Read scope remains unchanged; each
-- direct mutation now maps to the same capability vocabulary used by routes
-- and governed contract commands. Hard DELETE is deliberately not granted.
drop policy if exists manager_write_people on public.people;
create policy people_create_capability on public.people
  for insert to authenticated
  with check (
    company_id = public.require_company_id()
    and public.current_user_has_effective_app_permission('contracts.create')
  );
create policy people_update_capability on public.people
  for update to authenticated
  using (
    company_id = public.require_company_id()
    and deleted_at is null
    and (
      public.current_user_has_effective_app_permission('contracts.edit')
      or public.current_user_has_effective_app_permission('contracts.cancel')
    )
  )
  with check (
    company_id = public.require_company_id()
    and (
      (deleted_at is null and public.current_user_has_effective_app_permission('contracts.edit'))
      or (deleted_at is not null and public.current_user_has_effective_app_permission('contracts.cancel'))
    )
  );
revoke delete, truncate on table public.people from anon, authenticated;
grant insert, update on table public.people to authenticated;



-- Public RPC ACLs after signature changes.
revoke all on function public.create_contract_atomic_v2(
  text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text,
  text, integer, integer, text, numeric, text
) from public;
grant all on function public.create_contract_atomic_v2(
  text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text,
  text, integer, integer, text, numeric, text
) to authenticated;
grant all on function public.create_contract_atomic_v2(
  text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text,
  text, integer, integer, text, numeric, text
) to service_role;

revoke all on function public.update_contract_atomic_v2(
  text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text,
  text, text, text, numeric
) from public;
grant all on function public.update_contract_atomic_v2(
  text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text,
  text, text, text, numeric
) to authenticated;
grant all on function public.update_contract_atomic_v2(
  text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text,
  text, text, text, numeric
) to service_role;

notify pgrst, 'reload schema';


commit;
