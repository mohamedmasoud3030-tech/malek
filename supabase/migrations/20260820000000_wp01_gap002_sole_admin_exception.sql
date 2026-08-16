-- WP-01 / GAP-002: End-to-end implementation of the audited sole-admin exception (OPS-007/D11).
--
-- This migration:
--   1. Adds 'allow_sole_admin_self_approval' company-level setting (not null default false).
--   2. Adds 'is_sole_admin_exception' audit columns to contracts, settlements, voids, deposits, and tax-profiles (not null default false).
--   3. Recreates distinct maker-checker check constraints to permit same-actor approval only when the sole-admin exception flag is set.
--   4. Creates the audit trigger on company_settings changes and enforces the direct-write boundary.
--   5. Implements the set_sole_admin_self_approval_atomic RPC with strict reason and authority checks.
--   6. Overrides the 5 affected approval RPCs and triggers to support same-actor approvals with audited exception flags.

begin;

-- 1. Add company-level setting
alter table public.company_settings
  add column if not exists allow_sole_admin_self_approval boolean not null default false;

-- 2. Add is_sole_admin_exception audit column to affected tables
alter table public.contracts
  add column if not exists is_sole_admin_exception boolean not null default false;

alter table public.owner_settlements
  add column if not exists is_sole_admin_exception boolean not null default false;

alter table public.receipt_void_requests
  add column if not exists is_sole_admin_exception boolean not null default false;

alter table public.deposit_application_claims
  add column if not exists is_sole_admin_exception boolean not null default false;

alter table public.company_tax_profiles
  add column if not exists is_sole_admin_exception boolean not null default false;

-- 3. Drop and Recreate distinct maker-checker constraints
alter table public.contracts
  drop constraint if exists contracts_maker_checker_distinct_chk,
  add constraint contracts_maker_checker_distinct_chk
    check (maker_user_id is null or checker_user_id is null or maker_user_id <> checker_user_id or is_sole_admin_exception = true);

alter table public.owner_settlements
  drop constraint if exists settlements_maker_checker_distinct_chk,
  add constraint settlements_maker_checker_distinct_chk
    check (maker_user_id is null or checker_user_id is null or maker_user_id <> checker_user_id or is_sole_admin_exception = true);

alter table public.receipt_void_requests
  drop constraint if exists receipt_void_requests_checker_chk,
  add constraint receipt_void_requests_checker_chk
    check (reviewed_by is null or reviewed_by <> requested_by or is_sole_admin_exception = true);

alter table public.company_tax_profiles
  drop constraint if exists company_tax_profiles_maker_checker_chk,
  add constraint company_tax_profiles_maker_checker_chk
    check (approved_by is null or approved_by <> created_by or is_sole_admin_exception = true);

-- 4. Create Helper function to check if Sole Admin is allowed for a company
create or replace function public.wp01_is_sole_admin_allowed(p_company_id uuid)
returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_allowed boolean;
begin
  select coalesce(allow_sole_admin_self_approval, false) into v_allowed
  from public.company_settings
  where company_id = p_company_id;
  return coalesce(v_allowed, false);
end;
$$;

-- 5. Audit activation/deactivation of the sole-admin setting and enforce RPC write boundary
create or replace function public.wp01_audit_sole_admin_setting_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_old_val boolean := false;
  v_reason text := nullif(current_setting('public.set_sole_admin_rpc_reason', true), '');
begin
  if tg_op = 'UPDATE' then
    v_old_val := coalesce(old.allow_sole_admin_self_approval, false);
  end if;

  if tg_op = 'INSERT' or v_old_val is distinct from coalesce(new.allow_sole_admin_self_approval, false) then
    -- Enforce direct-write boundary: browser must invoke set_sole_admin_self_approval_atomic
    if nullif(current_setting('public.set_sole_admin_rpc_context', true), '') is distinct from 'active' then
      raise exception 'SOLE_ADMIN_SETTING_DIRECT_WRITE_PROHIBITED: allow_sole_admin_self_approval cannot be mutated directly; must use set_sole_admin_self_approval_atomic RPC.'
        using errcode = '42501';
    end if;

    insert into public.audit_log (
      user_id,
      action,
      entity,
      entity_id,
      note,
      "table",
      details
    ) values (
      v_actor,
      'COMPANY_SETTING_CHANGE',
      'company_settings',
      new.company_id::text,
      'Sole Admin Self Approval setting ' || case when tg_op = 'INSERT' then 'initialized to ' else 'changed from ' || v_old_val::text || ' to ' end || coalesce(new.allow_sole_admin_self_approval::text, 'false') || ' with reason: ' || coalesce(v_reason, 'No reason provided'),
      'company_settings',
      jsonb_build_object(
        'field', 'allow_sole_admin_self_approval',
        'old_value', case when tg_op = 'INSERT' then null else v_old_val end,
        'new_value', new.allow_sole_admin_self_approval,
        'reason', v_reason,
        'actor', v_actor,
        'timestamp', now()
      )::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists wp01_audit_sole_admin_setting_change on public.company_settings;
create trigger wp01_audit_sole_admin_setting_change
after insert or update on public.company_settings
for each row execute function public.wp01_audit_sole_admin_setting_change();

revoke all on function public.wp01_audit_sole_admin_setting_change() from public, anon, authenticated;
grant execute on function public.wp01_audit_sole_admin_setting_change() to service_role;

revoke all on function public.wp01_is_sole_admin_allowed(uuid) from public, anon;
grant execute on function public.wp01_is_sole_admin_allowed(uuid) to authenticated, service_role;


-- 6. Implement set_sole_admin_self_approval_atomic RPC
create or replace function public.set_sole_admin_self_approval_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := public.current_company_id();
  v_enabled boolean := (p_payload->>'enabled')::boolean;
  v_reason text := nullif(btrim(p_payload->>'reason'), '');
  v_request_id text := nullif(btrim(p_payload->>'request_id'), '');
  v_result jsonb;
begin
  -- 1. Restricted Authority: Only ACTIVE users with ADMIN role in company_members can manage settings
  if v_actor is null or not exists (
    select 1 from public.company_members cm
    where cm.user_id = v_actor
      and cm.company_id = v_company_id
      and cm.role = 'ADMIN'
      and cm.is_active = true
  ) then
    raise exception 'SOLE_ADMIN_SETTING_FORBIDDEN: only users with an active ADMIN role in this company can manage company settings.'
      using errcode = '42501';
  end if;

  if v_company_id is null then
    raise exception 'Company context is required to configure sole admin self approval.'
      using errcode = '42501';
  end if;

  -- 2. Mandatory inputs
  if v_enabled is null or v_request_id is null then
    raise exception 'enabled and request_id are required fields.'
      using errcode = '22023';
  end if;

  if v_reason is null or length(v_reason) < 4 then
    raise exception 'SOLE_ADMIN_REASON_REQUIRED: a non-empty reason of at least 4 characters is required to change this setting.'
      using errcode = '22023';
  end if;

  -- 3. Check Sole Admin constraint (D11): Can only enable if exactly ONE active ADMIN exists in the company
  if v_enabled = true then
    declare
      v_admin_count bigint;
    begin
      select count(*) into v_admin_count
      from public.company_members
      where company_id = v_company_id
        and role = 'ADMIN'
        and is_active = true;

      if v_admin_count is null or v_admin_count <> 1 then
        raise exception 'SOLE_ADMIN_SETTING_FORBIDDEN: allow_sole_admin_self_approval can only be enabled if there is exactly one active ADMIN in the company (currently found: %).', v_admin_count
          using errcode = '42501';
      end if;
    end;
  end if;

  -- 4. Idempotency Check
  select response_payload into v_result
  from public.financial_operation_idempotency
  where operation_name = 'set_sole_admin_self_approval_atomic:' || v_company_id::text
    and request_id = v_request_id;

  if found then
    return v_result || jsonb_build_object('idempotent', true);
  end if;

  -- 5. Lock company settings
  perform pg_advisory_xact_lock(
    hashtextextended('company_settings_lock:' || v_company_id::text, 0)
  );

  -- Set RPC context and reason so audit trigger captures it cleanly
  perform set_config('public.set_sole_admin_rpc_context', 'active', true);
  perform set_config('public.set_sole_admin_rpc_reason', v_reason, true);

  -- 6. Update settings
  update public.company_settings
  set allow_sole_admin_self_approval = v_enabled,
      updated_at = now()
  where company_id = v_company_id;

  if not found then
    insert into public.company_settings (company_id, allow_sole_admin_self_approval, company_name)
    values (v_company_id, v_enabled, 'Demo Company');
  end if;

  -- Reset RPC context and reason
  perform set_config('public.set_sole_admin_rpc_context', '', true);
  perform set_config('public.set_sole_admin_rpc_reason', '', true);

  v_result := jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'allow_sole_admin_self_approval', v_enabled,
    'reason', v_reason,
    'actor_id', v_actor,
    'request_id', v_request_id
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('set_sole_admin_self_approval_atomic:' || v_company_id::text, v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;

  return v_result || jsonb_build_object('idempotent', false);
end;
$$;

revoke all on function public.set_sole_admin_self_approval_atomic(jsonb) from public, anon;
grant execute on function public.set_sole_admin_self_approval_atomic(jsonb) to authenticated, service_role;


-- 7. Override affected approval RPCs and triggers

-- Case A: Contract Approval RPC
create or replace function public.approve_contract_atomic(
  p_contract_id text,
  p_checker_signature text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_actor uuid := auth.uid();
  v_contract public.contracts%rowtype;
  v_now timestamptz := now();
  v_result jsonb;
begin
  if v_actor is null or not public.is_admin_or_manager() then
    raise exception 'CONTRACT_APPROVAL_FORBIDDEN' using errcode='42501';
  end if;
  if nullif(btrim(coalesce(p_checker_signature,'')), '') is null then
    raise exception 'CHECKER_SIGNATURE_REQUIRED' using errcode='22023';
  end if;

  select * into v_contract
  from public.contracts
  where id::text = p_contract_id
    and company_id = v_company
    and deleted_at is null
  for update;

  if not found then
    raise exception 'CONTRACT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;
  if lower(coalesce(v_contract.status,'')) <> 'draft'
     or v_contract.approval_status <> 'PENDING' then
    raise exception 'CONTRACT_NOT_PENDING_APPROVAL' using errcode='22023';
  end if;
  if v_contract.maker_user_id is null
     or nullif(btrim(coalesce(v_contract.maker_signature,'')), '') is null then
    raise exception 'MAKER_EVIDENCE_REQUIRED' using errcode='23514';
  end if;
  if v_actor = v_contract.maker_user_id then
    if not public.wp01_is_sole_admin_allowed(v_company) then
      raise exception 'MAKER_CHECKER_MUST_BE_DISTINCT' using errcode='42501';
    end if;
  end if;

  update public.contracts c
  set checker_user_id = v_actor,
      checker_signature = btrim(p_checker_signature),
      approval_status = 'APPROVED',
      approved_at = v_now,
      rejected_at = null,
      rejection_reason = null,
      is_sole_admin_exception = (v_actor = v_contract.maker_user_id),
      updated_at = v_now
  where id = v_contract.id;

  v_result := jsonb_build_object(
    'success', true,
    'id', v_contract.id,
    'status', 'APPROVED',
    'checker_user_id', v_actor,
    'is_sole_admin_exception', (v_actor = v_contract.maker_user_id)
  );

  return v_result;
end;
$function$;

-- Case B: Owner Settlement Trigger Guard
create or replace function public.owner_settlement_maker_checker_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_maker uuid;
  v_checker uuid;
begin
  -- CREATE draft transition: record maker if authenticated
  if tg_op = 'INSERT' then
    if v_actor is not null then
      if new.maker_user_id is not null and new.maker_user_id <> v_actor then
        raise exception 'Owner settlement maker identity cannot be supplied for another user.'
          using errcode = '42501';
      end if;
      new.maker_user_id := v_actor;
    end if;
    return new;
  end if;

  -- Once established, maker/checker identities are immutable.
  if old.maker_user_id is not null
     and new.maker_user_id is distinct from old.maker_user_id then
    raise exception 'Owner settlement maker identity is immutable.'
      using errcode = '42501';
  end if;
  if old.checker_user_id is not null
     and new.checker_user_id is distinct from old.checker_user_id then
    raise exception 'Owner settlement checker identity is immutable.'
      using errcode = '42501';
  end if;

  v_maker := old.maker_user_id;
  v_checker := old.checker_user_id;

  if v_maker is null then
    v_maker := new.maker_user_id;
  end if;

  -- DRAFT -> APPROVED transition: enforce maker-checker
  if upper(coalesce(old.status::text, '')) = 'DRAFT'
     and upper(coalesce(new.status::text, '')) = 'APPROVED' then
    if v_actor is null then
      raise exception 'Authenticated checker identity is required to approve owner settlements.'
        using errcode = '42501';
    end if;
    if v_maker is null then
      raise exception 'Owner settlement maker identity cannot be proven; approval is blocked.'
        using errcode = '42501';
    end if;
    if v_actor = v_maker then
      if not public.wp01_is_sole_admin_allowed(new.company_id) then
        raise exception 'MAKER_CHECKER_SELF_APPROVAL_DENIED: settlement maker cannot approve the same settlement.'
          using errcode = '42501';
      end if;
      new.is_sole_admin_exception := true;
    end if;

    new.maker_user_id := v_maker;
    new.checker_user_id := v_actor;

    if new.approved_by is null or new.approved_by <> v_actor then
      raise exception 'Settlement approved_by must match the authenticated checker.'
        using errcode = '42501';
    end if;
  end if;

  -- APPROVED -> PAID transition: enforce original maker check
  if upper(coalesce(old.status::text, '')) = 'APPROVED'
     and upper(coalesce(new.status::text, '')) = 'PAID' then
    if v_actor is null then
      raise exception 'Authenticated payout actor is required for owner settlements.'
        using errcode = '42501';
    end if;
    if v_maker is null then
      raise exception 'Owner settlement maker identity cannot be proven; payout is blocked.'
        using errcode = '42501';
    end if;
    if v_actor = v_maker then
      if not public.wp01_is_sole_admin_allowed(new.company_id) then
        raise exception 'MAKER_CHECKER_SELF_PAYMENT_DENIED: settlement maker cannot pay the same settlement.'
          using errcode = '42501';
      end if;
      new.is_sole_admin_exception := true;
    end if;
    if v_checker is null then
      raise exception 'Owner settlement checker identity cannot be proven; payout is blocked.'
        using errcode = '42501';
    end if;

    new.maker_user_id := v_maker;
    new.checker_user_id := v_checker;
  end if;

  return new;
end;
$$;

-- Case C: Receipt VOID Approval RPC
create or replace function public.approve_receipt_void_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := public.current_company_id();
  v_void_request_id uuid := nullif(btrim(payload->>'void_request_id'), '')::uuid;
  v_execution_request_id text := nullif(btrim(payload->>'request_id'), '');
  v_request public.receipt_void_requests%rowtype;
  v_result jsonb;
begin
  if v_actor is null or not exists (
    select 1
    from public.users u
    where u.id = v_actor
      and u.status::text = 'ACTIVE'
      and u.role::text in ('ADMIN', 'MANAGER')
  ) then
    raise exception 'ADMIN or MANAGER role is required to approve receipt VOID.'
      using errcode = '42501';
  end if;

  if v_company_id is null then
    raise exception 'Company context is required to approve receipt VOID.'
      using errcode = '42501';
  end if;

  if v_void_request_id is null or v_execution_request_id is null then
    raise exception 'void_request_id and request_id are required.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('receipt_void_approval:' || v_company_id::text || ':' || v_void_request_id::text, 0)
  );

  select q.*
    into v_request
  from public.receipt_void_requests q
  where q.id = v_void_request_id
    and q.company_id = v_company_id
  for update;

  if v_request.id is null then
    raise exception 'Receipt VOID request was not found in the active company.'
      using errcode = 'P0002';
  end if;

  if v_request.status = 'EXECUTED' then
    if v_request.execution_request_id <> v_execution_request_id
       or v_request.result_payload is null then
      raise exception 'RECEIPT_VOID_REQUEST_ALREADY_EXECUTED'
        using errcode = '22023';
    end if;
    return v_request.result_payload || jsonb_build_object('idempotent', true);
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'Only PENDING receipt VOID requests can be approved.'
      using errcode = '22023';
  end if;

  if v_request.requested_by = v_actor then
    if not public.wp01_is_sole_admin_allowed(v_company_id) then
      raise exception 'MAKER_CHECKER_SELF_APPROVAL_DENIED: receipt VOID requester cannot approve the same request.'
        using errcode = '42501';
    end if;
  end if;

  v_result := public.execute_receipt_void_internal(jsonb_build_object(
    'receipt_id', v_request.receipt_id,
    'reason', v_request.reason,
    'request_id', 'void-approved:' || v_execution_request_id
  ));

  v_result := v_result || jsonb_build_object(
    'void_request_id', v_request.id,
    'void_request_status', 'EXECUTED',
    'requested_by', v_request.requested_by,
    'approved_by', v_actor,
    'approval_request_id', v_execution_request_id
  );

  update public.receipt_void_requests
     set status = 'EXECUTED',
         reviewed_by = v_actor,
         reviewed_at = now(),
         execution_request_id = v_execution_request_id,
         reversal_batch_id = nullif(v_result->>'journal_reversal_batch_id', '')::uuid,
         result_payload = v_result,
         is_sole_admin_exception = (v_request.requested_by = v_actor),
         updated_at = now()
   where id = v_request.id;

  insert into public.audit_log (
    user_id, action, entity, entity_id, note, "table", details
  ) values (
    v_actor, 'RECEIPT_VOID_APPROVED', 'receipts', v_request.receipt_id,
    'Receipt VOID approved with reason: ' || v_request.reason, 'receipts',
    jsonb_build_object(
      'void_request_id', v_request.id,
      'is_sole_admin_exception', (v_request.requested_by = v_actor)
    )::text
  );

  return v_result || jsonb_build_object('idempotent', false);
end;
$function$;

-- Case D: Deposit Claim Approval/Rejection RPCs
create or replace function public.approve_deposit_application_claim_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_claim_id uuid := nullif(p_payload->>'claim_id','')::uuid;
  v_claim public.deposit_application_claims%rowtype;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'DEPOSIT_CLAIM_APPROVER_ROLE_REQUIRED' using errcode='42501';
  end if;
  v_company_id := public.require_company_id();
  select * into v_claim from public.deposit_application_claims
   where id=v_claim_id and company_id=v_company_id for update;
  if not found then raise exception 'DEPOSIT_CLAIM_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if v_claim.status='APPROVED' then
    return jsonb_build_object('success',true,'idempotent',true,'claim_id',v_claim.id,'status',v_claim.status);
  end if;
  if v_claim.status<>'PENDING' then raise exception 'DEPOSIT_CLAIM_NOT_PENDING' using errcode='22023'; end if;
  
  if v_claim.created_by=v_actor then
    if not public.wp01_is_sole_admin_allowed(v_company_id) then
      raise exception 'DEPOSIT_CLAIM_MAKER_CHECKER_REQUIRED' using errcode='42501';
    end if;
  end if;

  update public.deposit_application_claims
     set status='APPROVED',
         approved_by=v_actor,
         approved_at=now(),
         is_sole_admin_exception=(v_claim.created_by=v_actor),
         updated_at=now()
   where id=v_claim.id;
  return jsonb_build_object('success',true,'idempotent',false,'claim_id',v_claim.id,'status','APPROVED');
end;
$fn$;

create or replace function public.reject_deposit_application_claim_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_claim_id uuid := nullif(p_payload->>'claim_id','')::uuid;
  v_reason text := nullif(btrim(p_payload->>'rejection_reason'),'');
  v_claim public.deposit_application_claims%rowtype;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'DEPOSIT_CLAIM_APPROVER_ROLE_REQUIRED' using errcode='42501';
  end if;
  if v_reason is null then raise exception 'DEPOSIT_REJECTION_REASON_REQUIRED' using errcode='22023'; end if;
  v_company_id := public.require_company_id();
  select * into v_claim from public.deposit_application_claims
   where id=v_claim_id and company_id=v_company_id for update;
  if not found then raise exception 'DEPOSIT_CLAIM_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if v_claim.status='REJECTED' then
    return jsonb_build_object('success',true,'idempotent',true,'claim_id',v_claim.id,'status','REJECTED');
  end if;
  if v_claim.status<>'PENDING' then raise exception 'DEPOSIT_CLAIM_NOT_PENDING' using errcode='22023'; end if;

  if v_claim.created_by=v_actor then
    if not public.wp01_is_sole_admin_allowed(v_company_id) then
      raise exception 'DEPOSIT_CLAIM_MAKER_CHECKER_REQUIRED' using errcode='42501';
    end if;
  end if;

  update public.deposit_application_claims
     set status='REJECTED',
         rejected_by=v_actor,
         rejected_at=now(),
         rejection_reason=v_reason,
         is_sole_admin_exception=(v_claim.created_by=v_actor),
         updated_at=now()
   where id=v_claim.id;
  return jsonb_build_object('success',true,'idempotent',false,'claim_id',v_claim.id,'status','REJECTED');
end;
$fn$;

-- Case E: Tax Profile Activation RPC
create or replace function public.approve_tax_profile_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_profile_id uuid := nullif(p_payload->>'profile_id','')::uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_profile public.company_tax_profiles%rowtype;
  v_cached jsonb;
  v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'TAX_PROFILE_APPROVER_ROLE_REQUIRED' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if v_profile_id is null or v_request_id is null then
    raise exception 'TAX_PROFILE_APPROVE_ID_REQUEST_REQUIRED' using errcode = '22023';
  end if;

  select * into v_profile
    from public.company_tax_profiles where id = v_profile_id and company_id = v_company_id for update;
  if not found then
    raise exception 'TAX_PROFILE_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;
  if v_profile.status = 'ACTIVE' then
    return jsonb_build_object('success', true, 'idempotent', true, 'profile_id', v_profile.id, 'status', 'ACTIVE');
  end if;
  if v_profile.status <> 'DRAFT' then
    raise exception 'TAX_PROFILE_NOT_DRAFT' using errcode = '22023';
  end if;

  if v_profile.created_by = v_actor then
    if not public.wp01_is_sole_admin_allowed(v_company_id) then
      raise exception 'TAX_PROFILE_MAKER_CHECKER_REQUIRED: a different approver must activate the profile.' using errcode = '42501';
    end if;
  end if;

  -- Supersede any currently ACTIVE profile with an overlapping effective window.
  update public.company_tax_profiles
     set status = 'SUPERSEDED', updated_at = now()
   where company_id = v_company_id
     and id <> v_profile.id
     and status = 'ACTIVE'
     and (effective_to is null or effective_from <= coalesce(v_profile.effective_to, 'infinity'::date));

  update public.company_tax_profiles
     set status = 'ACTIVE',
         approved_by = v_actor,
         approved_at = now(),
         is_sole_admin_exception = (v_profile.created_by = v_actor),
         updated_at = now()
   where id = v_profile.id;

  v_result := jsonb_build_object('success', true, 'idempotent', false, 'profile_id', v_profile.id, 'status', 'ACTIVE',
    'tax_code', v_profile.tax_code, 'tax_rate', v_profile.tax_rate, 'request_id', v_request_id);
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('approve_tax_profile_atomic:' || v_company_id::text, v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;
  return v_result;
end;
$fn$;

commit;
