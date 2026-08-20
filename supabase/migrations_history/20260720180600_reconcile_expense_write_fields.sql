begin;

create or replace function public.create_expense_with_journal_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_property_id public.expenses.property_id%type := nullif(p_payload->>'property_id', '');
  v_category text := nullif(p_payload->>'category', '');
  v_amount numeric := nullif(p_payload->>'amount', '')::numeric;
  v_expense_date public.expenses.expense_date%type := nullif(p_payload->>'expense_date', '')::date;
  v_description text := nullif(p_payload->>'description', '');
  v_cost_center_id public.expenses.cost_center_id%type := nullif(p_payload->>'cost_center_id', '');
  v_contract_id public.expenses.contract_id%type := nullif(p_payload->>'contract_id', '');
  v_charged_to text := nullif(p_payload->>'charged_to', '');
  v_attachment_url text := nullif(p_payload->>'attachment_url', '');
  v_expense_id public.expenses.id%type;
  v_expense_no text;
  v_expense_account_id public.accounts.id%type;
  v_cash_account_id public.accounts.id%type;
  v_result jsonb;
  v_cached jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to create expenses.' using errcode = '42501';
  end if;

  if v_request_id is null then
    v_request_id := gen_random_uuid()::text;
  end if;

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'create_expense_with_journal_atomic'
    and request_id = v_request_id;
  if v_cached is not null then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  if v_property_id is null then raise exception 'property_id is required.'; end if;
  if v_category is null then raise exception 'category is required.'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'amount must be greater than zero.'; end if;
  if v_expense_date is null then raise exception 'expense_date is required.'; end if;

  if not exists (
    select 1 from public.properties p
    where p.id::text = v_property_id::text and p.deleted_at is null
  ) then
    raise exception 'Property not found.';
  end if;

  if v_cost_center_id is not null and not exists (
    select 1 from public.cost_centers cc where cc.id::text = v_cost_center_id::text
  ) then
    raise exception 'Cost center not found.';
  end if;

  if v_contract_id is not null and not exists (
    select 1 from public.contracts c
    where c.id::text = v_contract_id::text
      and c.property_id::text = v_property_id::text
      and c.deleted_at is null
  ) then
    raise exception 'Contract does not belong to the selected property.';
  end if;

  select id into v_expense_account_id from public.accounts where no = '6100' limit 1;
  select id into v_cash_account_id from public.accounts where no = '1111' limit 1;
  if v_expense_account_id is null or v_cash_account_id is null then
    raise exception 'Expense accounting accounts are not configured';
  end if;

  v_expense_id := gen_random_uuid()::text;
  v_expense_no := 'EXP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_request_id, '-', ''), 1, 6);

  insert into public.expenses (
    id, property_id, category, amount, expense_date, description,
    cost_center_id, contract_id, charged_to, attachment_url, status, date_time, no
  ) values (
    v_expense_id, v_property_id, v_category, v_amount, v_expense_date, v_description,
    v_cost_center_id, v_contract_id, v_charged_to, v_attachment_url, 'POSTED', v_expense_date::text, v_expense_no
  );

  insert into public.journal_entries
    (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at)
  values
    (gen_random_uuid()::text, v_expense_no || '-D', v_expense_date::text, v_expense_account_id, v_amount, 'DEBIT', v_expense_id, 'expense', v_expense_id, now()),
    (gen_random_uuid()::text, v_expense_no || '-C', v_expense_date::text, v_cash_account_id, v_amount, 'CREDIT', v_expense_id, 'expense', v_expense_id, now());

  insert into public.audit_log
    (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values (
    gen_random_uuid()::text, extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'CREATE', 'expenses', v_expense_id, 'Expense recorded with journal entry',
    'expenses', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'expense_id', v_expense_id,
    'expense_no', v_expense_no,
    'request_id', v_request_id
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('create_expense_with_journal_atomic', v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$;

create or replace function public.update_expense_with_journal_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_expense_id public.expenses.id%type := nullif(p_payload->>'expense_id', '');
  v_expense public.expenses%rowtype;
  v_property_id public.expenses.property_id%type;
  v_cost_center_id public.expenses.cost_center_id%type;
  v_contract_id public.expenses.contract_id%type;
  v_expense_date public.expenses.expense_date%type;
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
  v_result jsonb;
  v_cached jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to update expenses.' using errcode = '42501';
  end if;
  if v_expense_id is null then raise exception 'expense_id is required.'; end if;

  if v_request_id is null then
    v_request_id := gen_random_uuid()::text;
  end if;

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'update_expense_with_journal_atomic'
    and request_id = v_request_id;
  if v_cached is not null then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('update_expense:' || v_expense_id::text, 0));

  select * into v_expense
  from public.expenses
  where id::text = v_expense_id::text and deleted_at is null
  for update;
  if not found then raise exception 'Expense not found or has been deleted.'; end if;

  v_property_id := case when p_payload ? 'property_id'
    then nullif(p_payload->>'property_id', '') else v_expense.property_id end;
  v_cost_center_id := case when p_payload ? 'cost_center_id'
    then nullif(p_payload->>'cost_center_id', '') else v_expense.cost_center_id end;
  v_contract_id := case when p_payload ? 'contract_id'
    then nullif(p_payload->>'contract_id', '') else v_expense.contract_id end;
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
    where p.id::text = v_property_id::text and p.deleted_at is null
  ) then
    raise exception 'Property not found.';
  end if;

  if v_cost_center_id is not null and not exists (
    select 1 from public.cost_centers cc where cc.id::text = v_cost_center_id::text
  ) then
    raise exception 'Cost center not found.';
  end if;

  if v_contract_id is not null and not exists (
    select 1 from public.contracts c
    where c.id::text = v_contract_id::text
      and c.property_id::text = v_property_id::text
      and c.deleted_at is null
  ) then
    raise exception 'Contract does not belong to the selected property.';
  end if;

  v_amount_changed := v_amount is distinct from v_expense.amount;
  v_date_changed := v_expense_date is distinct from v_expense.expense_date;

  update public.expenses
  set property_id = v_property_id,
      cost_center_id = v_cost_center_id,
      contract_id = v_contract_id,
      expense_date = v_expense_date,
      date_time = v_expense_date::text,
      amount = v_amount,
      category = v_category,
      description = v_description,
      charged_to = v_charged_to,
      attachment_url = v_attachment_url,
      updated_at = now()
  where id::text = v_expense_id::text;

  if v_amount_changed or v_date_changed then
    select id into v_expense_account_id from public.accounts where no = '6100' limit 1;
    select id into v_cash_account_id from public.accounts where no = '1111' limit 1;
    if v_expense_account_id is null or v_cash_account_id is null then
      raise exception 'Expense accounting accounts are not configured';
    end if;

    v_reversal_no := 'EXP-REV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_expense_id::text, '-', ''), 1, 6);
    v_new_entry_no := 'EXP-UPD-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_expense_id::text, '-', ''), 1, 6);

    insert into public.journal_entries
      (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at)
    values
      (gen_random_uuid()::text, v_reversal_no || '-D', v_expense.expense_date::text, v_expense_account_id, v_expense.amount, 'CREDIT', v_expense_id, 'expense_reversal', v_expense_id, now()),
      (gen_random_uuid()::text, v_reversal_no || '-C', v_expense.expense_date::text, v_cash_account_id, v_expense.amount, 'DEBIT', v_expense_id, 'expense_reversal', v_expense_id, now()),
      (gen_random_uuid()::text, v_new_entry_no || '-D', v_expense_date::text, v_expense_account_id, v_amount, 'DEBIT', v_expense_id, 'expense_update', v_expense_id, now()),
      (gen_random_uuid()::text, v_new_entry_no || '-C', v_expense_date::text, v_cash_account_id, v_amount, 'CREDIT', v_expense_id, 'expense_update', v_expense_id, now());
  end if;

  insert into public.audit_log
    (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values (
    gen_random_uuid()::text, extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'UPDATE', 'expenses', v_expense_id::text,
    case
      when v_amount_changed or v_date_changed then 'Expense updated with balanced journal adjustment'
      else 'Expense metadata updated without journal amount change'
    end,
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
  values ('update_expense_with_journal_atomic', v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$;

revoke execute on function public.create_expense_with_journal_atomic(jsonb) from public, anon;
grant execute on function public.create_expense_with_journal_atomic(jsonb) to authenticated, service_role;
revoke execute on function public.update_expense_with_journal_atomic(jsonb) from public, anon;
grant execute on function public.update_expense_with_journal_atomic(jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
