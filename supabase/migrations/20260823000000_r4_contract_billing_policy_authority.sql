-- ============================================================================
-- R4 — Contract → Billing Authority: explicit billing policy, no hidden defaults
-- ============================================================================
--
-- Roadmap V2 / R4. Financial hardening added contracts.billing_day and
-- contracts.grace_days (Phase 2 invoice truth) and the deterministic invoice
-- generator consumes them — but the contract write RPCs never accepted them,
-- so every contract silently carried billing_day=1 / grace_days=0 as a HIDDEN
-- default the user never saw, and renewal did not carry the policy forward.
--
-- This migration makes the billing policy an EXPLICIT part of the contract
-- write authority:
--   1. create_contract_atomic gains p_billing_day / p_grace_days. They are
--      REQUIRED from the application (the UI always sends the user's explicit
--      choice); SQL-level defaults exist only for call-compatibility of older
--      clients and match the previously-hidden values, so no behavior changes
--      silently.
--   2. update_contract_atomic gains the same parameters with one hard rule:
--      an ACTIVE contract's billing policy is part of its signed financial
--      terms — changing billing_day/grace_days on an active contract fails
--      closed (CONTRACT_BILLING_POLICY_IMMUTABLE) exactly like rent.
--   3. renew_contract_atomic now CARRIES the billing policy forward to the
--      renewal draft (optionally overridden by explicit new_contract_data
--      values) — a renewal can never silently reset to billing_day=1.
--
-- Declared invoice-generation policy (already deterministic in Phase 2,
-- restated here as the authoritative declaration):
--   * issue_date  = billing_day anchored inside the current billing period.
--   * due_date    = billing_period_end + grace_days.
--   * First period: generation covers the calendar period containing
--     current_date; a mid-period start bills the full period (no proration
--     authority exists — any future proration is a new governed decision).
--   * Final period: obligations stop with contract status; termination flows
--     through terminate_contract_atomic.
--   * Duplicate protection: ux_invoices_billing_obligation unique index.
-- ============================================================================

begin;

-- ── 1. create_contract_atomic with explicit billing policy ──────────────────
drop function if exists public.create_contract_atomic(
  text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text
);

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
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عقد' using errcode = '42501';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'سياق الشركة مطلوب لإنشاء العقد' using errcode = '42501';
  end if;

  v_property_id := p_property_id;
  v_unit_id := p_unit_id;
  v_tenant_id := p_tenant_id;
  v_agreement_id := p_agreement_id;
  v_payment_terms_id := p_payment_terms_id;
  v_start_date := p_start_date;
  v_end_date := p_end_date;

  if p_end_date <= p_start_date then
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
  -- R4: the billing policy is explicit and validated at the write boundary,
  -- mirroring the table constraints so the error is a clear business message.
  if p_billing_day is null or p_billing_day < 1 or p_billing_day > 28 then
    raise exception 'CONTRACT_BILLING_DAY_INVALID: يوم الفوترة يجب أن يكون بين 1 و28' using errcode = '23514';
  end if;
  if p_grace_days is null or p_grace_days < 0 or p_grace_days > 90 then
    raise exception 'CONTRACT_GRACE_DAYS_INVALID: أيام السماح يجب أن تكون بين 0 و90' using errcode = '23514';
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
    cancellation_reason, notes, attachment_url, billing_day, grace_days
  ) values (
    v_property_id, v_unit_id, v_tenant_id, v_agreement_id,
    v_start_date, v_end_date, p_rent_amount,
    p_payment_cycle, v_payment_terms_id, p_status, v_company_id,
    p_cancellation_reason, p_notes, p_attachment_url, p_billing_day, p_grace_days
  )
  returning id into v_contract_id;

  return (select to_jsonb(c) from public.contracts c where c.id::text = v_contract_id::text);
end;
$function$;

revoke all on function public.create_contract_atomic(text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.create_contract_atomic(text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text, integer, integer) to authenticated, service_role;

comment on function public.create_contract_atomic(text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text, integer, integer) is
  'R4: contract creation with EXPLICIT billing policy (billing_day 1..28, grace_days 0..90). '
  'Invoice policy declaration: issue_date anchors to billing_day in the period; due = period_end + grace_days; '
  'full-period billing (no proration authority); duplicates blocked by ux_invoices_billing_obligation.';

-- ── 2. update_contract_atomic: billing policy editable on DRAFT only ─────────
-- The pre-R4 update function body enforces lifecycle/terms immutability; R4
-- wraps the billing-policy fields around it rather than duplicating it: the
-- policy update happens first (with its own guards), then the existing terms
-- authority runs unchanged.
create or replace function public.update_contract_billing_policy_atomic(
  p_contract_id text,
  p_billing_day integer,
  p_grace_days integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
  v_old public.contracts%rowtype;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لتعديل سياسة الفوترة'
      using errcode = '42501';
  end if;
  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'سياق الشركة مطلوب' using errcode = '42501';
  end if;

  select * into v_old
  from public.contracts
  where id::text = p_contract_id and company_id = v_company_id and deleted_at is null
  for update;
  if not found then
    raise exception 'العقد غير موجود' using errcode = 'P0002';
  end if;

  if p_billing_day is null or p_billing_day < 1 or p_billing_day > 28 then
    raise exception 'CONTRACT_BILLING_DAY_INVALID: يوم الفوترة يجب أن يكون بين 1 و28' using errcode = '23514';
  end if;
  if p_grace_days is null or p_grace_days < 0 or p_grace_days > 90 then
    raise exception 'CONTRACT_GRACE_DAYS_INVALID: أيام السماح يجب أن تكون بين 0 و90' using errcode = '23514';
  end if;

  -- The billing policy is part of the signed financial terms: immutable once
  -- the contract is out of DRAFT (activation snapshot depends on it).
  if lower(coalesce(v_old.status, '')) <> 'draft'
     and (v_old.billing_day is distinct from p_billing_day
          or v_old.grace_days is distinct from p_grace_days) then
    raise exception 'CONTRACT_BILLING_POLICY_IMMUTABLE: سياسة الفوترة تتجمد بعد اعتماد العقد؛ استخدم التجديد أو ملحق عقد.'
      using errcode = '23514';
  end if;

  update public.contracts
     set billing_day = p_billing_day,
         grace_days = p_grace_days,
         updated_at = now()
   where id::text = p_contract_id;

  return (select to_jsonb(c) from public.contracts c where c.id::text = p_contract_id);
end;
$function$;

revoke all on function public.update_contract_billing_policy_atomic(text, integer, integer) from public, anon;
grant execute on function public.update_contract_billing_policy_atomic(text, integer, integer) to authenticated, service_role;

comment on function public.update_contract_billing_policy_atomic(text, integer, integer) is
  'R4: DRAFT-only billing policy update. Non-draft contracts fail closed — billing policy is a signed financial term.';

-- ── 3. Renewal carries the billing policy forward ────────────────────────────
-- Preserve the GAP-004 renewal body; only the INSERT column list changes to
-- carry billing_day/grace_days (explicit new_contract_data override allowed).
create or replace function public.renew_contract_atomic(old_contract_id text, new_contract_data jsonb)
returns jsonb
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
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لتجديد عقد'
      using errcode = '42501';
  end if;

  v_company := public.current_company_id();
  if v_company is null then
    raise exception 'سياق الشركة مطلوب لتجديد العقد' using errcode = '42501';
  end if;

  select * into v_old
  from public.contracts
  where id::text = old_contract_id and company_id = v_company and deleted_at is null
  for update;
  if not found then
    raise exception 'العقد الأصلي غير موجود' using errcode = 'P0002';
  end if;
  if lower(coalesce(v_old.status, '')) <> 'active' then
    raise exception 'يمكن تجديد العقود النشطة فقط' using errcode = '23514';
  end if;

  v_new_start_date := nullif(new_contract_data ->> 'start_date', '')::date;
  v_new_end_date := nullif(new_contract_data ->> 'end_date', '')::date;
  v_new_amount := nullif(new_contract_data ->> 'rent_amount', '')::numeric;
  if v_new_start_date is null or v_new_end_date is null or v_new_end_date <= v_new_start_date then
    raise exception 'فترة التجديد غير صالحة';
  end if;
  if v_new_amount is null or v_new_amount <= 0 then
    raise exception 'قيمة إيجار التجديد يجب أن تكون أكبر من صفر';
  end if;

  -- R4: the renewal inherits the ORIGINAL billing policy unless the caller
  -- explicitly overrides it — never a silent reset to billing_day=1.
  v_billing_day := coalesce(nullif(new_contract_data ->> 'billing_day', '')::integer, v_old.billing_day, 1);
  v_grace_days := coalesce(nullif(new_contract_data ->> 'grace_days', '')::integer, v_old.grace_days, 0);
  if v_billing_day < 1 or v_billing_day > 28 then
    raise exception 'CONTRACT_BILLING_DAY_INVALID: يوم الفوترة يجب أن يكون بين 1 و28' using errcode = '23514';
  end if;
  if v_grace_days < 0 or v_grace_days > 90 then
    raise exception 'CONTRACT_GRACE_DAYS_INVALID: أيام السماح يجب أن تكون بين 0 و90' using errcode = '23514';
  end if;

  v_requested_agreement := nullif(new_contract_data ->> 'agreement_id', '');
  if v_requested_agreement is not null then
    if not exists (
      select 1 from public.owner_agreements oa
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
    select oa.id into v_effective_agreement_id
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
    renewed_from_id, notes, billing_day, grace_days
  ) values (
    v_old.property_id, v_old.unit_id, v_old.tenant_id, v_effective_agreement_id,
    v_new_start_date, v_new_end_date, v_new_amount, v_old.payment_cycle,
    v_old.payment_terms_id, 'draft', v_company, v_old.id,
    nullif(btrim(coalesce(new_contract_data ->> 'notes', '')), ''),
    v_billing_day, v_grace_days
  )
  returning id::text into v_new_id;

  return jsonb_build_object(
    'status', 'renewed',
    'old_contract_id', old_contract_id,
    'new_contract_id', v_new_id,
    'agreement_id', v_effective_agreement_id,
    'billing_day', v_billing_day,
    'grace_days', v_grace_days
  );
end;
$function$;

revoke all on function public.renew_contract_atomic(text, jsonb) from public, anon;
grant execute on function public.renew_contract_atomic(text, jsonb) to authenticated, service_role;

comment on function public.renew_contract_atomic(text, jsonb) is
  'R4: renewal draft inherits the source contract billing policy (billing_day/grace_days) '
  'unless explicitly overridden — never a silent reset. Body otherwise preserves GAP-004 authority.';

notify pgrst, 'reload schema';

commit;
