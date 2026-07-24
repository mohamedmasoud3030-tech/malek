-- Phase 3A-1A: canonical per-company account resolution for expenses/deposits only.
begin;
create or replace function public.require_company_account_id(p_company_id uuid, p_account_no text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer; v_id text;
begin
 if p_company_id is null or nullif(btrim(p_account_no),'') is null then raise exception 'company_id and account number are required' using errcode='22023'; end if;
 select count(*), min(id) into v_count,v_id from public.accounts where company_id=p_company_id and no=btrim(p_account_no);
 if v_count=0 then raise exception 'Account % is not configured for company %',p_account_no,p_company_id using errcode='P0001'; end if;
 if v_count<>1 then raise exception 'Account % is ambiguous for company %',p_account_no,p_company_id using errcode='23505'; end if;
 return v_id;
end $$;
create or replace function public.ensure_company_account(p_company_id uuid,p_account_no text,p_account_name text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id text; v_count integer;
begin
 if p_company_id is null or nullif(btrim(p_account_no),'') is null or nullif(btrim(p_account_name),'') is null then raise exception 'company_id, account number and account name are required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('coa:'||p_company_id::text||':'||btrim(p_account_no),0));
 select count(*),min(id) into v_count,v_id from public.accounts where company_id=p_company_id and no=btrim(p_account_no);
 if v_count>1 then raise exception 'Account % is ambiguous for company %',p_account_no,p_company_id using errcode='23505'; end if;
 if v_count=1 then return v_id; end if;
 -- Phase 3A-1A deliberately leaves the legacy global UNIQUE(no) in place.
 -- Fail before attempting an insert so a caller never receives an opaque
 -- accounts_no_key error or another company's account id.
 if exists (select 1 from public.accounts where no = btrim(p_account_no) and company_id <> p_company_id) then
   raise exception 'ACCOUNT_NUMBER_GLOBAL_UNIQUENESS_BLOCKED: account % is owned by another company until Phase 3A-2', p_account_no using errcode='23505';
 end if;
 v_id := 'coa:'||p_company_id::text||':'||btrim(p_account_no);
 insert into public.accounts(id,no,name,company_id) values(v_id,btrim(p_account_no),p_account_name,p_company_id)
 on conflict (id) do nothing;
 select count(*),min(id) into v_count,v_id from public.accounts where company_id=p_company_id and no=btrim(p_account_no);
 if v_count<>1 then raise exception 'Cannot safely ensure account % for company %',p_account_no,p_company_id using errcode='23505'; end if;
 return v_id;
end $$;
revoke all on function public.require_company_account_id(uuid,text) from public,anon,authenticated;
revoke all on function public.ensure_company_account(uuid,text,text) from public,anon,authenticated;
-- These helpers are implementation details for SECURITY DEFINER financial RPCs;
-- direct authenticated callers must not choose an arbitrary company id.
grant execute on function public.require_company_account_id(uuid,text) to service_role;
grant execute on function public.ensure_company_account(uuid,text,text) to service_role;
CREATE OR REPLACE FUNCTION public.create_expense_with_journal_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
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

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

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
    where p.id::text = v_property_id::text and p.company_id = v_company_id and p.deleted_at is null
  ) then
    raise exception 'Property not found.';
  end if;

  if v_cost_center_id is not null and not exists (
    select 1 from public.cost_centers cc where cc.id::text = v_cost_center_id::text and cc.company_id = v_company_id
  ) then
    raise exception 'Cost center not found.';
  end if;

  if v_contract_id is not null and not exists (
    select 1 from public.contracts c
    where c.id::text = v_contract_id::text
      and c.property_id::text = v_property_id::text
      and c.company_id = v_company_id
      and c.deleted_at is null
  ) then
    raise exception 'Contract does not belong to the selected property.';
  end if;

  v_expense_account_id := public.ensure_company_account(v_company_id, '6100', 'Operating Expenses');
  v_cash_account_id := public.ensure_company_account(v_company_id, '1111', 'Cash');
  if v_expense_account_id is null or v_cash_account_id is null then
    raise exception 'Expense accounting accounts are not configured';
  end if;

  v_expense_id := gen_random_uuid()::text;
  v_expense_no := 'EXP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_request_id, '-', ''), 1, 6);

  insert into public.expenses (
    id, property_id, category, amount, expense_date, description,
    cost_center_id, contract_id, charged_to, attachment_url, status, date_time, no
  , company_id) values (
    v_expense_id, v_property_id, v_category, v_amount, v_expense_date, v_description,
    v_cost_center_id, v_contract_id, v_charged_to, v_attachment_url, 'POSTED', v_expense_date::text, v_expense_no
  , v_company_id);

  insert into public.journal_entries
    (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at, company_id)
  values
    (gen_random_uuid()::text, v_expense_no || '-D', v_expense_date::text, v_expense_account_id, v_amount, 'DEBIT', v_expense_id, 'expense', v_expense_id, now(), v_company_id),
    (gen_random_uuid()::text, v_expense_no || '-C', v_expense_date::text, v_cash_account_id, v_amount, 'CREDIT', v_expense_id, 'expense', v_expense_id, now(), v_company_id);

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
  values ('create_expense_with_journal_atomic'||':'||v_company_id::text, v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_expense_with_journal_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
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
  v_row_count integer;
  v_result jsonb;
  v_cached jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to update expenses.' using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
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
  where id::text = v_expense_id::text and company_id = v_company_id and deleted_at is null
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
    where p.id::text = v_property_id::text and p.company_id = v_company_id and p.deleted_at is null
  ) then
    raise exception 'Property not found.';
  end if;

  if v_cost_center_id is not null and not exists (
    select 1 from public.cost_centers cc where cc.id::text = v_cost_center_id::text and cc.company_id = v_company_id
  ) then
    raise exception 'Cost center not found.';
  end if;

  if v_contract_id is not null and not exists (
    select 1 from public.contracts c
    where c.id::text = v_contract_id::text
      and c.property_id::text = v_property_id::text
      and c.company_id = v_company_id
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
  where id::text = v_expense_id::text
    AND company_id = v_company_id
    AND deleted_at is null;
  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then raise exception 'Expense update failed due to company scope or deleted record.' using errcode='42501'; end if;

  if v_amount_changed or v_date_changed then
    v_expense_account_id := public.ensure_company_account(v_company_id, '6100', 'Operating Expenses');
    v_cash_account_id := public.ensure_company_account(v_company_id, '1111', 'Cash');
    if v_expense_account_id is null or v_cash_account_id is null then
      raise exception 'Expense accounting accounts are not configured';
    end if;

    v_reversal_no := 'EXP-REV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_expense_id::text, '-', ''), 1, 6);
    v_new_entry_no := 'EXP-UPD-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_expense_id::text, '-', ''), 1, 6);

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
  values ('update_expense_with_journal_atomic'||':'||v_company_id::text, v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_deposit_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id','');
  v_contract_id_raw text := nullif(p_payload->>'contract_id','');
  v_contract_id_type text;
  v_property_id_type text;
  v_unit_id_type text;
  v_tenant_id text := nullif(p_payload->>'tenant_id','');
  v_property_id_raw text := nullif(p_payload->>'property_id','');
  v_unit_id_raw text := nullif(p_payload->>'unit_id','');
  v_amount numeric := nullif(p_payload->>'amount','')::numeric;
  v_received_date date := nullif(p_payload->>'received_date','')::date;
  v_notes text := nullif(p_payload->>'notes','');
  v_deposit_id text;
  v_cached jsonb;
  v_cash_account_id text;
  v_deposit_account_id text;
  v_contract record;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role required' using errcode='42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  if v_request_id is null then v_request_id := gen_random_uuid()::text; end if;

  select response_payload into v_cached from public.financial_operation_idempotency where operation_name='create_deposit_atomic'||':'||v_company_id::text and request_id=v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  if v_contract_id_raw is null then raise exception 'contract_id required'; end if;
  if v_amount is null or v_amount <=0 then raise exception 'amount must be >0'; end if;
  if v_received_date is null then v_received_date := current_date; end if;

  SELECT format_type(a.atttypid, a.atttypmod) INTO v_contract_id_type
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='contracts' AND a.attname='id' AND a.attnum>0 AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod) INTO v_property_id_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public' AND c.relname='properties' AND a.attname='id' AND a.attnum>0 AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod) INTO v_unit_id_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public' AND c.relname='units' AND a.attname='id' AND a.attnum>0 AND NOT a.attisdropped;

  IF v_contract_id_type IS NULL OR v_property_id_type IS NULL OR v_unit_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot resolve canonical contract/property/unit identifier types';
  END IF;

  perform pg_advisory_xact_lock(hashtextextended('create_deposit:'||v_request_id,0));

  select c.* into v_contract
  from public.contracts c
  where c.id::text = v_contract_id_raw
    and c.company_id = v_company_id
    and c.deleted_at is null
  for share;
  if not found then raise exception 'Contract not found in current company.' using errcode='42501'; end if;
  if (v_tenant_id is not null and v_tenant_id <> v_contract.tenant_id::text)
     or (v_property_id_raw is not null and v_property_id_raw <> v_contract.property_id::text)
     or (v_unit_id_raw is not null and v_unit_id_raw <> v_contract.unit_id::text) then
    raise exception 'Deposit payload does not match canonical contract parties.' using errcode='22023';
  end if;
  v_tenant_id := v_contract.tenant_id::text;
  v_property_id_raw := v_contract.property_id::text;
  v_unit_id_raw := v_contract.unit_id::text;

  v_deposit_id := gen_random_uuid()::text;

  EXECUTE format(
    'insert into public.tenant_deposits
      (id, contract_id, tenant_id, property_id, unit_id, deposit_amount, remaining_amount, status, received_date, notes, request_id, company_id)
     values ($1, $2::%s, $3, $4::%s, $5::%s, $6, $6, ''held'', $7, $8, $9, $10)',
    v_contract_id_type,
    v_property_id_type,
    v_unit_id_type
  )
  USING v_deposit_id, v_contract_id_raw, v_tenant_id, v_property_id_raw, v_unit_id_raw,
        v_amount, v_received_date, v_notes, v_request_id, v_company_id;

  insert into public.deposit_transactions (deposit_id, type, amount, reason, description, request_id, company_id)
  values (v_deposit_id, 'held', v_amount, 'initial_deposit', 'استلام وديعة تأمين', v_request_id || '-held', v_company_id);

  v_cash_account_id := public.ensure_company_account(v_company_id, '1111', 'Cash');
  v_deposit_account_id := public.ensure_company_account(v_company_id, '2200', 'Tenant Deposits Payable');

  if v_cash_account_id is not null and v_deposit_account_id is not null then
    insert into public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, company_id)
    values
      (gen_random_uuid()::text, 'DEP-'||substr(v_deposit_id,1,6)||'-D', v_received_date, v_cash_account_id, v_amount, 'DEBIT', v_deposit_id, 'deposit', v_deposit_id, v_company_id),
      (gen_random_uuid()::text, 'DEP-'||substr(v_deposit_id,1,6)||'-C', v_received_date, v_deposit_account_id, v_amount, 'CREDIT', v_deposit_id, 'deposit', v_deposit_id, v_company_id);
  end if;

  v_result := jsonb_build_object('success',true,'deposit_id',v_deposit_id,'request_id',v_request_id,'amount',v_amount);

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('create_deposit_atomic'||':'||v_company_id::text, v_request_id, v_result) on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.deduct_deposit_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id','');
  v_deposit_id text := nullif(p_payload->>'deposit_id','');
  v_amount numeric := nullif(p_payload->>'amount','')::numeric;
  v_reason text := nullif(p_payload->>'reason','');
  v_description text := nullif(p_payload->>'description','');
  v_charged_date date := nullif(p_payload->>'charged_date','')::date;
  v_property_id_raw text := nullif(p_payload->>'property_id','');
  v_deposit record;
  v_cached jsonb;
  v_result jsonb;
  v_expense_account_id text;
  v_deposit_account_id text;
  v_expense_id uuid;
  v_expense_property_id_type text;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role required' using errcode='42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  if v_request_id is null then v_request_id := gen_random_uuid()::text; end if;
  select response_payload into v_cached from public.financial_operation_idempotency where operation_name='deduct_deposit_atomic'||':'||v_company_id::text and request_id=v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  if v_deposit_id is null then raise exception 'deposit_id required'; end if;
  if v_amount is null or v_amount <=0 then raise exception 'amount >0 required'; end if;
  if v_reason is null then v_reason := 'other'; end if;
  if v_charged_date is null then v_charged_date := current_date; end if;

  perform pg_advisory_xact_lock(hashtextextended('deduct_deposit:'||v_deposit_id,0));

  select * into v_deposit from public.tenant_deposits where id=v_deposit_id and deleted_at is null   AND company_id = v_company_id
for update;
  if not found then raise exception 'Deposit not found'; end if;

  if v_amount > v_deposit.remaining_amount then
    raise exception 'Insufficient deposit balance: remaining % requested %', v_deposit.remaining_amount, v_amount;
  end if;

  update public.tenant_deposits
  set deducted_amount = deducted_amount + v_amount,
      remaining_amount = deposit_amount - (deducted_amount + v_amount) - refunded_amount,
      status = case 
        when (deposit_amount - (deducted_amount + v_amount) - refunded_amount) <=0 then 'forfeited_damage'
        when (deducted_amount + v_amount) >0 and refunded_amount =0 then 'partially_deducted'
        when refunded_amount >0 then 'partially_refunded'
        else 'held'
      end,
      updated_at = now()
  where id=v_deposit_id;

  insert into public.deposit_transactions (deposit_id, type, amount, reason, description, request_id, company_id)
  values (v_deposit_id, 'deduction', v_amount, v_reason, v_description, v_request_id, v_company_id);

  v_expense_account_id := public.ensure_company_account(v_company_id, '6100', 'Operating Expenses');
  v_deposit_account_id := public.ensure_company_account(v_company_id, '2200', 'Tenant Deposits Payable');

  if v_deposit_account_id is not null and v_expense_account_id is not null then
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_expense_property_id_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='expenses' AND a.attname='property_id' AND a.attnum>0 AND NOT a.attisdropped;

    IF v_expense_property_id_type IS NULL THEN
      RAISE EXCEPTION 'expenses.property_id type not found';
    END IF;

    v_expense_id := gen_random_uuid();
    EXECUTE format(
      'insert into public.expenses
        (id, property_id, category, amount, expense_date, description, status, no, company_id)
       values ($1, $2::%s, $3, $4, $5, $6, $7, $8, $9)',
      v_expense_property_id_type
    )
    USING v_expense_id,
          coalesce(v_property_id_raw, v_deposit.property_id::text),
          'صيانة من تأمين',
          v_amount,
          v_charged_date,
          'خصم تأمين: '||coalesce(v_description,''),
          'POSTED',
          'EXP-DEP-'||substr(v_deposit_id,1,6),
          v_company_id;

    insert into public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, company_id)
    values
      (gen_random_uuid()::text, 'DEP-DED-'||substr(v_deposit_id,1,6)||'-D', v_charged_date, v_deposit_account_id, v_amount, 'DEBIT', v_deposit_id, 'deposit_deduction', v_deposit_id, v_company_id),
      (gen_random_uuid()::text, 'DEP-DED-'||substr(v_deposit_id,1,6)||'-C', v_charged_date, v_expense_account_id, v_amount, 'CREDIT', v_deposit_id, 'deposit_deduction', v_deposit_id, v_company_id);
  end if;

  v_result := jsonb_build_object('success',true,'deposit_id',v_deposit_id,'deducted',v_amount,'remaining', v_deposit.remaining_amount - v_amount,'request_id',v_request_id, 'new_status', (case when (v_deposit.deposit_amount - (v_deposit.deducted_amount + v_amount) - v_deposit.refunded_amount) <=0 then 'forfeited_damage' else 'partially_deducted' end));

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('deduct_deposit_atomic'||':'||v_company_id::text, v_request_id, v_result) on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refund_deposit_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id','');
  v_deposit_id text := nullif(p_payload->>'deposit_id','');
  v_amount numeric := nullif(p_payload->>'amount','')::numeric;
  v_payment_method text := nullif(p_payload->>'payment_method','');
  v_refund_date date := nullif(p_payload->>'refund_date','')::date;
  v_notes text := nullif(p_payload->>'notes','');
  v_deposit record;
  v_cached jsonb;
  v_result jsonb;
  v_cash_account_id text;
  v_deposit_account_id text;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role required' using errcode='42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  if v_request_id is null then v_request_id := gen_random_uuid()::text; end if;
  select response_payload into v_cached from public.financial_operation_idempotency where operation_name='refund_deposit_atomic'||':'||v_company_id::text and request_id=v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  if v_deposit_id is null then raise exception 'deposit_id required'; end if;
  if v_amount is null or v_amount <=0 then raise exception 'amount >0 required'; end if;
  if v_refund_date is null then v_refund_date := current_date; end if;
  if v_payment_method is null then v_payment_method := 'bank_transfer'; end if;

  perform pg_advisory_xact_lock(hashtextextended('refund_deposit:'||v_deposit_id,0));

  select * into v_deposit from public.tenant_deposits where id=v_deposit_id and deleted_at is null   AND company_id = v_company_id
for update;
  if not found then raise exception 'Deposit not found'; end if;

  if v_amount > v_deposit.remaining_amount then
    raise exception 'Insufficient remaining balance for refund';
  end if;

  update public.tenant_deposits
  set refunded_amount = refunded_amount + v_amount,
      remaining_amount = deposit_amount - deducted_amount - (refunded_amount + v_amount),
      status = case when (deposit_amount - deducted_amount - (refunded_amount + v_amount)) <=0 then 'refunded' else 'partially_refunded' end,
      settled_date = case when (deposit_amount - deducted_amount - (refunded_amount + v_amount)) <=0 then v_refund_date else settled_date end,
      updated_at = now()
  where id=v_deposit_id;

  insert into public.deposit_transactions (deposit_id, type, amount, reason, description, payment_method, request_id, company_id)
  values (v_deposit_id, 'refund', v_amount, 'refund_partial', v_notes, v_payment_method, v_request_id, v_company_id);

  v_cash_account_id := public.ensure_company_account(v_company_id, '1111', 'Cash');
  v_deposit_account_id := public.ensure_company_account(v_company_id, '2200', 'Tenant Deposits Payable');

  if v_cash_account_id is not null and v_deposit_account_id is not null then
    insert into public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, company_id)
    values
      (gen_random_uuid()::text, 'DEP-REF-'||substr(v_deposit_id,1,6)||'-D', v_refund_date, v_deposit_account_id, v_amount, 'DEBIT', v_deposit_id, 'deposit_refund', v_deposit_id, v_company_id),
      (gen_random_uuid()::text, 'DEP-REF-'||substr(v_deposit_id,1,6)||'-C', v_refund_date, v_cash_account_id, v_amount, 'CREDIT', v_deposit_id, 'deposit_refund', v_deposit_id, v_company_id);
  end if;

  v_result := jsonb_build_object('success',true,'deposit_id',v_deposit_id,'refunded',v_amount,'remaining', v_deposit.remaining_amount - v_amount,'request_id',v_request_id);

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('refund_deposit_atomic'||':'||v_company_id::text, v_request_id, v_result) on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$
;

commit;
