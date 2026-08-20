-- Phase 3A-1A runtime compatibility discovered by execution tests.
-- 1) cost_centers historically lacked company_id although the hardened expense RPCs
--    correctly require company ownership.
-- 2) normalize the legacy UI alias "damage" to the canonical ledger reason.
begin;

alter table public.cost_centers
  add column if not exists company_id uuid references public.companies(id);

update public.cost_centers cc
set company_id = p.company_id
from public.properties p
where cc.property_id::text = p.id::text
  and cc.company_id is null;

create index if not exists idx_cost_centers_company_id
  on public.cost_centers(company_id);

create or replace function public.phase3a1a_set_cost_center_company()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_property_company_id uuid;
begin
  if new.property_id is not null then
    select p.company_id into v_property_company_id
    from public.properties p
    where p.id::text = new.property_id::text
      and p.deleted_at is null;
    if v_property_company_id is null then
      raise exception 'Cost center property was not found.' using errcode = '23503';
    end if;
    if new.company_id is not null and new.company_id <> v_property_company_id then
      raise exception 'Cost center company does not match its property.' using errcode = '23514';
    end if;
    new.company_id := v_property_company_id;
  elsif new.company_id is null then
    new.company_id := public.current_company_id();
  end if;

  if new.company_id is null then
    raise exception 'Cost center company is required.' using errcode = '23502';
  end if;
  return new;
end;
$$;

revoke all on function public.phase3a1a_set_cost_center_company() from public, anon, authenticated;

drop trigger if exists trg_phase3a1a_cost_center_company on public.cost_centers;
create trigger trg_phase3a1a_cost_center_company
before insert or update of property_id, company_id on public.cost_centers
for each row execute function public.phase3a1a_set_cost_center_company();

create or replace function public.deduct_deposit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_deposit_id text := nullif(p_payload->>'deposit_id', '');
  v_payload_property_id text := nullif(p_payload->>'property_id', '');
  v_deposit_property_id text;
  v_cached jsonb;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role required' using errcode = '42501';
  end if;
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_company_id is null then
    raise exception 'Active company is required.' using errcode = '42501';
  end if;
  if v_request_id is not null then
    select response_payload into v_cached
    from public.financial_operation_idempotency
    where operation_name = 'deduct_deposit_atomic:' || v_company_id::text
      and request_id = v_request_id;
    if v_cached is not null then
      return v_cached || jsonb_build_object('idempotent', true);
    end if;
  end if;
  if v_deposit_id is null then
    raise exception 'deposit_id required' using errcode = '22023';
  end if;
  select td.property_id::text into v_deposit_property_id
  from public.tenant_deposits td
  where td.id::text = v_deposit_id
    and td.company_id = v_company_id
    and td.deleted_at is null
  for share;
  if not found then
    raise exception 'Deposit not found in current company.' using errcode = '42501';
  end if;
  if v_payload_property_id is not null and v_payload_property_id <> v_deposit_property_id then
    raise exception 'Deposit property does not match canonical deposit property.' using errcode = '22023';
  end if;

  v_payload := jsonb_set(v_payload, '{property_id}', to_jsonb(v_deposit_property_id), true);
  if nullif(v_payload->>'reason', '') = 'damage' then
    v_payload := jsonb_set(v_payload, '{reason}', to_jsonb('maintenance_damage'::text), true);
  end if;

  return public.deduct_deposit_atomic_phase3a1a_impl(v_payload);
end;
$$;

revoke all on function public.deduct_deposit_atomic(jsonb) from public, anon;
grant execute on function public.deduct_deposit_atomic(jsonb) to authenticated, service_role;

commit;
