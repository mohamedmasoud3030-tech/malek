-- Restore the Phase 3A-1A company-idempotency wrapper for update expense.
begin;

create or replace function public.update_expense_with_journal_atomic(p_payload jsonb)
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

revoke all on function public.update_expense_with_journal_atomic(jsonb) from public, anon;
grant execute on function public.update_expense_with_journal_atomic(jsonb) to authenticated, service_role;

commit;
