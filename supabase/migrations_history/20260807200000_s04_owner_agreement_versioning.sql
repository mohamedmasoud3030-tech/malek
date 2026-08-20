-- S04-T01: versioned owner-agency commercial terms.
--
-- This migration does not rewrite historical agreement rows. It introduces an
-- append-oriented terms table and a current-version pointer on the existing
-- owner_agreements identity row. Existing property_management agreements are
-- backfilled as OWNER_AGENCY / OWNER_IS_CREDITOR using the locked canonical
-- rules; legacy master_lease rows are intentionally left outside this S04
-- owner-agency version stream because S06 owns master-lease accounting.

begin;

create table if not exists public.owner_agreement_versions (
  id uuid primary key default gen_random_uuid(),
  owner_agreement_id uuid not null references public.owner_agreements(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  operating_model text not null check (operating_model in ('OWNER_AGENCY','BROKERAGE_OR_COLLECTION_ONLY')),
  collection_role text not null check (collection_role in ('OWNER_IS_CREDITOR','OFFICE_IS_CREDITOR')),
  commission_type text not null check (commission_type in ('RATE','FIXED_MONTHLY')),
  commission_value numeric(14,4) not null,
  commission_recognition_basis text not null check (commission_recognition_basis in ('ON_COLLECTION','DAILY_ACCRUAL')),
  offset_allowed boolean not null default false,
  reserve_amount numeric(14,3) not null default 0 check (reserve_amount >= 0),
  deposit_beneficiary text check (deposit_beneficiary in ('OWNER','OFFICE')),
  deposit_custodian text check (deposit_custodian in ('OWNER','OFFICE')),
  effective_from date not null,
  effective_to date,
  notes text,
  superseded_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint owner_agreement_versions_date_order check (effective_to is null or effective_to >= effective_from),
  constraint owner_agreement_versions_rate_range check (
    (commission_type = 'RATE' and commission_value >= 0 and commission_value <= 100)
    or (commission_type = 'FIXED_MONTHLY' and commission_value >= 0)
  ),
  constraint owner_agreement_versions_recognition_matches_commission check (
    (commission_type = 'RATE' and commission_recognition_basis = 'ON_COLLECTION')
    or (commission_type = 'FIXED_MONTHLY' and commission_recognition_basis = 'DAILY_ACCRUAL')
  ),
  unique (owner_agreement_id, version_no)
);

create unique index if not exists owner_agreement_versions_one_current_uidx
  on public.owner_agreement_versions(owner_agreement_id)
  where superseded_at is null;

create index if not exists owner_agreement_versions_company_idx
  on public.owner_agreement_versions(company_id, owner_agreement_id, version_no desc);

alter table public.owner_agreements
  add column if not exists current_version_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'owner_agreements_current_version_fkey'
      and conrelid = 'public.owner_agreements'::regclass
  ) then
    alter table public.owner_agreements
      add constraint owner_agreements_current_version_fkey
      foreign key (current_version_id)
      references public.owner_agreement_versions(id)
      on delete restrict;
  end if;
end
$$;

alter table public.owner_agreement_versions enable row level security;

drop policy if exists owner_agreement_versions_select_company on public.owner_agreement_versions;
create policy owner_agreement_versions_select_company
  on public.owner_agreement_versions
  for select
  to authenticated
  using (company_id = public.require_company_id());

revoke all on table public.owner_agreement_versions from public, anon, authenticated;
grant select on table public.owner_agreement_versions to authenticated;
grant select, insert, update on table public.owner_agreement_versions to service_role;

-- Backfill only S04 owner-agency identities. Existing agreement commercial
-- fields become version 1; this preserves the historical row while making the
-- active contract terms explicit for future snapshots.
with inserted as (
  insert into public.owner_agreement_versions (
    owner_agreement_id,
    company_id,
    version_no,
    operating_model,
    collection_role,
    commission_type,
    commission_value,
    commission_recognition_basis,
    offset_allowed,
    reserve_amount,
    effective_from,
    effective_to,
    notes,
    created_at
  )
  select
    oa.id,
    oa.company_id,
    1,
    'OWNER_AGENCY',
    'OWNER_IS_CREDITOR',
    oa.commission_type,
    oa.commission_value,
    case when oa.commission_type = 'RATE' then 'ON_COLLECTION' else 'DAILY_ACCRUAL' end,
    false,
    0,
    oa.starts_on,
    oa.ends_on,
    oa.notes,
    coalesce(oa.created_at, now())
  from public.owner_agreements oa
  where oa.agreement_type = 'property_management'
    and not exists (
      select 1 from public.owner_agreement_versions v
      where v.owner_agreement_id = oa.id
    )
  returning id, owner_agreement_id
)
update public.owner_agreements oa
set current_version_id = i.id
from inserted i
where oa.id = i.owner_agreement_id
  and oa.current_version_id is null;

-- Repair the pointer idempotently if the version row existed from a partially
-- applied deployment but the identity pointer was not written.
update public.owner_agreements oa
set current_version_id = v.id
from public.owner_agreement_versions v
where oa.id = v.owner_agreement_id
  and oa.agreement_type = 'property_management'
  and oa.current_version_id is null
  and v.superseded_at is null;

create or replace function public.create_owner_agreement_version_atomic(
  p_owner_agreement_id uuid,
  p_terms jsonb
)
returns public.owner_agreement_versions
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_company uuid := public.require_company_id();
  v_parent public.owner_agreements%rowtype;
  v_current public.owner_agreement_versions%rowtype;
  v_new public.owner_agreement_versions%rowtype;
  v_commission_type text;
  v_commission_value numeric;
  v_operating_model text;
  v_collection_role text;
  v_recognition text;
  v_effective_from date;
  v_effective_to date;
begin
  if v_actor is null or not public.is_admin_or_manager() then
    raise exception 'OWNER_AGREEMENT_VERSION_FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_parent
  from public.owner_agreements
  where id = p_owner_agreement_id
    and company_id = v_company
  for update;

  if not found or v_parent.agreement_type <> 'property_management' then
    raise exception 'OWNER_AGREEMENT_NOT_FOUND_OR_NOT_AGENCY' using errcode = '42501';
  end if;

  select * into v_current
  from public.owner_agreement_versions
  where owner_agreement_id = p_owner_agreement_id
    and company_id = v_company
    and superseded_at is null
  for update;

  v_operating_model := coalesce(nullif(p_terms->>'operating_model',''), coalesce(v_current.operating_model,'OWNER_AGENCY'));
  v_collection_role := coalesce(nullif(p_terms->>'collection_role',''), coalesce(v_current.collection_role,'OWNER_IS_CREDITOR'));
  v_commission_type := coalesce(nullif(p_terms->>'commission_type',''), coalesce(v_current.commission_type,v_parent.commission_type));
  v_commission_value := coalesce(nullif(p_terms->>'commission_value','')::numeric, coalesce(v_current.commission_value,v_parent.commission_value));
  v_effective_from := coalesce(nullif(p_terms->>'effective_from','')::date, greatest(current_date, v_parent.starts_on));
  v_effective_to := case when p_terms ? 'effective_to' then nullif(p_terms->>'effective_to','')::date else v_parent.ends_on end;

  if v_operating_model not in ('OWNER_AGENCY','BROKERAGE_OR_COLLECTION_ONLY')
     or v_collection_role not in ('OWNER_IS_CREDITOR','OFFICE_IS_CREDITOR')
     or v_commission_type not in ('RATE','FIXED_MONTHLY') then
    raise exception 'OWNER_AGREEMENT_VERSION_TERMS_INVALID' using errcode = '22023';
  end if;

  if v_commission_value::text in ('NaN','Infinity','-Infinity')
     or (v_commission_type = 'RATE' and (v_commission_value < 0 or v_commission_value > 100))
     or (v_commission_type = 'FIXED_MONTHLY' and v_commission_value < 0)
     or (v_effective_to is not null and v_effective_to < v_effective_from) then
    raise exception 'OWNER_AGREEMENT_VERSION_TERMS_INVALID' using errcode = '22023';
  end if;

  v_recognition := case when v_commission_type = 'RATE' then 'ON_COLLECTION' else 'DAILY_ACCRUAL' end;

  if v_current.id is not null then
    if v_effective_from <= v_current.effective_from then
      raise exception 'OWNER_AGREEMENT_VERSION_RETROACTIVE_CHANGE_FORBIDDEN' using errcode = '22023';
    end if;

    update public.owner_agreement_versions
    set effective_to = v_effective_from - 1,
        superseded_at = now()
    where id = v_current.id
      and company_id = v_company;
  end if;

  insert into public.owner_agreement_versions (
    owner_agreement_id,
    company_id,
    version_no,
    operating_model,
    collection_role,
    commission_type,
    commission_value,
    commission_recognition_basis,
    offset_allowed,
    reserve_amount,
    deposit_beneficiary,
    deposit_custodian,
    effective_from,
    effective_to,
    notes,
    created_by
  ) values (
    p_owner_agreement_id,
    v_company,
    coalesce(v_current.version_no,0) + 1,
    v_operating_model,
    v_collection_role,
    v_commission_type,
    v_commission_value,
    v_recognition,
    coalesce((p_terms->>'offset_allowed')::boolean, coalesce(v_current.offset_allowed,false)),
    coalesce(nullif(p_terms->>'reserve_amount','')::numeric, coalesce(v_current.reserve_amount,0)),
    case when p_terms ? 'deposit_beneficiary' then nullif(p_terms->>'deposit_beneficiary','') else v_current.deposit_beneficiary end,
    case when p_terms ? 'deposit_custodian' then nullif(p_terms->>'deposit_custodian','') else v_current.deposit_custodian end,
    v_effective_from,
    v_effective_to,
    case when p_terms ? 'notes' then nullif(p_terms->>'notes','') else v_current.notes end,
    v_actor
  ) returning * into v_new;

  update public.owner_agreements
  set current_version_id = v_new.id,
      updated_at = now()
  where id = p_owner_agreement_id
    and company_id = v_company;

  return v_new;
end;
$function$;

alter function public.create_owner_agreement_version_atomic(uuid,jsonb) owner to postgres;
revoke all on function public.create_owner_agreement_version_atomic(uuid,jsonb) from public, anon;
grant execute on function public.create_owner_agreement_version_atomic(uuid,jsonb) to authenticated, service_role;

comment on function public.create_owner_agreement_version_atomic(uuid,jsonb)
is 'S04-T01: creates a new non-retroactive owner-agency terms version; current commercial terms are never silently overwritten.';

commit;
