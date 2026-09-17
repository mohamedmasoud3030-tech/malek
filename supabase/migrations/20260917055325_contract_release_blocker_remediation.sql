-- Release-blocker remediation for PR #1825.
--
-- This forward-only migration is intentionally separate from
-- 20260915000000_contract_people_defect_convergence so an environment that
-- already applied the earlier migration receives the corrected expression
-- index and the canonical legacy RPC boundaries as well.
--
-- Scope:
--   1. Canonicalize all accepted Oman dialing forms, then preflight and rebuild
--      the expression index that depends on normalize_person_phone.
--   2. Keep legacy contract RPC signatures for existing internal callers, but
--      route create/update through the locked v2 commands and harden renewal
--      with the same company, unit, lifecycle, overlap, and idempotency rules.
--
-- No business rows are inserted, merged, deleted, or rewritten here.
--
-- LEDGER NOTE: this file was originally drafted as
-- 20260915000001_contract_release_blocker_remediation.sql (a planning
-- timestamp) and applied to production nnggcnpcuomwfuupupwg via
-- apply_migration on 2026-09-17, which assigned it the live version
-- '20260917055325'. Renamed here to that exact version per the
-- reconciliation precedent in this directory's README.md ("2026-07-18
-- canonical ledger reconciliation"). Verified live immediately after apply:
-- create_contract_atomic contains the 'legacy:' request-id marker and
-- delegates to create_contract_atomic_v2; people_live_name_phone_uidx exists
-- on the corrected normalize_person_phone.

begin;

-- ---------------------------------------------------------------------------
-- B1: corrected Oman phone canonicalization and expression-index rebuild.
-- ---------------------------------------------------------------------------
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
  -- Only exact Oman prefixes are collapsed. Other international numbers remain
  -- digit-preserving values rather than being subjected to a global rewrite.
  if v_digits ~ '^00968([0-9]{8})$' then
    return substr(v_digits, 6);
  end if;
  if v_digits ~ '^968([0-9]{8})$' then
    return substr(v_digits, 4);
  end if;
  return nullif(v_digits, '');
end;
$function$;

revoke all on function public.normalize_person_phone(text) from public;
grant execute on function public.normalize_person_phone(text) to authenticated, service_role;

-- Fail closed before dropping/rebuilding the expression index. The corrected
-- function is deliberately used in the grouping query so a pre-existing
-- +968/00968 collision cannot be hidden by the old index definition.
do $phone_duplicate_preflight$
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
end
$phone_duplicate_preflight$;

-- Expression indexes retain values produced under the function definition that
-- existed when they were built. Recreate rather than relying on IF NOT EXISTS.
drop index if exists public.people_live_name_phone_uidx;
create unique index people_live_name_phone_uidx
  on public.people (
    company_id,
    public.normalize_person_identity_text(full_name),
    public.normalize_person_phone(phone)
  )
  where deleted_at is null
    and nullif(public.normalize_person_identity_text(full_name), '') is not null
    and nullif(public.normalize_person_phone(phone), '') is not null;

-- ---------------------------------------------------------------------------
-- B2: legacy RPC convergence.
-- ---------------------------------------------------------------------------
-- The legacy create signature remains available to existing service/internal
-- callers, but it delegates to the canonical locked/idempotent command. A
-- deterministic request key makes an identical legacy retry return the same
-- row instead of creating a second command intent.
create or replace function public.create_contract_atomic(
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
  p_billing_day integer default 1,
  p_grace_days integer default 0
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_request_id text;
begin
  if auth.uid() is null
     or not public.current_user_has_effective_app_permission('contracts.create') then
    raise exception 'غير مصرح: لا تملك صلاحية إنشاء العقد' using errcode = '42501';
  end if;

  v_request_id := 'legacy:' || encode(sha256(convert_to(jsonb_build_object(
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
    'grace_days', p_grace_days
  )::text, 'UTF8')), 'hex');

  return public.create_contract_atomic_v2(
    p_property_id,
    p_unit_id,
    p_tenant_id,
    p_agreement_id,
    p_start_date,
    p_end_date,
    p_rent_amount,
    p_payment_cycle,
    p_payment_terms_id,
    p_status,
    p_cancellation_reason,
    p_notes,
    p_attachment_url,
    p_billing_day,
    p_grace_days,
    'long_term',
    null,
    v_request_id
  );
end;
$function$;

alter function public.create_contract_atomic(
  text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text,
  text, integer, integer
) owner to postgres;
revoke all on function public.create_contract_atomic(
  text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text,
  text, integer, integer
) from public;
grant all on function public.create_contract_atomic(
  text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text,
  text, integer, integer
) to authenticated, service_role;

-- The legacy update signature has no lease-mode or billing-policy parameters.
-- Preserve those stored values, then delegate all mutation authorization,
-- company/reference checks, unit locking, overlap checks, and lifecycle rules
-- to update_contract_atomic_v2.
create or replace function public.update_contract_atomic(
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
  p_attachment_url text
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
  v_lease_mode public.contracts.lease_mode%type;
  v_daily_reference_rate public.contracts.daily_reference_rate%type;
begin
  if auth.uid() is null
     or not public.current_user_has_effective_app_permission('contracts.edit') then
    raise exception 'غير مصرح: لا تملك صلاحية تعديل العقد' using errcode = '42501';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'سياق الشركة مطلوب لتعديل العقد' using errcode = '42501';
  end if;

  select coalesce(c.lease_mode, 'long_term'), c.daily_reference_rate
    into v_lease_mode, v_daily_reference_rate
  from public.contracts c
  where c.id::text = p_contract_id
    and c.company_id = v_company_id
    and c.deleted_at is null
  for update;

  if not found then
    raise exception 'العقد غير موجود' using errcode = 'P0002';
  end if;

  return public.update_contract_atomic_v2(
    p_contract_id,
    p_property_id,
    p_unit_id,
    p_tenant_id,
    p_agreement_id,
    p_start_date,
    p_end_date,
    p_rent_amount,
    p_payment_cycle,
    p_payment_terms_id,
    p_status,
    p_cancellation_reason,
    p_notes,
    p_attachment_url,
    v_lease_mode,
    v_daily_reference_rate
  );
end;
$function$;

alter function public.update_contract_atomic(
  text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text,
  text, text
) owner to postgres;
revoke all on function public.update_contract_atomic(
  text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text,
  text, text
) from public;
grant all on function public.update_contract_atomic(
  text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text,
  text, text
) to authenticated, service_role;

-- Renewal remains a supported browser command, so it is hardened in place.
-- It now has deterministic retry identity, a request fingerprint, ordered
-- contract/unit locks, a strict post-current-term boundary, live draft/active
-- overlap checks, and the same company-scoped agreement/reference rules.
create or replace function public.renew_contract_atomic(
  old_contract_id text,
  new_contract_data jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid;
  v_old public.contracts%rowtype;
  v_new_id text;
  v_new_start_date date;
  v_new_end_date date;
  v_new_amount numeric;
  v_effective_agreement_id public.contracts.agreement_id%type;
  v_requested_agreement text;
  v_billing_day integer;
  v_grace_days integer;
  v_request_id text;
  v_operation_name text;
  v_request_fingerprint text;
  v_cached jsonb;
  v_result jsonb;
  v_command jsonb := coalesce(new_contract_data, '{}'::jsonb) - 'request_id';
begin
  if auth.uid() is null
     or not public.current_user_has_effective_app_permission('contracts.edit') then
    raise exception 'غير مصرح: لا تملك صلاحية تجديد العقد' using errcode = '42501';
  end if;

  v_company := public.current_company_id();
  if v_company is null then
    raise exception 'سياق الشركة مطلوب لتجديد العقد' using errcode = '42501';
  end if;

  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'old_contract_id', old_contract_id,
    'command', v_command
  )::text, 'UTF8')), 'hex');
  v_request_id := nullif(btrim(new_contract_data->>'request_id'), '');
  if v_request_id is null then
    v_request_id := 'derived:' || v_request_fingerprint;
  end if;
  if length(v_request_id) > 200 then
    raise exception 'CONTRACT_RENEW_REQUEST_ID_INVALID: معرّف الطلب طويل جداً' using errcode = '22023';
  end if;

  v_operation_name := 'renew_contract_atomic:' || v_company::text || ':' || old_contract_id;
  perform pg_advisory_xact_lock(hashtextextended(
    v_operation_name || ':' || v_request_id, 0
  ));

  select response_payload
    into v_cached
  from public.financial_operation_idempotency
  where operation_name = v_operation_name
    and request_id = v_request_id
  for update;

  if v_cached is not null then
    if v_cached->>'_request_fingerprint' is distinct from v_request_fingerprint
       or not (v_cached ? 'response') then
      raise exception 'CONTRACT_RENEW_IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        using errcode = '22023';
    end if;
    return (v_cached->'response') || jsonb_build_object('idempotent', true);
  end if;

  select *
    into v_old
  from public.contracts
  where id::text = old_contract_id
    and company_id = v_company
    and deleted_at is null
  for update;

  if not found then
    raise exception 'العقد الأصلي غير موجود' using errcode = 'P0002';
  end if;
  if lower(coalesce(v_old.status, '')) <> 'active' then
    raise exception 'يمكن تجديد العقود النشطة فقط' using errcode = '23514';
  end if;

  v_new_start_date := coalesce(
    nullif(new_contract_data ->> 'new_start', ''),
    nullif(new_contract_data ->> 'start_date', '')
  )::date;
  v_new_end_date := coalesce(
    nullif(new_contract_data ->> 'new_end', ''),
    nullif(new_contract_data ->> 'end_date', '')
  )::date;
  v_new_amount := coalesce(
    nullif(new_contract_data ->> 'new_amount', ''),
    nullif(new_contract_data ->> 'rent_amount', '')
  )::numeric;

  if v_new_start_date is null or v_new_end_date is null or v_new_end_date <= v_new_start_date then
    raise exception 'فترة التجديد غير صالحة';
  end if;
  if btrim(coalesce(v_old.end_date::text, '')) !~ '^\d{4}-\d{2}-\d{2}$'
     or v_new_start_date <= btrim(v_old.end_date::text)::date then
    raise exception 'CONTRACT_RENEWAL_MUST_START_AFTER_CURRENT_END' using errcode = '23514';
  end if;
  if v_new_amount is null or v_new_amount <= 0 then
    raise exception 'قيمة إيجار التجديد يجب أن تكون أكبر من صفر';
  end if;

  v_billing_day := coalesce(nullif(new_contract_data ->> 'billing_day', '')::integer, v_old.billing_day, 1);
  v_grace_days := coalesce(nullif(new_contract_data ->> 'grace_days', '')::integer, v_old.grace_days, 0);
  if v_billing_day < 1 or v_billing_day > 28 then
    raise exception 'CONTRACT_BILLING_DAY_INVALID: يوم الفوترة يجب أن يكون بين 1 و28' using errcode = '23514';
  end if;
  if v_grace_days < 0 or v_grace_days > 90 then
    raise exception 'CONTRACT_GRACE_DAYS_INVALID: أيام السماح يجب أن تكون بين 0 و90' using errcode = '23514';
  end if;

  if v_old.unit_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(
      'contract_unit:' || v_company::text || ':' || v_old.unit_id::text, 0
    ));

    if not exists (
      select 1
      from public.units u
      where u.id::text = v_old.unit_id::text
        and u.company_id = v_company
        and u.property_id::text = v_old.property_id::text
        and u.deleted_at is null
        and lower(coalesce(u.status, '')) not in ('maintenance', 'reserved')
    ) then
      raise exception 'لا يمكن تجديد العقد على وحدة غير متاحة أو لا تتبع الشركة الحالية'
        using errcode = '42501';
    end if;

    if exists (
      select 1
      from public.contracts c
      where c.id::text <> old_contract_id
        and c.unit_id::text = v_old.unit_id::text
        and c.company_id = v_company
        and c.deleted_at is null
        and lower(coalesce(c.status, '')) in ('active', 'draft')
        and btrim(coalesce(c.start_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
        and btrim(coalesce(c.end_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
        and btrim(c.start_date::text)::date <= v_new_end_date
        and btrim(c.end_date::text)::date >= v_new_start_date
    ) then
      raise exception 'الوحدة محجوزة خلال هذه الفترة';
    end if;

    if exists (
      select 1
      from public.contracts c
      where c.company_id = v_company
        and c.unit_id::text = v_old.unit_id::text
        and c.tenant_id::text = v_old.tenant_id::text
        and c.deleted_at is null
        and lower(coalesce(c.status, '')) = 'draft'
    ) then
      raise exception 'توجد بالفعل مسودة تجديد لهذه الوحدة والمستأجر';
    end if;
  end if;

  v_requested_agreement := nullif(new_contract_data ->> 'agreement_id', '');
  if v_requested_agreement is not null then
    if not exists (
      select 1
      from public.owner_agreements oa
      where oa.id::text = v_requested_agreement
        and oa.company_id = v_company
        and oa.property_id::text = v_old.property_id::text
        and oa.starts_on <= v_new_start_date
        and (oa.ends_on is null or oa.ends_on >= v_new_end_date)
    ) then
      raise exception 'اتفاقية المالك المحددة لا تغطي فترة التجديد' using errcode = '23514';
    end if;
    v_effective_agreement_id := v_requested_agreement;
  else
    select oa.id
      into v_effective_agreement_id
    from public.owner_agreements oa
    where oa.company_id = v_company
      and oa.property_id::text = v_old.property_id::text
      and oa.starts_on <= v_new_start_date
      and (oa.ends_on is null or oa.ends_on >= v_new_end_date)
    order by oa.starts_on desc
    limit 1;
    if v_effective_agreement_id is null then
      raise exception 'لا توجد اتفاقية مالك تغطي فترة التجديد' using errcode = '23514';
    end if;
  end if;

  insert into public.contracts (
    property_id, unit_id, tenant_id, agreement_id, start_date, end_date,
    rent_amount, payment_cycle, payment_terms_id, status, company_id,
    renewed_from_id, notes, billing_day, grace_days,
    lease_mode, daily_reference_rate
  ) values (
    v_old.property_id, v_old.unit_id, v_old.tenant_id, v_effective_agreement_id,
    v_new_start_date, v_new_end_date, v_new_amount, v_old.payment_cycle,
    v_old.payment_terms_id, 'draft', v_company, v_old.id,
    nullif(btrim(coalesce(new_contract_data ->> 'notes', '')), ''),
    v_billing_day, v_grace_days,
    coalesce(v_old.lease_mode, 'long_term'), v_old.daily_reference_rate
  )
  returning id::text into v_new_id;

  v_result := jsonb_build_object(
    'status', 'renewed',
    'old_contract_id', old_contract_id,
    'new_contract_id', v_new_id,
    'agreement_id', v_effective_agreement_id,
    'billing_day', v_billing_day,
    'grace_days', v_grace_days,
    'idempotent', false
  );

  insert into public.financial_operation_idempotency(
    operation_name, request_id, response_payload
  ) values (
    v_operation_name,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_request_fingerprint,
      'response', v_result
    )
  );

  return v_result;
end;
$function$;

alter function public.renew_contract_atomic(text, jsonb) owner to postgres;
revoke all on function public.renew_contract_atomic(text, jsonb) from public;
grant all on function public.renew_contract_atomic(text, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
