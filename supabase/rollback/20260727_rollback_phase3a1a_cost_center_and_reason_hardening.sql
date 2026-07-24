-- Safe rollback for the final Phase 3A-1A runtime compatibility layer.
-- The company_id column is intentionally retained because the preceding 91000
-- expense definitions depend on it; removing it would restore a known runtime fault.
begin;

drop trigger if exists trg_phase3a1a_cost_center_company on public.cost_centers;
drop function if exists public.phase3a1a_set_cost_center_company();

-- Restore the canonical-property wrapper without the optional legacy reason alias.
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
  return public.deduct_deposit_atomic_phase3a1a_impl(v_payload);
end;
$$;

revoke all on function public.deduct_deposit_atomic(jsonb) from public, anon;
grant execute on function public.deduct_deposit_atomic(jsonb) to authenticated, service_role;

commit;
