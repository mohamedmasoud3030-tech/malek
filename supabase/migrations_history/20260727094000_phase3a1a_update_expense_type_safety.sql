-- Phase 3A-1A: execute update-expense safely on both UUID and text identifier baselines.
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
  v_expense_id text := nullif(p_payload->>'expense_id', '');
  v_expense public.expenses%rowtype;
  v_property_id text;
  v_cost_center_id text;
  v_contract_id text;
  v_expense_date date;
  v_amount numeric;
  v_category text;
  v_description text;
  v_charged_to text;
  v_attachment_url text;
  v_amount_changed boolean;
  v_date_changed boolean;
  v_expense_account_id public.accounts.id%type;
  v_cash_account_id public.accounts.id%type;
  v_reversal_no text;
  v_new_entry_no text;
  v_row_count integer;
  v_cached jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to update expenses.' using errcode = '42501';
  end if;
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_company_id is null then
    raise exception 'Active company is required.' using errcode = '42501';
  end if;
  if v_expense_id is null then
    raise exception 'expense_id is required.' using errcode = '22023';
  end if;
  if v_request_id is null then
    v_request_id := gen_random_uuid()::text;
  end if;

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'update_expense_with_journal_atomic:' || v_company_id::text
    and request_id = v_request_id;
  if v_cached is not null then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('update_expense:' || v_expense_id, 0));
  select * into v_expense
  from public.expenses e
  where e.id::text = v_expense_id
    and e.company_id = v_company_id
    and e.deleted_at is null
  for update;
  if not found then
    raise exception 'Expense not found or has been deleted.' using errcode = '42501';
  end if;

  v_property_id := case when p_payload ? 'property_id'
    then nullif(p_payload->>'property_id', '') else v_expense.property_id::text end;
  v_cost_center_id := case when p_payload ? 'cost_center_id'
    then nullif(p_payload->>'cost_center_id', '') else v_expense.cost_center_id::text end;
  v_contract_id := case when p_payload ? 'contract_id'
    then nullif(p_payload->>'contract_id', '') else v_expense.contract_id::text end;
  v_expense_date := case when p_payload ? 'expense_date'
    then nullif(p_payload->>'expense_date', '')::date else v_expense.expense_date end;
  v_amount := case when p_payload ? 'amount'
    then nullif(p_payload->>'amount', '')::numeric else v_expense.amount end;
  v_category := case when p_payload ? 'category'
    then nullif(p_payload->>'category', '') else v_expense.category end;
  v_description := case when p_payload ? 'description'
    then nullif(p_payload->>'description', '') else v_expense.description end;
  v_charged_to := case when p_payload ? 'charged_to'
    then nullif(p_payload->>'charged_to', '') else v_expense.charged_to end;
  v_attachment_url := case when p_payload ? 'attachment_url'
    then nullif(p_payload->>'attachment_url', '') else v_expense.attachment_url end;

  if v_property_id is null then raise exception 'property_id is required.'; end if;
  if v_expense_date is null then raise exception 'expense_date is required.'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'amount must be greater than zero.'; end if;
  if v_category is null then raise exception 'category is required.'; end if;

  if not exists (
    select 1 from public.properties p
    where p.id::text = v_property_id
      and p.company_id = v_company_id
      and p.deleted_at is null
  ) then
    raise exception 'Property not found.' using errcode = '42501';
  end if;

  if v_cost_center_id is not null and not exists (
    select 1 from public.cost_centers cc
    where cc.id::text = v_cost_center_id
      and cc.company_id = v_company_id
      and cc.deleted_at is null
  ) then
    raise exception 'Cost center not found.' using errcode = '42501';
  end if;

  if v_contract_id is not null and not exists (
    select 1 from public.contracts c
    where c.id::text = v_contract_id
      and c.property_id::text = v_property_id
      and c.company_id = v_company_id
      and c.deleted_at is null
  ) then
    raise exception 'Contract does not belong to the selected property.' using errcode = '42501';
  end if;

  v_amount_changed := v_amount is distinct from v_expense.amount;
  v_date_changed := v_expense_date is distinct from v_expense.expense_date;

  update public.expenses e
  set property_id = (select p.id from public.properties p where p.id::text = v_property_id and p.company_id = v_company_id),
      cost_center_id = case when v_cost_center_id is null then null else
        (select cc.id from public.cost_centers cc where cc.id::text = v_cost_center_id and cc.company_id = v_company_id) end,
      contract_id = case when v_contract_id is null then null else
        (select c.id from public.contracts c where c.id::text = v_contract_id and c.company_id = v_company_id) end,
      expense_date = v_expense_date,
      date_time = v_expense_date::text,
      amount = v_amount,
      category = v_category,
      description = v_description,
      charged_to = v_charged_to,
      attachment_url = v_attachment_url,
      updated_at = now()
  where e.id::text = v_expense_id
    and e.company_id = v_company_id
    and e.deleted_at is null;
  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception 'Expense update failed due to company scope or deleted record.' using errcode = '42501';
  end if;

  if v_amount_changed or v_date_changed then
    v_expense_account_id := public.ensure_company_account(v_company_id, '6100', 'Operating Expenses');
    v_cash_account_id := public.ensure_company_account(v_company_id, '1111', 'Cash');
    v_reversal_no := 'EXP-REV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_expense_id, '-', ''), 1, 6);
    v_new_entry_no := 'EXP-UPD-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_expense_id, '-', ''), 1, 6);

    insert into public.journal_entries
      (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at, company_id)
    values
      (gen_random_uuid()::text, v_reversal_no || '-D', v_expense.expense_date::text, v_expense_account_id, v_expense.amount, 'CREDIT', v_expense_id, 'expense_reversal', v_expense_id, now(), v_company_id),
      (gen_random_uuid()::text, v_reversal_no || '-C', v_expense.expense_date::text, v_cash_account_id, v_expense.amount, 'DEBIT', v_expense_id, 'expense_reversal', v_expense_id, now(), v_company_id),
      (gen_random_uuid()::text, v_new_entry_no || '-D', v_expense_date::text, v_expense_account_id, v_amount, 'DEBIT', v_expense_id, 'expense_update', v_expense_id, now(), v_company_id),
      (gen_random_uuid()::text, v_new_entry_no || '-C', v_expense_date::text, v_cash_account_id, v_amount, 'CREDIT', v_expense_id, 'expense_update', v_expense_id, now(), v_company_id);
  end if;

  insert into public.audit_log
    (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values (
    gen_random_uuid()::text, extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'UPDATE', 'expenses', v_expense_id,
    case when v_amount_changed or v_date_changed
      then 'Expense updated with balanced journal adjustment'
      else 'Expense metadata updated without journal amount change' end,
    'expenses', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'expense_id', v_expense_id,
    'amount_changed', v_amount_changed,
    'date_changed', v_date_changed,
    'old_amount', v_expense.amount,
    'new_amount', v_amount,
    'request_id', v_request_id
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('update_expense_with_journal_atomic:' || v_company_id::text, v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$$;

revoke all on function public.update_expense_with_journal_atomic(jsonb) from public, anon;
grant execute on function public.update_expense_with_journal_atomic(jsonb) to authenticated, service_role;

commit;
