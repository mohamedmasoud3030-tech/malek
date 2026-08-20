-- S04-T02 follow-up hardening.
-- 1) Close the deployment window between T01 and T02 by versioning any
--    property_management agreement created through a legacy path after T01.
-- 2) Re-check coverage after the parent-row lock so concurrent first
--    activations converge on one version instead of racing.

begin;

with inserted as (
  insert into public.owner_agreement_versions (
    owner_agreement_id, company_id, version_no, operating_model,
    collection_role, commission_type, commission_value,
    commission_recognition_basis, offset_allowed, reserve_amount,
    effective_from, effective_to, notes, created_at
  )
  select
    oa.id,
    oa.company_id,
    1,
    'OWNER_AGENCY',
    'OWNER_IS_CREDITOR',
    oa.commission_type,
    oa.commission_value,
    case when oa.commission_type='RATE' then 'ON_COLLECTION' else 'DAILY_ACCRUAL' end,
    false,
    0,
    oa.starts_on,
    oa.ends_on,
    oa.notes,
    coalesce(oa.created_at,now())
  from public.owner_agreements oa
  where oa.agreement_type='property_management'
    and not exists (
      select 1 from public.owner_agreement_versions v
      where v.owner_agreement_id=oa.id
        and v.company_id=oa.company_id
    )
  returning id, owner_agreement_id, company_id
)
update public.owner_agreements oa
set current_version_id=i.id,
    updated_at=now()
from inserted i
where oa.id=i.owner_agreement_id
  and oa.company_id=i.company_id
  and oa.current_version_id is null;

-- Snapshot any ACTIVE contracts that were created in the runtime interval
-- after T01 but before T02 and therefore missed the first T02 candidate pass.
with candidate as (
  select distinct on (c.id)
    c.id contract_id,
    v.id version_id,
    v.collection_role,
    v.operating_model
  from public.contracts c
  join public.owner_agreements oa
    on oa.id=c.agreement_id and oa.company_id=c.company_id
  join public.owner_agreement_versions v
    on v.owner_agreement_id=oa.id and v.company_id=c.company_id
  where lower(coalesce(c.status,''))='active'
    and c.deleted_at is null
    and oa.agreement_type='property_management'
    and c.agreement_version_id is null
    and btrim(coalesce(c.start_date::text,'')) ~ '^\d{4}-\d{2}-\d{2}$'
    and btrim(coalesce(c.end_date::text,'')) ~ '^\d{4}-\d{2}-\d{2}$'
    and v.effective_from <= btrim(c.start_date::text)::date
    and (v.effective_to is null or v.effective_to >= btrim(c.end_date::text)::date)
  order by c.id,v.version_no desc
)
update public.contracts c
set agreement_version_id=candidate.version_id,
    collection_role_snapshot=candidate.collection_role,
    operating_model_snapshot=candidate.operating_model
from candidate
where c.id=candidate.contract_id;

create or replace function public.owner_agreement_version_for_contract_internal(
  p_owner_agreement_id uuid,
  p_company_id uuid,
  p_start date,
  p_end date
)
returns public.owner_agreement_versions
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_parent public.owner_agreements%rowtype;
  v_version public.owner_agreement_versions%rowtype;
begin
  select v.* into v_version
  from public.owner_agreement_versions v
  where v.owner_agreement_id=p_owner_agreement_id
    and v.company_id=p_company_id
    and v.effective_from <= p_start
    and (v.effective_to is null or v.effective_to >= p_end)
  order by v.version_no desc
  limit 1;
  if found then return v_version; end if;

  select * into v_parent
  from public.owner_agreements
  where id=p_owner_agreement_id
    and company_id=p_company_id
  for update;

  if not found or v_parent.agreement_type <> 'property_management' then
    raise exception 'CONTRACT_AGREEMENT_VERSION_COVERAGE_REQUIRED' using errcode='23514';
  end if;

  -- A concurrent first activation may have created version 1 while this
  -- transaction waited on the parent lock. Re-check after acquiring it.
  select v.* into v_version
  from public.owner_agreement_versions v
  where v.owner_agreement_id=p_owner_agreement_id
    and v.company_id=p_company_id
    and v.effective_from <= p_start
    and (v.effective_to is null or v.effective_to >= p_end)
  order by v.version_no desc
  limit 1;
  if found then return v_version; end if;

  -- Once any version exists, a missing covering version is intentional history
  -- or a real coverage gap; never manufacture a bridge across it.
  if exists (
    select 1 from public.owner_agreement_versions
    where owner_agreement_id=p_owner_agreement_id
      and company_id=p_company_id
  ) then
    raise exception 'CONTRACT_AGREEMENT_VERSION_COVERAGE_REQUIRED' using errcode='23514';
  end if;

  if v_parent.starts_on > p_start
     or (v_parent.ends_on is not null and v_parent.ends_on < p_end) then
    raise exception 'CONTRACT_AGREEMENT_VERSION_COVERAGE_REQUIRED' using errcode='23514';
  end if;

  insert into public.owner_agreement_versions (
    owner_agreement_id,company_id,version_no,operating_model,collection_role,
    commission_type,commission_value,commission_recognition_basis,
    offset_allowed,reserve_amount,effective_from,effective_to,notes,created_at
  ) values (
    v_parent.id,v_parent.company_id,1,'OWNER_AGENCY','OWNER_IS_CREDITOR',
    v_parent.commission_type,v_parent.commission_value,
    case when v_parent.commission_type='RATE' then 'ON_COLLECTION' else 'DAILY_ACCRUAL' end,
    false,0,v_parent.starts_on,v_parent.ends_on,v_parent.notes,coalesce(v_parent.created_at,now())
  ) returning * into v_version;

  update public.owner_agreements
  set current_version_id=v_version.id,
      updated_at=now()
  where id=v_parent.id
    and company_id=v_parent.company_id
    and current_version_id is null;

  return v_version;
end;
$function$;

alter function public.owner_agreement_version_for_contract_internal(uuid,uuid,date,date) owner to postgres;
revoke all on function public.owner_agreement_version_for_contract_internal(uuid,uuid,date,date) from public,anon,authenticated;
grant execute on function public.owner_agreement_version_for_contract_internal(uuid,uuid,date,date) to service_role;

commit;
