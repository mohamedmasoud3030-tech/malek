-- WP-03 / GAP-004 (part 2): renewal and termination authority hardening.
-- Canonical rules: OPS-006, OPS-007, DOM-005, SEC-003, D13.
--
-- Two remaining GAP-004 bypasses are closed here:
--
--   1. renew_contract_atomic previously created the renewed contract directly
--      as 'active', sidestepping the entire maker-checker approval + agreement
--      snapshot freeze. Renewal must create a new *draft* contract that then
--      passes submit -> approve -> activate (OPS-006), so that renewal can
--      never bypass maker/checker or the snapshot freeze. The source contract
--      is left untouched until the renewal is separately approved/activated.
--      It is also hardened for company isolation (SEC-003): the source
--      contract, tenant, property, unit and covering agreement are all
--      resolved within the authenticated company; overlap detection is
--      company-scoped; the renewed row's company_id is written server-side.
--
--   2. terminate_contract_atomic's initial SELECT and its invoice-cancellation
--      write were not company-scoped, so a cross-company contract id could be
--      locked/read and another company's unpaid invoices cancelled (SEC-003).
--      Both are now scoped to the authenticated company.
--
-- Rollback: supabase/rollback/20260818020000_rollback_wp03_gap004_renewal_termination_authority.sql

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. renew_contract_atomic — renewal creates a controlled DRAFT (never ACTIVE).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.renew_contract_atomic(old_contract_id text, new_contract_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_actor uuid := auth.uid();
  v_old public.contracts%rowtype;
  v_new_start text := new_contract_data ->> 'new_start';
  v_new_end text := new_contract_data ->> 'new_end';
  v_new_amount numeric := (new_contract_data ->> 'new_amount')::numeric;
  v_requested_agreement_id uuid := nullif(new_contract_data ->> 'agreement_id', '')::uuid;
  v_effective_agreement_id uuid;
  v_new_start_date date;
  v_new_end_date date;
  v_new_id text;
begin
  if v_actor is null or not public.is_admin_or_manager() then
    raise exception 'CONTRACT_RENEWAL_FORBIDDEN' using errcode = '42501';
  end if;

  if v_new_start is null or v_new_end is null or v_new_amount is null then
    raise exception 'new_start / new_end / new_amount مطلوبة';
  end if;
  if v_new_start !~ '^\d{4}-\d{2}-\d{2}$' or v_new_end !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'تواريخ التجديد يجب أن تكون بصيغة YYYY-MM-DD';
  end if;
  v_new_start_date := v_new_start::date;
  v_new_end_date := v_new_end::date;
  if v_new_end_date <= v_new_start_date then
    raise exception 'تاريخ نهاية التجديد يجب أن يكون بعد تاريخ البداية';
  end if;
  if v_new_amount <= 0 then
    raise exception 'قيمة الإيجار الجديدة يجب أن تكون أكبر من صفر';
  end if;

  -- Source contract must belong to the current company (SEC-003).
  select * into v_old
  from public.contracts
  where id::text = old_contract_id::text
    and company_id = v_company
    and status in ('active', 'expired', 'ACTIVE')
    and deleted_at is null
  for update;

  if not found then
    raise exception 'العقد الأصلي غير موجود أو لا يمكن تجديده';
  end if;

  -- Company isolation for every reference carried into the renewed contract.
  if not exists (
    select 1 from public.people p
    where p.id = v_old.tenant_id and p.company_id = v_company and p.deleted_at is null
  ) then
    raise exception 'CONTRACT_REFERENCE_CROSS_COMPANY' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.properties pr
    where pr.id = v_old.property_id and pr.company_id = v_company and pr.deleted_at is null
  ) then
    raise exception 'CONTRACT_REFERENCE_CROSS_COMPANY' using errcode = '42501';
  end if;
  if v_old.unit_id is not null and not exists (
    select 1 from public.units u
    where u.id = v_old.unit_id and u.company_id = v_company and u.deleted_at is null
  ) then
    raise exception 'CONTRACT_REFERENCE_CROSS_COMPANY' using errcode = '42501';
  end if;

  -- Covering agreement: same-company + same-property + full-period coverage.
  select oa.id into v_effective_agreement_id
  from public.owner_agreements oa
  where oa.id = coalesce(v_requested_agreement_id, v_old.agreement_id)
    and oa.company_id = v_company
    and oa.property_id = v_old.property_id
    and oa.starts_on <= v_new_start_date
    and (oa.ends_on is null or oa.ends_on >= v_new_end_date)
  limit 1;

  if v_effective_agreement_id is null then
    raise exception 'لا توجد اتفاقية مكتب ومالك تغطي كامل فترة التجديد. اختر الاتفاقية السارية أو أنشئ اتفاقية لاحقة قبل التجديد.';
  end if;

  -- Company-scoped overlap detection during the renewal period.
  if v_old.unit_id is not null and exists (
    select 1 from public.contracts
    where unit_id = v_old.unit_id and id::text <> old_contract_id::text
      and company_id = v_company
      and status in ('active', 'draft', 'ACTIVE') and deleted_at is null
      and start_date::date <= v_new_end_date and end_date::date >= v_new_start_date
  ) then
    raise exception 'الوحدة محجوزة خلال فترة التجديد';
  end if;

  -- The renewed contract is born DRAFT and must pass the canonical
  -- maker-checker approval + activation snapshot freeze (OPS-006). The source
  -- contract's status is not changed here; when the renewal is later activated,
  -- the contracts_no_active_unit_overlap constraint enforces no-overlap on the
  -- same unit. company_id is written server-side from the authenticated
  -- context and cannot be injected from the payload.
  insert into public.contracts (
    property_id, unit_id, tenant_id, agreement_id, start_date, end_date,
    rent_amount, payment_cycle, payment_terms_id, status, company_id,
    renewed_from_id, notes
  ) values (
    v_old.property_id, v_old.unit_id, v_old.tenant_id, v_effective_agreement_id,
    v_new_start_date, v_new_end_date, v_new_amount, v_old.payment_cycle,
    v_old.payment_terms_id, 'draft', v_company, v_old.id,
    nullif(btrim(coalesce(new_contract_data ->> 'notes', '')), '')
  )
  returning id::text into v_new_id;

  return jsonb_build_object(
    'status', 'renewed',
    'old_contract_id', old_contract_id,
    'new_contract_id', v_new_id,
    'agreement_id', v_effective_agreement_id
  );
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. terminate_contract_atomic — company-scoped read + company-scoped invoice
--    cancellation.
-- ─────────────────────────────────────────────────────────────────────────────
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

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'سياق الشركة مطلوب لإنهاء العقد' using errcode = '42501';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'سبب الإنهاء مطلوب';
  end if;

  -- SECURITY DEFINER must re-derive company scope: never rely on UUID secrecy.
  select * into v_old
  from public.contracts
  where id = p_contract_id
    and company_id = v_company_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'العقد غير موجود' using errcode = '42501';
  end if;

  if v_old.status not in ('active', 'draft') then
    raise exception 'لا يمكن إنهاء عقد بحالته الحالية (%): يجب أن يكون نشطاً أو مسودة', v_old.status;
  end if;

  update public.contracts
  set status = 'terminated',
      cancellation_reason = p_reason,
      updated_at = now()
  where id = p_contract_id
    and company_id = v_company_id;

  -- Cancel future, still-unpaid invoices so they stop appearing as
  -- outstanding receivables against a dead contract. Invoices with any
  -- payment history (paid_amount > 0) are left as-is. Company-scoped so a
  -- cross-company id can never cancel another company's invoices.
  with cancelled as (
    update public.invoices
    set status = 'CANCELLED',
        updated_at = now()
    where contract_id = p_contract_id
      and company_id = v_company_id
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. activate_contract_with_agreement_snapshot_atomic — fix the approval gate
--    so a NULL approval_status (a draft that was never submitted) fails closed
--    with CONTRACT_APPROVAL_REQUIRED instead of falling through to the
--    signature-evidence check. SQL three-valued logic means
--    `approval_status <> 'APPROVED'` is NULL (not TRUE) for an unsubmitted
--    draft, which previously masked the true "approval required" invariant.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.activate_contract_with_agreement_snapshot_atomic(p_contract_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_contract public.contracts%rowtype;
  -- Explicit columns (not %rowtype) so this SECURITY DEFINER function does not
  -- hard-require owner_agreement_versions to exist at CREATE time. The table is
  -- resolved only at execution; the historical P0 tenant-isolation checkpoint
  -- replays a curated subset of migrations without the S04 snapshot provider
  -- and still applies this hardening without a catalog dependency failure.
  v_version_id uuid;
  v_version_collection_role text;
  v_version_operating_model text;
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
     or coalesce(v_contract.approval_status, '') <> 'APPROVED' then
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

  select v.id, v.collection_role, v.operating_model
    into v_version_id, v_version_collection_role, v_version_operating_model
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

  if v_version_id is null then
    raise exception 'CONTRACT_AGREEMENT_VERSION_COVERAGE_REQUIRED' using errcode='23514';
  end if;

  update public.contracts c
  set agreement_version_id=v_version_id,
      collection_role_snapshot=v_version_collection_role,
      operating_model_snapshot=v_version_operating_model,
      status='active',
      updated_at=now()
  where c.id::text=p_contract_id and c.company_id=v_company and c.deleted_at is null
  returning to_jsonb(c) into v_result;

  return v_result;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Grants: authenticated callers only (re-asserted on redefinition).
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.activate_contract_with_agreement_snapshot_atomic(text) from public, anon, authenticated;
grant execute on function public.activate_contract_with_agreement_snapshot_atomic(text) to authenticated, service_role;

revoke all on function public.renew_contract_atomic(text, jsonb) from public, anon, authenticated;
grant execute on function public.renew_contract_atomic(text, jsonb) to authenticated;

revoke all on function public.terminate_contract_atomic(text, text) from public, anon, authenticated;
grant execute on function public.terminate_contract_atomic(text, text) to authenticated;

commit;
