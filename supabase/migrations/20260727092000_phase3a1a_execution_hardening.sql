-- Phase 3A-1A execution hardening.
-- Keeps the first additive migration intact while wrapping the affected RPCs with
-- company-scoped idempotency and canonical deposit-property enforcement.
begin;

alter function public.create_expense_with_journal_atomic(jsonb)
  rename to create_expense_with_journal_atomic_phase3a1a_impl;
alter function public.update_expense_with_journal_atomic(jsonb)
  rename to update_expense_with_journal_atomic_phase3a1a_impl;
alter function public.deduct_deposit_atomic(jsonb)
  rename to deduct_deposit_atomic_phase3a1a_impl;
alter function public.refund_deposit_atomic(jsonb)
  rename to refund_deposit_atomic_phase3a1a_impl;

revoke all on function public.create_expense_with_journal_atomic_phase3a1a_impl(jsonb) from public, anon, authenticated;
revoke all on function public.update_expense_with_journal_atomic_phase3a1a_impl(jsonb) from public, anon, authenticated;
revoke all on function public.deduct_deposit_atomic_phase3a1a_impl(jsonb) from public, anon, authenticated;
revoke all on function public.refund_deposit_atomic_phase3a1a_impl(jsonb) from public, anon, authenticated;

create function public.create_expense_with_journal_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_internal_request_id text;
  v_cached jsonb;
  v_result jsonb;
  v_impl_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to create expenses.' using errcode = '42501';
  end if;
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_company_id is null then
    raise exception 'Active company is required.' using errcode = '42501';
  end if;
  if v_request_id is null then
    return public.create_expense_with_journal_atomic_phase3a1a_impl(p_payload);
  end if;

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'create_expense_with_journal_atomic:' || v_company_id::text
    and request_id = v_request_id;
  if v_cached is not null then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  -- The wrapped implementation still contains the legacy un-namespaced lookup.
  -- Give it a company-derived internal request id so it can never read another
  -- company's historical cache row, then persist an external namespaced alias.
  v_internal_request_id := 'phase3a1a:' || v_company_id::text || ':' || v_request_id;
  v_impl_payload := jsonb_set(v_impl_payload, '{request_id}', to_jsonb(v_internal_request_id), true);
  v_result := public.create_expense_with_journal_atomic_phase3a1a_impl(v_impl_payload);
  v_result := jsonb_set(v_result, '{request_id}', to_jsonb(v_request_id), true);

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('create_expense_with_journal_atomic:' || v_company_id::text, v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$$;

create function public.update_expense_with_journal_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_internal_request_id text;
  v_cached jsonb;
  v_result jsonb;
  v_impl_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to update expenses.' using errcode = '42501';
  end if;
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_company_id is null then
    raise exception 'Active company is required.' using errcode = '42501';
  end if;
  if v_request_id is null then
    return public.update_expense_with_journal_atomic_phase3a1a_impl(p_payload);
  end if;

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'update_expense_with_journal_atomic:' || v_company_id::text
    and request_id = v_request_id;
  if v_cached is not null then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  v_internal_request_id := 'phase3a1a:' || v_company_id::text || ':' || v_request_id;
  v_impl_payload := jsonb_set(v_impl_payload, '{request_id}', to_jsonb(v_internal_request_id), true);
  v_result := public.update_expense_with_journal_atomic_phase3a1a_impl(v_impl_payload);
  v_result := jsonb_set(v_result, '{request_id}', to_jsonb(v_request_id), true);

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('update_expense_with_journal_atomic:' || v_company_id::text, v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$$;

create function public.deduct_deposit_atomic(p_payload jsonb)
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

create function public.refund_deposit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_deposit_id text := nullif(p_payload->>'deposit_id', '');
  v_cached jsonb;
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
    where operation_name = 'refund_deposit_atomic:' || v_company_id::text
      and request_id = v_request_id;
    if v_cached is not null then
      return v_cached || jsonb_build_object('idempotent', true);
    end if;
  end if;
  if v_deposit_id is null or not exists (
    select 1 from public.tenant_deposits td
    where td.id::text = v_deposit_id
      and td.company_id = v_company_id
      and td.deleted_at is null
  ) then
    raise exception 'Deposit not found in current company.' using errcode = '42501';
  end if;
  return public.refund_deposit_atomic_phase3a1a_impl(p_payload);
end;
$$;

revoke all on function public.create_expense_with_journal_atomic(jsonb) from public, anon;
revoke all on function public.update_expense_with_journal_atomic(jsonb) from public, anon;
revoke all on function public.deduct_deposit_atomic(jsonb) from public, anon;
revoke all on function public.refund_deposit_atomic(jsonb) from public, anon;

grant execute on function public.create_expense_with_journal_atomic(jsonb) to authenticated, service_role;
grant execute on function public.update_expense_with_journal_atomic(jsonb) to authenticated, service_role;
grant execute on function public.deduct_deposit_atomic(jsonb) to authenticated, service_role;
grant execute on function public.refund_deposit_atomic(jsonb) to authenticated, service_role;

commit;
