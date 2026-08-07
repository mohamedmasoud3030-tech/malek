-- S04-T03: maker-checker contract lifecycle and signature evidence gates.
-- Builds on S04-T02 contract agreement snapshots already merged on main.
-- No GL, settlement, billing schedule, invoice, tax or historical financial correction changes.

begin;

alter table public.contracts
  add column if not exists maker_user_id uuid,
  add column if not exists checker_user_id uuid,
  add column if not exists maker_signature text,
  add column if not exists checker_signature text,
  add column if not exists approval_status text,
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists approval_evidence jsonb;

alter table public.contracts alter column approval_status drop default;

-- Historical rows remain NULL rather than being mislabeled as newly approved.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contracts_approval_status_chk'
      and conrelid = 'public.contracts'::regclass
  ) then
    alter table public.contracts
      add constraint contracts_approval_status_chk
      check (approval_status is null or approval_status in ('PENDING','APPROVED','REJECTED'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'contracts_maker_checker_distinct_chk'
      and conrelid = 'public.contracts'::regclass
  ) then
    alter table public.contracts
      add constraint contracts_maker_checker_distinct_chk
      check (maker_user_id is null or checker_user_id is null or maker_user_id <> checker_user_id);
  end if;
end $$;

create index if not exists contracts_approval_status_idx
  on public.contracts(company_id, approval_status, status)
  where deleted_at is null;

create or replace function public.submit_contract_for_approval_atomic(
  p_contract_id text,
  p_maker_signature text
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
  v_result jsonb;
begin
  if v_actor is null or not public.is_admin_or_manager() then
    raise exception 'CONTRACT_APPROVAL_FORBIDDEN' using errcode='42501';
  end if;
  if nullif(btrim(coalesce(p_maker_signature,'')), '') is null then
    raise exception 'MAKER_SIGNATURE_REQUIRED' using errcode='22023';
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
  if lower(coalesce(v_contract.status,'')) <> 'draft' then
    raise exception 'CONTRACT_SUBMISSION_STATE_INVALID' using errcode='22023';
  end if;
  if v_contract.approval_status = 'APPROVED' then
    raise exception 'CONTRACT_ALREADY_APPROVED' using errcode='22023';
  end if;

  update public.contracts c
  set maker_user_id = v_actor,
      checker_user_id = null,
      maker_signature = btrim(p_maker_signature),
      checker_signature = null,
      approval_status = 'PENDING',
      submitted_at = now(),
      approved_at = null,
      rejected_at = null,
      rejection_reason = null,
      approval_evidence = jsonb_build_object(
        'maker_user_id', v_actor,
        'maker_signature', btrim(p_maker_signature),
        'submitted_at', now()
      ),
      status = 'pending_approval',
      updated_at = now()
  where c.id::text = p_contract_id
    and c.company_id = v_company
  returning to_jsonb(c) into v_result;

  return v_result;
end;
$function$;

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
  if lower(coalesce(v_contract.status,'')) <> 'pending_approval'
     or v_contract.approval_status <> 'PENDING' then
    raise exception 'CONTRACT_NOT_PENDING_APPROVAL' using errcode='22023';
  end if;
  if v_contract.maker_user_id is null
     or nullif(btrim(coalesce(v_contract.maker_signature,'')), '') is null then
    raise exception 'MAKER_EVIDENCE_REQUIRED' using errcode='23514';
  end if;
  if v_actor = v_contract.maker_user_id then
    raise exception 'MAKER_CHECKER_MUST_BE_DISTINCT' using errcode='42501';
  end if;

  update public.contracts c
  set checker_user_id = v_actor,
      checker_signature = btrim(p_checker_signature),
      approval_status = 'APPROVED',
      approved_at = v_now,
      rejected_at = null,
      rejection_reason = null,
      approval_evidence = coalesce(v_contract.approval_evidence,'{}'::jsonb) || jsonb_build_object(
        'checker_user_id', v_actor,
        'checker_signature', btrim(p_checker_signature),
        'approved_at', v_now
      ),
      updated_at = v_now
  where c.id::text = p_contract_id
    and c.company_id = v_company
  returning to_jsonb(c) into v_result;

  return v_result;
end;
$function$;

create or replace function public.reject_contract_atomic(
  p_contract_id text,
  p_checker_signature text,
  p_reason text
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
  if nullif(btrim(coalesce(p_reason,'')), '') is null then
    raise exception 'REJECTION_REASON_REQUIRED' using errcode='22023';
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
  if lower(coalesce(v_contract.status,'')) <> 'pending_approval'
     or v_contract.approval_status <> 'PENDING' then
    raise exception 'CONTRACT_NOT_PENDING_APPROVAL' using errcode='22023';
  end if;
  if v_contract.maker_user_id is null or v_actor = v_contract.maker_user_id then
    raise exception 'MAKER_CHECKER_MUST_BE_DISTINCT' using errcode='42501';
  end if;

  update public.contracts c
  set checker_user_id = v_actor,
      checker_signature = btrim(p_checker_signature),
      approval_status = 'REJECTED',
      approved_at = null,
      rejected_at = v_now,
      rejection_reason = btrim(p_reason),
      approval_evidence = coalesce(v_contract.approval_evidence,'{}'::jsonb) || jsonb_build_object(
        'checker_user_id', v_actor,
        'checker_signature', btrim(p_checker_signature),
        'rejected_at', v_now,
        'reason', btrim(p_reason)
      ),
      status = 'draft',
      updated_at = v_now
  where c.id::text = p_contract_id
    and c.company_id = v_company
  returning to_jsonb(c) into v_result;

  return v_result;
end;
$function$;

-- Replace S04-T02 activation boundary: approval must be complete before activation.
create or replace function public.activate_contract_with_agreement_snapshot_atomic(p_contract_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
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
  if lower(coalesce(v_contract.status,'')) <> 'pending_approval'
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

alter function public.submit_contract_for_approval_atomic(text,text) owner to postgres;
alter function public.approve_contract_atomic(text,text) owner to postgres;
alter function public.reject_contract_atomic(text,text,text) owner to postgres;
alter function public.activate_contract_with_agreement_snapshot_atomic(text) owner to postgres;

revoke all on function public.submit_contract_for_approval_atomic(text,text) from public,anon;
revoke all on function public.approve_contract_atomic(text,text) from public,anon;
revoke all on function public.reject_contract_atomic(text,text,text) from public,anon;
revoke all on function public.activate_contract_with_agreement_snapshot_atomic(text) from public,anon;

grant execute on function public.submit_contract_for_approval_atomic(text,text) to authenticated,service_role;
grant execute on function public.approve_contract_atomic(text,text) to authenticated,service_role;
grant execute on function public.reject_contract_atomic(text,text,text) to authenticated,service_role;
grant execute on function public.activate_contract_with_agreement_snapshot_atomic(text) to authenticated,service_role;

comment on function public.submit_contract_for_approval_atomic(text,text)
  is 'S04-T03: submit a draft contract with maker identity/signature evidence for independent approval.';
comment on function public.approve_contract_atomic(text,text)
  is 'S04-T03: distinct checker approves a pending contract and records checker signature evidence.';
comment on function public.reject_contract_atomic(text,text,text)
  is 'S04-T03: distinct checker rejects a pending contract with signature and reason; contract returns to draft.';
comment on function public.activate_contract_with_agreement_snapshot_atomic(text)
  is 'S04-T03 over S04-T02: activates only an independently approved contract with complete signature evidence and frozen owner-agreement snapshot.';

commit;
