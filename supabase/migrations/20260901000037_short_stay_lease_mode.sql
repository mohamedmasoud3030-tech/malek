-- Short Stay lease mode (P2 — Leasing & Money, Architecture Lock 2026-08-27)
--
-- Canonical shape (Canonical Pack Doc 6, "Contract UX"):
--   Short Stay is a small contract for the same unit: from/to date, optional
--   reference daily rate, negotiated actual rate/total and controlled
--   extension/end. It is not a hotel/housekeeping module.
--
-- Design:
--   * `contracts.lease_mode` ('long_term' default | 'short_stay') marks the
--     mode. A short-stay row keeps the same contract lifecycle
--     (draft -> approval -> active), the same maker/checker authority, the
--     same unit-overlap protection and the same owner-agreement coverage
--     requirement as a long-term contract.
--   * `contracts.daily_reference_rate` (nullable) is the optional reference
--     daily price. It is informational only: the negotiated total
--     (`rent_amount`) governs the obligation, exactly like reference rent is
--     informational for a unit while the contract price governs.
--   * The recurring invoice generator emits ONE rent invoice per short stay:
--     billing period = the whole stay, issued on the arrival date and due on
--     arrival + grace days. The existing billing-obligation unique index
--     makes regeneration idempotent. Long-term contracts are unchanged.
--
-- No existing row is mutated beyond the additive column defaults. Posted
-- financial history is untouched.

-- ALLOW_GOVERNED_DATA_MIGRATION
-- Governance note: every transactional INSERT token in this migration is inside
-- a SECURITY DEFINER RPC body. This migration performs no raw business-data
-- INSERT/backfill at migration time; runtime writes remain company-scoped,
-- role-gated, atomic, auditable, and owned by the canonical RPC boundary.

ALTER TABLE "public"."contracts"
  ADD COLUMN IF NOT EXISTS "lease_mode" "text" NOT NULL DEFAULT 'long_term';

ALTER TABLE "public"."contracts"
  DROP CONSTRAINT IF EXISTS "contracts_lease_mode_check";
ALTER TABLE "public"."contracts"
  ADD CONSTRAINT "contracts_lease_mode_check"
  CHECK ((("lease_mode" = 'long_term'::text) OR ("lease_mode" = 'short_stay'::text)));

ALTER TABLE "public"."contracts"
  ADD COLUMN IF NOT EXISTS "daily_reference_rate" numeric(18,3);

ALTER TABLE "public"."contracts"
  DROP CONSTRAINT IF EXISTS "contracts_daily_reference_rate_check";
ALTER TABLE "public"."contracts"
  ADD CONSTRAINT "contracts_daily_reference_rate_check"
  CHECK ((("daily_reference_rate" IS NULL) OR (("daily_reference_rate" >= (0)::numeric) AND ("daily_reference_rate" = round("daily_reference_rate", 3)))));

-- ---------------------------------------------------------------------------
-- create_contract_atomic: accept and validate the short-stay fields.
-- Existing callers are unaffected (both new parameters carry defaults).
-- The old signature is dropped explicitly so the catalog keeps exactly one
-- function instead of an ambiguous overload pair.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_contract_atomic(
  text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text, integer, integer
);
CREATE OR REPLACE FUNCTION "public"."create_contract_atomic"(
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
  "p_daily_reference_rate" numeric DEFAULT NULL
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
  v_lease_mode := coalesce(lower(btrim(p_lease_mode)), 'long_term');

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

  return (select to_jsonb(c) from public.contracts c where c.id::text = v_contract_id::text);
end;
$_$;

-- ---------------------------------------------------------------------------
-- update_contract_atomic: carry the short-stay fields through the same
-- guarded generic editor. The mode and reference rate are treated as signed
-- commercial terms: frozen once the contract is active or APPROVED.
-- The old signature is dropped explicitly so the catalog keeps exactly one
-- function instead of an ambiguous overload pair.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_contract_atomic(
  text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text
);
CREATE OR REPLACE FUNCTION "public"."update_contract_atomic"(
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
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لتعديل عقد'
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

-- ---------------------------------------------------------------------------
-- generate_invoices_from_active_contracts: one rent invoice per short stay.
-- The billing period is the whole stay, the invoice is issued on the arrival
-- date and falls due on arrival + grace days. Idempotency relies on the same
-- billing-obligation uniqueness as the recurring path (billing_period_start
-- is unique per contract + charge type), so a regenerated run is a no-op.
-- Long-term contracts keep the existing calendar-cycle behavior exactly.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."generate_invoices_from_active_contracts"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_company_id uuid;
  v_contract record;
  v_invoice_id uuid;
  v_batch_id uuid;
  v_tax_snapshot_id uuid;
  v_owner_id uuid;
  v_taxable boolean;
  v_tax_profile_id uuid;
  v_tax_code text;
  v_tax_rate numeric := 0;
  v_tax_amount numeric := 0;
  v_total_amount numeric;
  v_ar_account_id text;
  v_owner_funds_account_id text;
  v_vat_account_id text;
  v_count integer := 0;
  v_period_start date;
  v_period_end date;
  v_issue_date date;
  v_due_date date;
  v_billing_day integer;
  v_grace_days integer;
  v_lines jsonb;
  v_invoice_exists boolean;
  v_classification text;
  v_post_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to generate invoices' using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  for v_contract in
    select c.id,
           c.rent_amount,
           c.payment_cycle,
           c.billing_day,
           c.grace_days,
           c.agreement_version_id,
           c.operating_model_snapshot,
           c.collection_role_snapshot,
           c.lease_mode,
           c.start_date,
           c.end_date,
           oa.owner_id
      from public.contracts c
      join public.owner_agreements oa
        on oa.id = c.agreement_id
       and oa.company_id = c.company_id
     where c.deleted_at is null
       and lower(c.status) = 'active'
       and c.company_id = v_company_id
     order by c.id
  loop
    perform pg_advisory_xact_lock(hashtext('invoice_generation:' || v_contract.id::text));

    v_grace_days := coalesce(v_contract.grace_days, 0);

    if coalesce(v_contract.lease_mode, 'long_term') = 'short_stay' then
      -- Short Stay: a single obligation covering the whole stay, issued on
      -- arrival and due on arrival + grace days. The obligation is raised
      -- once the stay has begun; it is never re-raised for the same stay.
      if v_contract.start_date > current_date then
        continue;
      end if;
      v_period_start := v_contract.start_date;
      v_period_end := v_contract.end_date;
      v_issue_date := v_contract.start_date;
      v_due_date := v_contract.start_date + v_grace_days;
    else
      case v_contract.payment_cycle
        when 'monthly' then
          v_period_start := date_trunc('month', current_date)::date;
          v_period_end := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
        when 'quarterly' then
          v_period_start := date_trunc('quarter', current_date)::date;
          v_period_end := (date_trunc('quarter', current_date) + interval '3 months' - interval '1 day')::date;
        when 'semi_annual' then
          if extract(month from current_date) <= 6 then
            v_period_start := make_date(extract(year from current_date)::int, 1, 1);
            v_period_end := make_date(extract(year from current_date)::int, 6, 30);
          else
            v_period_start := make_date(extract(year from current_date)::int, 7, 1);
            v_period_end := make_date(extract(year from current_date)::int, 12, 31);
          end if;
        when 'annual' then
          v_period_start := date_trunc('year', current_date)::date;
          v_period_end := (date_trunc('year', current_date) + interval '1 year' - interval '1 day')::date;
        else
          v_period_start := date_trunc('month', current_date)::date;
          v_period_end := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
      end case;

      v_billing_day := coalesce(v_contract.billing_day, 1);
      v_issue_date := least(
        make_date(extract(year from v_period_start)::int, extract(month from v_period_start)::int, v_billing_day),
        v_period_end
      );
      v_due_date := v_period_end + v_grace_days;
    end if;

    select exists(
      select 1
        from public.invoices i
       where i.contract_id = v_contract.id
         and i.charge_type = 'RENT'
         and i.billing_period_start = v_period_start
         and i.deleted_at is null
         and i.document_status not in ('VOIDED','REVERSED')
    ) into v_invoice_exists;
    if v_invoice_exists then
      continue;
    end if;

    if v_contract.operating_model_snapshot is distinct from 'OWNER_AGENCY'
       or v_contract.agreement_version_id is null
       or v_contract.collection_role_snapshot not in ('OWNER_IS_CREDITOR', 'OFFICE_IS_CREDITOR') then
      raise exception 'RC1_INVOICE_GENERATION_MODEL_UNAVAILABLE: active contract % is not a fully snapshotted OWNER_AGENCY contract in the RC1 scope.', v_contract.id
        using errcode = '23514';
    end if;

    v_owner_id := v_contract.owner_id;
    if v_owner_id is null then
      raise exception 'RC1_OWNER_FUNDS_OWNER_REQUIRED: owner-agency invoice requires an owner-scoped agreement.'
        using errcode = '23514';
    end if;

    v_classification := case v_contract.collection_role_snapshot
      when 'OWNER_IS_CREDITOR' then 'OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL'
      when 'OFFICE_IS_CREDITOR' then 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS'
      else null
    end;

    -- Every recurring invoice resolves an effective profile. This is the sole
    -- rate/code authority: no company_settings fallback exists.
    select profile_id, tax_code, tax_rate
      into v_tax_profile_id, v_tax_code, v_tax_rate
      from public.resolve_active_tax_profile(v_company_id, v_issue_date);
    v_taxable := v_tax_code <> 'NON_TAXABLE';
    v_tax_amount := public.compute_tax_amount(v_contract.rent_amount, v_tax_rate);
    if not v_taxable and (v_tax_rate <> 0 or v_tax_amount <> 0) then
      raise exception 'INVOICE_NON_TAXABLE_PROFILE_RATE_INVALID: NON_TAXABLE profiles must be configured at 0.000.'
        using errcode = '23514';
    end if;
    v_total_amount := public.gl_pm_round_omr(v_contract.rent_amount + v_tax_amount);

    -- Insert DRAFT first so the invoice id is available to the canonical batch
    -- and tax snapshot. It becomes POSTED only after every immutable lineage
    -- link is written in this same transaction.
    insert into public.invoices (
      contract_id,
      issue_date,
      due_date,
      amount,
      tax_amount,
      tax_rate,
      status,
      company_id,
      document_status,
      charge_type,
      billing_period_start,
      billing_period_end,
      invoice_agreement_version_id,
      invoice_operating_model,
      invoice_collection_role,
      invoice_accounting_classification,
      tax_treatment,
      tax_profile_id,
      tax_code,
      tax_basis
    ) values (
      v_contract.id,
      v_issue_date,
      v_due_date,
      v_contract.rent_amount,
      v_tax_amount,
      v_tax_rate,
      'UNPAID',
      v_company_id,
      'DRAFT',
      'RENT',
      v_period_start,
      v_period_end,
      v_contract.agreement_version_id,
      v_contract.operating_model_snapshot,
      v_contract.collection_role_snapshot,
      v_classification,
      case when v_taxable then 'TAXABLE' else 'NON_TAXABLE' end,
      v_tax_profile_id,
      v_tax_code,
      case when v_taxable then 'NET_PLUS_TAX' else 'NON_TAXABLE' end
    )
    returning id into v_invoice_id;

    -- Invoice issuance is a controlled financial obligation even when the
    -- OWNER_IS_CREDITOR document is operational-only. Resolve the period here
    -- so OPEN/SOFT_CLOSED/HARD_CLOSED and late-posting rules apply uniformly.
    perform public.gl_ensure_initial_open_period(v_company_id, v_issue_date);
    perform 1 from public.gl_resolve_accounting_period(v_company_id, v_issue_date);

    v_batch_id := null;
    if v_classification = 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS' then
      v_ar_account_id := public.require_company_account_id(v_company_id, '1201');
      v_owner_funds_account_id := public.require_company_account_id(v_company_id, '2000');
      v_lines := jsonb_build_array(
        jsonb_build_object(
          'account_id', v_ar_account_id,
          'debit', v_total_amount,
          'credit', 0,
          'line_description', 'INV-' || v_invoice_id::text || '-DR-AR',
          'ref_source_id', v_invoice_id::text,
          'ref_entity_type', 'invoice',
          'ref_entity_id', v_invoice_id::text
        ),
        jsonb_build_object(
          'account_id', v_owner_funds_account_id,
          'debit', 0,
          'credit', v_contract.rent_amount,
          'line_description', 'INV-' || v_invoice_id::text || '-CR-OWNER-FUNDS',
          'ref_source_id', v_invoice_id::text,
          'ref_entity_type', 'invoice',
          'ref_entity_id', v_invoice_id::text
        )
      );
      if v_tax_amount > 0 then
        v_vat_account_id := public.require_company_account_id(v_company_id, '2100');
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object(
            'account_id', v_vat_account_id,
            'debit', 0,
            'credit', v_tax_amount,
            'line_description', 'INV-' || v_invoice_id::text || '-CR-VAT',
            'ref_source_id', v_invoice_id::text,
            'ref_entity_type', 'invoice',
            'ref_entity_id', v_invoice_id::text
          )
        );
      end if;

      perform public.gl_ensure_initial_open_period(v_company_id, v_issue_date);
      v_post_result := public.post_journal_event(jsonb_build_object(
        'company_id', v_company_id,
        'source_type', 'invoice',
        'source_id', v_invoice_id::text,
        'event_id', v_invoice_id::text,
        'effective_date', v_issue_date,
        'description', 'OWNER_AGENCY OFFICE_IS_CREDITOR rent invoice ' || v_invoice_id::text,
        'lines', v_lines
      ));
      v_batch_id := nullif(v_post_result->>'batch_id', '')::uuid;
      if v_batch_id is null then
        raise exception 'INVOICE_RC1_POSTING_BATCH_MISSING' using errcode = 'P0001';
      end if;
    end if;

    v_tax_snapshot_id := null;
    -- Store the resolved profile even for an explicit NON_TAXABLE invoice so
    -- future credits never infer a treatment from changed company settings.
    insert into public.taxable_line_tax_snapshots (
        company_id,
        source_type,
        source_id,
        journal_batch_id,
        account_no,
        tax_code,
        tax_rate,
        net_amount,
        tax_amount,
        effective_date
      ) values (
        v_company_id,
        'invoice',
        v_invoice_id::text,
        v_batch_id,
        '2100',
        v_tax_code,
        v_tax_rate,
        v_contract.rent_amount,
        v_tax_amount,
        v_issue_date
      )
      returning id into v_tax_snapshot_id;

    update public.invoices
       set invoice_posting_batch_id = v_batch_id,
           tax_snapshot_id = v_tax_snapshot_id,
           document_status = 'POSTED',
           updated_at = now()
     where id = v_invoice_id
       and company_id = v_company_id;

    if v_classification = 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS' then
      insert into public.owner_funds_events (
        company_id, owner_id, contract_id, invoice_id, source_type, source_id,
        event_id, amount_delta, effective_date, journal_batch_id
      ) values (
        v_company_id, v_owner_id, v_contract.id, v_invoice_id, 'OFFICE_INVOICE',
        v_invoice_id::text, 'issue', v_contract.rent_amount, v_issue_date, v_batch_id
      );
    end if;

    v_count := v_count + 1;
  end loop;

  if v_count > 0 then
    insert into public.audit_log (
      id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
    ) values (
      gen_random_uuid()::text,
      extract(epoch from now())::bigint,
      auth.uid(),
      (select email from auth.users where id = auth.uid()),
      'GENERATE',
      'invoices',
      'batch',
      format('Generated %s RC1 owner-agency invoices from active contracts', v_count),
      'invoices',
      jsonb_build_object('count', v_count, 'taxability', case when v_taxable then 'TAXABLE' else 'NON_TAXABLE' end)::text,
      now()
    );
  end if;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Access control: restore the baseline's explicit grant posture for the two
-- replaced signatures. The dropped overloads carried their grants away; the
-- canonical browser-RPC contract stays: revoked from PUBLIC, executable by
-- authenticated and service_role, with the RPC's own role gate as authority.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_contract_atomic(
  text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text, integer, integer, text, numeric
) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_contract_atomic(
  text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text, integer, integer, text, numeric
) TO authenticated;
GRANT ALL ON FUNCTION public.create_contract_atomic(
  text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text, integer, integer, text, numeric
) TO service_role;

REVOKE ALL ON FUNCTION public.update_contract_atomic(
  text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text, text, numeric
) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_contract_atomic(
  text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text, text, numeric
) TO authenticated;
GRANT ALL ON FUNCTION public.update_contract_atomic(
  text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text, text, numeric
) TO service_role;
