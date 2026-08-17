-- GAP-004 / OPS-005 / DOM-004
-- Atomic RC1 owner-agency creation with an explicit first commercial version.
-- Existing historical rows are not changed. MASTER_LEASE remains excluded from
-- RC1 and is rejected by this public creation boundary.

begin;

create or replace function public.create_owner_agreement_with_version_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_agreement jsonb;
  v_version jsonb;
  v_agreement_type text := coalesce(nullif(payload->>'agreement_type', ''), 'property_management');
begin
  if v_agreement_type <> 'property_management' then
    raise exception 'MASTER_LEASE_EXCLUDED_FROM_RC1' using errcode = '0A000';
  end if;

  -- Reuse the existing company, role, ownership, overlap and field validation.
  select to_jsonb(public.create_owner_agreement_atomic(payload)) into v_agreement;

  -- The first version is created in this same transaction. Any invalid terms
  -- roll back both records, so an unversioned agreement cannot escape.
  execute 'select to_jsonb(public.create_owner_agreement_version_atomic($1,$2))'
    into v_version
    using
      (v_agreement->>'id')::uuid,
      jsonb_build_object(
        'operating_model', coalesce(nullif(payload->>'operating_model', ''), 'OWNER_AGENCY'),
        'collection_role', nullif(payload->>'collection_role', ''),
        'commission_type', payload->>'commission_type',
        'commission_value', payload->>'commission_value',
        'offset_allowed', coalesce(nullif(payload->>'offset_allowed', '')::boolean, false),
        'reserve_amount', coalesce(nullif(payload->>'reserve_amount', '')::numeric, 0),
        'deposit_beneficiary', nullif(payload->>'deposit_beneficiary', ''),
        'deposit_custodian', nullif(payload->>'deposit_custodian', ''),
        'effective_from', payload->>'starts_on',
        'effective_to', nullif(payload->>'ends_on', ''),
        'notes', nullif(payload->>'notes', '')
      );

  if v_version->>'id' is null then
    raise exception 'OWNER_AGREEMENT_INITIAL_VERSION_REQUIRED' using errcode = '23514';
  end if;

  select to_jsonb(agreement_record) into strict v_agreement
  from public.owner_agreements agreement_record
  where agreement_record.id = (v_agreement->>'id')::uuid
    and agreement_record.company_id = public.require_company_id();

  return v_agreement;
end;
$function$;

alter function public.create_owner_agreement_with_version_atomic(jsonb) owner to postgres;
revoke all on function public.create_owner_agreement_with_version_atomic(jsonb) from public, anon;
grant execute on function public.create_owner_agreement_with_version_atomic(jsonb) to authenticated, service_role;

comment on function public.create_owner_agreement_with_version_atomic(jsonb)
is 'GAP-004: atomically creates an RC1 owner-agency identity and its explicit first immutable commercial version; MASTER_LEASE is excluded.';

create or replace function public.create_property_with_versioned_agreement_atomic(
  p_title text,
  p_type text,
  p_address text,
  p_owner_id uuid,
  p_agreement_type text,
  p_commission_type text,
  p_commission_value numeric,
  p_agreement_starts_on date,
  p_agreement_ends_on date default null,
  p_owner_name text default null,
  p_purchase_value numeric default null,
  p_current_value numeric default null,
  p_status text default 'active',
  p_notes text default null,
  p_collection_role text default 'OWNER_IS_CREDITOR'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_result jsonb;
  v_version jsonb;
begin
  if p_agreement_type <> 'property_management' then
    raise exception 'MASTER_LEASE_EXCLUDED_FROM_RC1' using errcode = '0A000';
  end if;

  select public.create_property_with_agreement(
    p_title, p_type, p_address, p_owner_id, p_agreement_type,
    p_commission_type, p_commission_value, p_agreement_starts_on,
    p_agreement_ends_on, p_owner_name, p_purchase_value, p_current_value,
    p_status, p_notes
  ) into v_result;

  execute 'select to_jsonb(public.create_owner_agreement_version_atomic($1,$2))'
    into v_version
    using
      (v_result->>'agreement_id')::uuid,
      jsonb_build_object(
        'operating_model', 'OWNER_AGENCY',
        'collection_role', p_collection_role,
        'commission_type', p_commission_type,
        'commission_value', p_commission_value,
        'effective_from', p_agreement_starts_on,
        'effective_to', p_agreement_ends_on,
        'notes', p_notes
      );

  if v_version->>'id' is null then
    raise exception 'OWNER_AGREEMENT_INITIAL_VERSION_REQUIRED' using errcode = '23514';
  end if;

  return v_result;
end;
$function$;

alter function public.create_property_with_versioned_agreement_atomic(text,text,text,uuid,text,text,numeric,date,date,text,numeric,numeric,text,text,text) owner to postgres;
revoke all on function public.create_property_with_versioned_agreement_atomic(text,text,text,uuid,text,text,numeric,date,date,text,numeric,numeric,text,text,text) from public, anon;
grant execute on function public.create_property_with_versioned_agreement_atomic(text,text,text,uuid,text,text,numeric,date,date,text,numeric,numeric,text,text,text) to authenticated, service_role;

comment on function public.create_property_with_versioned_agreement_atomic(text,text,text,uuid,text,text,numeric,date,date,text,numeric,numeric,text,text,text)
is 'GAP-004: atomically creates a property, ownership, RC1 owner-agency identity and first commercial version.';

-- Browser amendments must be genuinely future-dated. The lower-level kernel is
-- retained for same-transaction initial-version creation and controlled service
-- operations, but is no longer directly executable by an authenticated client.
create or replace function public.create_future_owner_agreement_version_atomic(
  p_owner_agreement_id uuid,
  p_terms jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_effective_from date := nullif(p_terms->>'effective_from', '')::date;
  v_has_current boolean;
  v_result jsonb;
begin
  select exists (
    select 1
    from public.owner_agreement_versions version_record
    where version_record.owner_agreement_id = p_owner_agreement_id
      and version_record.company_id = v_company
      and version_record.superseded_at is null
  ) into v_has_current;

  if v_effective_from is null then
    raise exception 'OWNER_AGREEMENT_VERSION_EFFECTIVE_DATE_REQUIRED' using errcode = '22023';
  end if;
  if v_has_current and v_effective_from <= current_date then
    raise exception 'OWNER_AGREEMENT_VERSION_MUST_BE_FUTURE' using errcode = '22023';
  end if;

  execute 'select to_jsonb(public.create_owner_agreement_version_atomic($1,$2))'
    into v_result
    using p_owner_agreement_id, p_terms;
  return v_result;
end;
$function$;

alter function public.create_future_owner_agreement_version_atomic(uuid,jsonb) owner to postgres;
do $revoke_legacy$
begin
  if to_regprocedure('public.create_owner_agreement_version_atomic(uuid,jsonb)') is not null then
    execute 'revoke all on function public.create_owner_agreement_version_atomic(uuid,jsonb) from authenticated';
  end if;
end;
$revoke_legacy$;
revoke all on function public.create_future_owner_agreement_version_atomic(uuid,jsonb) from public, anon;
grant execute on function public.create_future_owner_agreement_version_atomic(uuid,jsonb) to authenticated, service_role;

comment on function public.create_future_owner_agreement_version_atomic(uuid,jsonb)
is 'GAP-004 browser authority: creates only a genuinely future owner-agreement amendment and delegates immutable versioning to the controlled kernel.';

commit;
