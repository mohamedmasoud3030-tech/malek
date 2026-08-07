-- Manual guarded rollback for S04-T03 v2.
-- Rollback for: 20260808010000_s04_contract_lifecycle_maker_checker_v2.sql
-- Refuses downgrade once any contract has maker/checker approval evidence.

begin;

do $$
begin
  if exists (
    select 1
    from public.contracts
    where approval_status is not null
       or maker_user_id is not null
       or checker_user_id is not null
       or approval_evidence is not null
  ) then
    raise exception 'S04_T03_ROLLBACK_BLOCKED_APPROVAL_HISTORY_EXISTS';
  end if;
end $$;

-- Restore the S04-T02 activation boundary before dropping S04-T03 columns.
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

drop function if exists public.submit_contract_for_approval_atomic(text,text);
drop function if exists public.approve_contract_atomic(text,text);
drop function if exists public.reject_contract_atomic(text,text,text);

drop index if exists public.contracts_approval_status_idx;

alter table public.contracts drop constraint if exists contracts_maker_checker_distinct_chk;
alter table public.contracts drop constraint if exists contracts_approval_status_chk;

alter table public.contracts
  drop column if exists maker_user_id,
  drop column if exists checker_user_id,
  drop column if exists maker_signature,
  drop column if exists checker_signature,
  drop column if exists approval_status,
  drop column if exists submitted_at,
  drop column if exists approved_at,
  drop column if exists rejected_at,
  drop column if exists rejection_reason,
  drop column if exists approval_evidence;

commit;
