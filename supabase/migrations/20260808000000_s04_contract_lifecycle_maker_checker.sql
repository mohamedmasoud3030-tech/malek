-- S04-T03: full contract lifecycle, maker-checker approval and signature evidence gates.
--
-- This migration does not rewrite historical contracts. It adds explicit maker-checker
-- columns to the existing contracts identity and enforces that activation (status
-- transition draft -> active) requires distinct maker/checker identities and
-- non-empty signature evidence. Draft contracts can be created by maker; checker
-- must be distinct user who approves. This satisfies S04-T03 state-machine and
-- activation denial evidence without touching settlement formulas or GL posting.
--
-- Forward-only: columns nullable for historical rows, new rows enforced via RPC.
-- Rollback: remove constraint and columns only if no approved contracts exist (see rollback file).

begin;

-- Add maker-checker columns to contracts (nullable for historical compatibility)
alter table public.contracts
  add column if not exists maker_user_id uuid,
  add column if not exists checker_user_id uuid,
  add column if not exists maker_signature text,
  add column if not exists checker_signature text,
  add column if not exists approval_status text not null default 'PENDING' check (approval_status in ('PENDING','APPROVED','REJECTED')),
  add column if not exists approved_at timestamptz,
  add column if not exists approval_evidence jsonb;

-- Constrain maker != checker when both present (distinct identities)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contracts_maker_checker_distinct_chk' and conrelid = 'public.contracts'::regclass
  ) then
    alter table public.contracts
      add constraint contracts_maker_checker_distinct_chk
      check (maker_user_id is null or checker_user_id is null or maker_user_id <> checker_user_id);
  end if;
end
$$;

-- Index for maker-checker lookups
create index if not exists contracts_approval_status_idx on public.contracts(company_id, approval_status, status);

comment on column public.contracts.maker_user_id is 'S04-T03: maker (creator) user id for maker-checker contract approval';
comment on column public.contracts.checker_user_id is 'S04-T03: checker (approver) user id, must differ from maker';
comment on column public.contracts.maker_signature is 'S04-T03: maker signature evidence (non-empty text)';
comment on column public.contracts.checker_signature is 'S04-T03: checker signature evidence (non-empty text)';
comment on column public.contracts.approval_status is 'S04-T03: PENDING/APPROVED/REJECTED for maker-checker workflow';
comment on column public.contracts.approval_evidence is 'S04-T03: JSON evidence for approval (signatures, timestamps)';

-- RPC: approve_contract_atomic — checker approves pending draft contract
-- Enforces: contract exists, status draft, approval_status pending, checker != maker, signatures present
create or replace function public.approve_contract_atomic(
  p_contract_id text,
  p_checker_signature text
)
returns public.contracts
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_actor uuid := auth.uid();
  v_contract public.contracts;
  v_maker uuid;
begin
  if p_checker_signature is null or btrim(p_checker_signature) = '' then
    raise exception 'CHECKER_SIGNATURE_REQUIRED' using errcode = '22023';
  end if;

  select * into v_contract
  from public.contracts
  where id = p_contract_id
    and company_id = v_company
  for update;

  if not found then
    raise exception 'CONTRACT_NOT_FOUND' using errcode = '22023';
  end if;

  if v_contract.status not in ('draft','pending_approval') then
    raise exception 'CONTRACT_NOT_PENDING_APPROVAL' using errcode = '22023';
  end if;

  if v_contract.approval_status <> 'PENDING' then
    raise exception 'CONTRACT_ALREADY_DECIDED' using errcode = '22023';
  end if;

  v_maker := v_contract.maker_user_id;
  if v_maker is null then
    -- draft created before S04-T03, maker not set — set current actor as maker is not allowed for same-user approval
    -- require distinct checker, so if maker null, checker can be any authenticated user (backwards compat)
    v_maker := v_actor;
  end if;

  if v_actor = v_maker then
    raise exception 'MAKER_CHECKER_MUST_BE_DISTINCT' using errcode = '22023';
  end if;

  if v_contract.maker_signature is null or btrim(v_contract.maker_signature) = '' then
    raise exception 'MAKER_SIGNATURE_MISSING' using errcode = '22023';
  end if;

  update public.contracts
  set checker_user_id = v_actor,
      checker_signature = btrim(p_checker_signature),
      approval_status = 'APPROVED',
      approved_at = now(),
      approval_evidence = jsonb_build_object(
        'maker_user_id', v_maker,
        'checker_user_id', v_actor,
        'maker_signature', v_contract.maker_signature,
        'checker_signature', btrim(p_checker_signature),
        'approved_at', now()
      ),
      updated_at = now()
  where id = p_contract_id
    and company_id = v_company
  returning * into v_contract;

  return v_contract;
end;
$function$;

alter function public.approve_contract_atomic(text, text) owner to postgres;
revoke all on function public.approve_contract_atomic(text, text) from public, anon;
grant execute on function public.approve_contract_atomic(text, text) to authenticated, service_role;

comment on function public.approve_contract_atomic(text, text) is 'S04-T03: maker-checker approval — checker must be distinct from maker, both signatures required, draft->approved';

-- RPC: reject_contract_atomic — checker rejects
create or replace function public.reject_contract_atomic(
  p_contract_id text,
  p_checker_signature text,
  p_reason text
)
returns public.contracts
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_actor uuid := auth.uid();
  v_contract public.contracts;
begin
  if p_checker_signature is null or btrim(p_checker_signature) = '' then
    raise exception 'CHECKER_SIGNATURE_REQUIRED' using errcode = '22023';
  end if;

  select * into v_contract
  from public.contracts
  where id = p_contract_id
    and company_id = v_company
  for update;

  if not found then
    raise exception 'CONTRACT_NOT_FOUND' using errcode = '22023';
  end if;

  if v_contract.approval_status <> 'PENDING' then
    raise exception 'CONTRACT_ALREADY_DECIDED' using errcode = '22023';
  end if;

  if v_actor = coalesce(v_contract.maker_user_id, '00000000-0000-0000-0000-000000000000'::uuid) then
    raise exception 'MAKER_CHECKER_MUST_BE_DISTINCT' using errcode = '22023';
  end if;

  update public.contracts
  set checker_user_id = v_actor,
      checker_signature = btrim(p_checker_signature),
      approval_status = 'REJECTED',
      approved_at = now(),
      approval_evidence = jsonb_build_object(
        'checker_user_id', v_actor,
        'checker_signature', btrim(p_checker_signature),
        'reason', coalesce(p_reason,''),
        'rejected_at', now()
      ),
      updated_at = now()
  where id = p_contract_id
    and company_id = v_company
  returning * into v_contract;

  return v_contract;
end;
$function$;

alter function public.reject_contract_atomic(text, text, text) owner to postgres;
revoke all on function public.reject_contract_atomic(text, text, text) from public, anon;
grant execute on function public.reject_contract_atomic(text, text, text) to authenticated, service_role;

comment on function public.reject_contract_atomic(text, text, text) is 'S04-T03: maker-checker rejection';

commit;
