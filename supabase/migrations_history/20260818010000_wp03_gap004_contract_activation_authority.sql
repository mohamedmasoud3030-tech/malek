-- WP-03 / GAP-004: close the direct-activation bypass and freeze signed terms.
-- Canonical rules: OPS-006, DOM-005, D13 (no silent retroactive mutation).
--
-- Before this migration a caller could pass p_status='active' straight into
-- create_contract_atomic / update_contract_atomic, bypassing the
-- maker-checker approval + agreement-snapshot freeze enforced by
-- activate_contract_with_agreement_snapshot_atomic. This migration:
--   1. makes create_contract_atomic accept only 'draft' (new contracts are
--      born draft; activation is the only path to active) and resolves every
--      referenced entity (tenant/property/unit/agreement) within the
--      authenticated company, writing company_id server-side (SEC-003);
--   2. makes update_contract_atomic preserve the contract's lifecycle status
--      (generic editing can never flip status — draft->expired/terminated,
--      terminated->active, active->draft/expired, approved-draft flips and any
--      direct transition to 'active' all fail closed; dedicated commands own
--      every transition), re-validates all referenced entities within the
--      current company, and freezes commercial terms on active or APPROVED
--      contracts (signed/approved commercial terms are immutable; changes go
--      through reject/re-submit, termination or renewal instead).
--
-- Rollback: supabase/rollback/20260818010000_rollback_wp03_gap004_contract_activation_authority.sql

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. create_contract_atomic — draft-only creation.
-- ─────────────────────────────────────────────────────────────────────────────
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
  p_attachment_url text
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
  -- GAP-004 hardening: a new contract is born DRAFT only. Activation is the
  -- only path to 'active' and it freezes the agreement snapshot server-side.
  if lower(coalesce(p_status, '')) <> 'draft' then
    raise exception 'CONTRACT_CREATE_MUST_BE_DRAFT' using errcode = '23514';
  end if;
  if p_payment_cycle not in ('monthly', 'quarterly', 'semi_annual', 'annual') then
    raise exception 'دورة السداد غير مدعومة';
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

  if v_unit_id is null or not exists (
    select 1 from public.units unit_record
    where unit_record.id::text = v_unit_id::text
      and unit_record.property_id::text = v_property_id::text
      and unit_record.company_id = v_company_id
      and unit_record.deleted_at is null
  ) then
    raise exception 'الوحدة لا تنتمي إلى العقار المحدد';
  end if;

  if exists (
    select 1 from public.units unit_record
    where unit_record.id::text = v_unit_id::text
      and unit_record.company_id = v_company_id
      and unit_record.status in ('maintenance', 'reserved')
  ) then
    raise exception 'لا يمكن التعاقد على وحدة تحت الصيانة أو محجوزة تشغيلياً';
  end if;

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

  if v_agreement_id is null then
    raise exception 'لا توجد اتفاقية مالك نشطة تغطي فترة العقد — أنشئ اتفاقية مالك أولاً';
  end if;

  if not exists (
    select 1 from public.owner_agreements agreement_record
    where agreement_record.id::text = v_agreement_id::text
      and agreement_record.property_id::text = v_property_id::text
      and agreement_record.company_id = v_company_id
      and agreement_record.starts_on <= p_start_date
      and (agreement_record.ends_on is null or agreement_record.ends_on >= p_end_date)
  ) then
    raise exception 'اتفاقية المالك لا تغطي فترة العقد بالكامل أو لا تنتمي لهذا العقار';
  end if;

  -- Company identity is resolved server-side from the authenticated context and
  -- explicitly written; it can never be injected from another tenant's inputs.
  insert into public.contracts (
    property_id, unit_id, tenant_id, agreement_id, start_date, end_date,
    rent_amount, payment_cycle, payment_terms_id, status, company_id,
    cancellation_reason, notes, attachment_url
  ) values (
    v_property_id, v_unit_id, v_tenant_id, v_agreement_id,
    v_start_date, v_end_date, p_rent_amount,
    p_payment_cycle, v_payment_terms_id, p_status, v_company_id,
    p_cancellation_reason, p_notes, p_attachment_url
  )
  returning id into v_contract_id;

  return (select to_jsonb(c) from public.contracts c where c.id::text = v_contract_id::text);
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. update_contract_atomic — no direct activation; signed terms immutable.
-- ─────────────────────────────────────────────────────────────────────────────
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
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
  v_old public.contracts%rowtype;
  v_property_id public.contracts.property_id%type;
  v_unit_id public.contracts.unit_id%type;
  v_tenant_id public.contracts.tenant_id%type;
  v_agreement_id public.contracts.agreement_id%type;
  v_payment_terms_id public.contracts.payment_terms_id%type;
  v_result jsonb;
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
$function$;

revoke all on function public.create_contract_atomic(text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text) from public, anon;
grant execute on function public.create_contract_atomic(text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text) to authenticated, service_role;
revoke all on function public.update_contract_atomic(text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text) from public, anon;
grant execute on function public.update_contract_atomic(text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text) to authenticated;

commit;
