-- S04-T02: snapshot the governing owner-agreement version and collection role
-- into each owner-agency tenant contract at activation.

begin;

alter table public.contracts
  add column if not exists agreement_version_id uuid references public.owner_agreement_versions(id) on delete restrict,
  add column if not exists collection_role_snapshot text,
  add column if not exists operating_model_snapshot text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='contracts_collection_role_snapshot_check' and conrelid='public.contracts'::regclass) then
    alter table public.contracts add constraint contracts_collection_role_snapshot_check
      check (collection_role_snapshot is null or collection_role_snapshot in ('OWNER_IS_CREDITOR','OFFICE_IS_CREDITOR'));
  end if;
  if not exists (select 1 from pg_constraint where conname='contracts_operating_model_snapshot_check' and conrelid='public.contracts'::regclass) then
    alter table public.contracts add constraint contracts_operating_model_snapshot_check
      check (operating_model_snapshot is null or operating_model_snapshot in ('OWNER_AGENCY','BROKERAGE_OR_COLLECTION_ONLY'));
  end if;
end $$;

create index if not exists contracts_agreement_version_idx on public.contracts(agreement_version_id);

-- Existing ACTIVE owner-agency contracts receive the version whose effective
-- range covers their full contractual term. This is a structural snapshot;
-- no financial posting is created or changed.
with candidate as (
  select distinct on (c.id)
    c.id as contract_id,
    v.id as version_id,
    v.collection_role,
    v.operating_model
  from public.contracts c
  join public.owner_agreements oa on oa.id = c.agreement_id and oa.company_id = c.company_id
  join public.owner_agreement_versions v on v.owner_agreement_id = oa.id and v.company_id = c.company_id
  where lower(coalesce(c.status,'')) = 'active'
    and c.deleted_at is null
    and oa.agreement_type = 'property_management'
    and btrim(coalesce(c.start_date::text,'')) ~ '^\d{4}-\d{2}-\d{2}$'
    and btrim(coalesce(c.end_date::text,'')) ~ '^\d{4}-\d{2}-\d{2}$'
    and v.effective_from <= btrim(c.start_date::text)::date
    and (v.effective_to is null or v.effective_to >= btrim(c.end_date::text)::date)
  order by c.id, v.version_no desc
)
update public.contracts c
set agreement_version_id = candidate.version_id,
    collection_role_snapshot = candidate.collection_role,
    operating_model_snapshot = candidate.operating_model
from candidate
where c.id = candidate.contract_id
  and c.agreement_version_id is null;

create or replace function public.guard_contract_agreement_snapshot()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_agreement_type text;
  v_version public.owner_agreement_versions%rowtype;
  v_start date;
  v_end date;
begin
  -- Once a contract has a frozen agreement snapshot, fail before any other
  -- validation if a caller tries to rewrite it. Historical snapshots are not
  -- silently re-pointed even when a newer agreement version exists.
  if tg_op='UPDATE' and old.agreement_version_id is not null and (
    new.agreement_version_id is distinct from old.agreement_version_id
    or new.collection_role_snapshot is distinct from old.collection_role_snapshot
    or new.operating_model_snapshot is distinct from old.operating_model_snapshot
  ) then
    raise exception 'CONTRACT_AGREEMENT_SNAPSHOT_IMMUTABLE' using errcode='55000';
  end if;

  if new.agreement_id is null then return new; end if;

  select agreement_type into v_agreement_type
  from public.owner_agreements
  where id = new.agreement_id
    and company_id = new.company_id;

  if v_agreement_type = 'property_management' and lower(coalesce(new.status,'')) = 'active' then
    -- Compatibility bridge: legacy create_contract_atomic can still create an
    -- ACTIVE contract directly. Snapshot the covering agreement version inside
    -- this BEFORE trigger so the old RPC keeps working while every new active
    -- owner-agency contract still receives the S04-T02 frozen terms atomically.
    if new.agreement_version_id is null or new.collection_role_snapshot is null or new.operating_model_snapshot is null then
      if btrim(coalesce(new.start_date::text,'')) !~ '^\d{4}-\d{2}-\d{2}$'
         or btrim(coalesce(new.end_date::text,'')) !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'CONTRACT_DATES_INVALID' using errcode='22007';
      end if;
      v_start := btrim(new.start_date::text)::date;
      v_end := btrim(new.end_date::text)::date;

      select v.* into v_version
      from public.owner_agreement_versions v
      where v.owner_agreement_id = new.agreement_id
        and v.company_id = new.company_id
        and v.effective_from <= v_start
        and (v.effective_to is null or v.effective_to >= v_end)
      order by v.version_no desc
      limit 1;

      if not found then
        raise exception 'CONTRACT_AGREEMENT_VERSION_COVERAGE_REQUIRED' using errcode='23514';
      end if;

      new.agreement_version_id := v_version.id;
      new.collection_role_snapshot := v_version.collection_role;
      new.operating_model_snapshot := v_version.operating_model;
    end if;

    if not exists (
      select 1 from public.owner_agreement_versions v
      where v.id = new.agreement_version_id
        and v.owner_agreement_id = new.agreement_id
        and v.company_id = new.company_id
        and v.collection_role = new.collection_role_snapshot
        and v.operating_model = new.operating_model_snapshot
    ) then
      raise exception 'CONTRACT_AGREEMENT_SNAPSHOT_INVALID' using errcode='23514';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_contract_agreement_snapshot() from public,anon,authenticated;
drop trigger if exists contracts_agreement_snapshot_guard on public.contracts;
create trigger contracts_agreement_snapshot_guard
before insert or update of status,agreement_id,agreement_version_id,collection_role_snapshot,operating_model_snapshot,company_id
on public.contracts
for each row execute function public.guard_contract_agreement_snapshot();

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
  if lower(coalesce(v_contract.status,'')) <> 'draft' then
    raise exception 'CONTRACT_ACTIVATION_STATE_INVALID' using errcode='22023';
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

alter function public.activate_contract_with_agreement_snapshot_atomic(text) owner to postgres;
revoke all on function public.activate_contract_with_agreement_snapshot_atomic(text) from public,anon;
grant execute on function public.activate_contract_with_agreement_snapshot_atomic(text) to authenticated,service_role;

comment on function public.activate_contract_with_agreement_snapshot_atomic(text)
is 'S04-T02: activates an owner-agency contract only after snapshotting the covering agreement version and collection role.';

commit;
