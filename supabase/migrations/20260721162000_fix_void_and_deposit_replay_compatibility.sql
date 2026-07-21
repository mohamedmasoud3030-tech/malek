-- Make receipt VOID and tenant-deposit RPCs compatible with both the verified
-- live schema and a clean historical migration replay.
--
-- Production currently stores receipts.voided_at as epoch milliseconds (bigint)
-- and tenant_deposits.id as text. A clean replay can reconstruct voided_at as a
-- timestamp and tenant_deposits.id/deposit_transactions.deposit_id as uuid. The
-- application payload contract remains string-based in either case.

begin;

-- Preserve the live epoch-millisecond contract without failing when the replay
-- reconstructed a timestamp column. Dynamic SQL keeps each type-specific USING
-- expression parse-safe.
do $block$
declare
  v_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
  into v_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'receipts'
    and a.attname = 'voided_at'
    and a.attnum > 0
    and not a.attisdropped;

  if v_type is null then
    alter table public.receipts add column voided_at bigint;
  elsif v_type in ('timestamp with time zone', 'timestamp without time zone') then
    execute 'alter table public.receipts alter column voided_at type bigint using case when voided_at is null then null else floor(extract(epoch from voided_at) * 1000)::bigint end';
  elsif v_type <> 'bigint' then
    raise exception 'Unsupported receipts.voided_at type: %', v_type;
  end if;
end
$block$;

create or replace function public.create_deposit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_request_id text := nullif(p_payload->>'request_id','');
  v_contract_id_raw text := nullif(p_payload->>'contract_id','');
  v_contract_id_type text;
  v_deposit_id_type text;
  v_transaction_deposit_id_type text;
  v_tenant_id_type text;
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
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role required' using errcode='42501';
  end if;

  if v_request_id is null then v_request_id := gen_random_uuid()::text; end if;

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name='create_deposit_atomic' and request_id=v_request_id;
  if v_cached is not null then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  if v_contract_id_raw is null then raise exception 'contract_id required'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'amount must be >0'; end if;
  if v_received_date is null then v_received_date := current_date; end if;

  select format_type(a.atttypid, a.atttypmod) into v_deposit_id_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='tenant_deposits' and a.attname='id' and a.attnum>0 and not a.attisdropped;

  select format_type(a.atttypid, a.atttypmod) into v_transaction_deposit_id_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='deposit_transactions' and a.attname='deposit_id' and a.attnum>0 and not a.attisdropped;

  select format_type(a.atttypid, a.atttypmod) into v_tenant_id_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='tenant_deposits' and a.attname='tenant_id' and a.attnum>0 and not a.attisdropped;

  select format_type(a.atttypid, a.atttypmod) into v_contract_id_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='contracts' and a.attname='id' and a.attnum>0 and not a.attisdropped;

  select format_type(a.atttypid, a.atttypmod) into v_property_id_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='properties' and a.attname='id' and a.attnum>0 and not a.attisdropped;

  select format_type(a.atttypid, a.atttypmod) into v_unit_id_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='units' and a.attname='id' and a.attnum>0 and not a.attisdropped;

  if v_deposit_id_type is null
     or v_transaction_deposit_id_type is null
     or v_tenant_id_type is null
     or v_contract_id_type is null
     or v_property_id_type is null
     or v_unit_id_type is null then
    raise exception 'Cannot resolve deposit or canonical entity identifier types';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('create_deposit:'||v_request_id,0));
  v_deposit_id := gen_random_uuid()::text;

  execute format(
    'insert into public.tenant_deposits
      (id, contract_id, tenant_id, property_id, unit_id, deposit_amount, remaining_amount, status, received_date, notes, request_id)
     values ($1::%s, $2::%s, $3::%s, $4::%s, $5::%s, $6, $6, ''held'', $7, $8, $9)',
    v_deposit_id_type,
    v_contract_id_type,
    v_tenant_id_type,
    v_property_id_type,
    v_unit_id_type
  )
  using v_deposit_id, v_contract_id_raw, v_tenant_id, v_property_id_raw, v_unit_id_raw,
        v_amount, v_received_date, v_notes, v_request_id;

  execute format(
    'insert into public.deposit_transactions (deposit_id, type, amount, reason, description, request_id)
     values ($1::%s, ''held'', $2, ''initial_deposit'', $3, $4)',
    v_transaction_deposit_id_type
  )
  using v_deposit_id, v_amount, 'استلام وديعة تأمين', v_request_id || '-held';

  v_cash_account_id := (select id from public.accounts where no='1111' limit 1);
  v_deposit_account_id := (select id from public.accounts where no='2200' limit 1);
  if v_deposit_account_id is null then
    insert into public.accounts (id, no, name)
    values ('2200','2200','Tenant Deposits Payable')
    on conflict (id) do nothing;
    v_deposit_account_id := '2200';
  end if;

  if v_cash_account_id is not null and v_deposit_account_id is not null then
    insert into public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id)
    values
      (gen_random_uuid()::text, 'DEP-'||substr(v_deposit_id,1,6)||'-D', v_received_date, v_cash_account_id, v_amount, 'DEBIT', v_deposit_id, 'deposit', v_deposit_id),
      (gen_random_uuid()::text, 'DEP-'||substr(v_deposit_id,1,6)||'-C', v_received_date, v_deposit_account_id, v_amount, 'CREDIT', v_deposit_id, 'deposit', v_deposit_id);
  end if;

  v_result := jsonb_build_object('success',true,'deposit_id',v_deposit_id,'request_id',v_request_id,'amount',v_amount);

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('create_deposit_atomic', v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$;

create or replace function public.deduct_deposit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_request_id text := nullif(p_payload->>'request_id','');
  v_deposit_id text := nullif(p_payload->>'deposit_id','');
  v_amount numeric := nullif(p_payload->>'amount','')::numeric;
  v_reason text := nullif(p_payload->>'reason','');
  v_description text := nullif(p_payload->>'description','');
  v_charged_date date := nullif(p_payload->>'charged_date','')::date;
  v_property_id_raw text := nullif(p_payload->>'property_id','');
  v_transaction_deposit_id_type text;
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

  if v_request_id is null then v_request_id := gen_random_uuid()::text; end if;
  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name='deduct_deposit_atomic' and request_id=v_request_id;
  if v_cached is not null then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  if v_deposit_id is null then raise exception 'deposit_id required'; end if;
  if v_amount is null or v_amount <=0 then raise exception 'amount >0 required'; end if;
  if v_reason is null then v_reason := 'other'; end if;
  if v_charged_date is null then v_charged_date := current_date; end if;

  select format_type(a.atttypid, a.atttypmod) into v_transaction_deposit_id_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='deposit_transactions' and a.attname='deposit_id' and a.attnum>0 and not a.attisdropped;
  if v_transaction_deposit_id_type is null then
    raise exception 'deposit_transactions.deposit_id type not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('deduct_deposit:'||v_deposit_id,0));

  select * into v_deposit
  from public.tenant_deposits
  where id::text = v_deposit_id and deleted_at is null
  for update;
  if not found then raise exception 'Deposit not found'; end if;

  if v_amount > v_deposit.remaining_amount then
    raise exception 'Insufficient deposit balance: remaining % requested %', v_deposit.remaining_amount, v_amount;
  end if;

  update public.tenant_deposits
  set deducted_amount = deducted_amount + v_amount,
      remaining_amount = deposit_amount - (deducted_amount + v_amount) - refunded_amount,
      status = case when (deposit_amount - (deducted_amount + v_amount) - refunded_amount) <=0 then 'forfeited_damage' else 'partially_refunded' end,
      updated_at = now()
  where id::text = v_deposit_id;

  execute format(
    'insert into public.deposit_transactions (deposit_id, type, amount, reason, description, request_id)
     values ($1::%s, ''deduction'', $2, $3, $4, $5)',
    v_transaction_deposit_id_type
  )
  using v_deposit_id, v_amount, v_reason, v_description, v_request_id;

  v_expense_account_id := (select id from public.accounts where no='6100' limit 1);
  v_deposit_account_id := (select id from public.accounts where no='2200' limit 1);
  if v_expense_account_id is null then
    insert into public.accounts (id, no, name)
    values ('6100','6100','Operating Expenses')
    on conflict (id) do nothing;
    v_expense_account_id := '6100';
  end if;

  if v_deposit_account_id is not null and v_expense_account_id is not null then
    select format_type(a.atttypid, a.atttypmod) into v_expense_property_id_type
    from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='expenses' and a.attname='property_id' and a.attnum>0 and not a.attisdropped;

    if v_expense_property_id_type is null then
      raise exception 'expenses.property_id type not found';
    end if;

    v_expense_id := gen_random_uuid();
    execute format(
      'insert into public.expenses
        (id, property_id, category, amount, expense_date, description, status, no)
       values ($1, $2::%s, $3, $4, $5, $6, $7, $8)',
      v_expense_property_id_type
    )
    using v_expense_id,
          coalesce(v_property_id_raw, v_deposit.property_id::text),
          'صيانة من تأمين',
          v_amount,
          v_charged_date,
          'خصم تأمين: '||coalesce(v_description,''),
          'POSTED',
          'EXP-DEP-'||substr(v_deposit_id,1,6);

    insert into public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id)
    values
      (gen_random_uuid()::text, 'DEP-DED-'||substr(v_deposit_id,1,6)||'-D', v_charged_date, v_deposit_account_id, v_amount, 'DEBIT', v_deposit_id, 'deposit_deduction', v_deposit_id),
      (gen_random_uuid()::text, 'DEP-DED-'||substr(v_deposit_id,1,6)||'-C', v_charged_date, v_expense_account_id, v_amount, 'CREDIT', v_deposit_id, 'deposit_deduction', v_deposit_id);
  end if;

  v_result := jsonb_build_object('success',true,'deposit_id',v_deposit_id,'deducted',v_amount,'remaining',v_deposit.remaining_amount-v_amount,'request_id',v_request_id);

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('deduct_deposit_atomic', v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$;

create or replace function public.refund_deposit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_request_id text := nullif(p_payload->>'request_id','');
  v_deposit_id text := nullif(p_payload->>'deposit_id','');
  v_amount numeric := nullif(p_payload->>'amount','')::numeric;
  v_payment_method text := nullif(p_payload->>'payment_method','');
  v_refund_date date := nullif(p_payload->>'refund_date','')::date;
  v_notes text := nullif(p_payload->>'notes','');
  v_transaction_deposit_id_type text;
  v_deposit record;
  v_cached jsonb;
  v_result jsonb;
  v_cash_account_id text;
  v_deposit_account_id text;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role required' using errcode='42501';
  end if;

  if v_request_id is null then v_request_id := gen_random_uuid()::text; end if;
  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name='refund_deposit_atomic' and request_id=v_request_id;
  if v_cached is not null then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  if v_deposit_id is null then raise exception 'deposit_id required'; end if;
  if v_amount is null or v_amount <=0 then raise exception 'amount >0 required'; end if;
  if v_refund_date is null then v_refund_date := current_date; end if;
  if v_payment_method is null then v_payment_method := 'bank_transfer'; end if;

  select format_type(a.atttypid, a.atttypmod) into v_transaction_deposit_id_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='deposit_transactions' and a.attname='deposit_id' and a.attnum>0 and not a.attisdropped;
  if v_transaction_deposit_id_type is null then
    raise exception 'deposit_transactions.deposit_id type not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('refund_deposit:'||v_deposit_id,0));

  select * into v_deposit
  from public.tenant_deposits
  where id::text = v_deposit_id and deleted_at is null
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
  where id::text = v_deposit_id;

  execute format(
    'insert into public.deposit_transactions (deposit_id, type, amount, reason, description, payment_method, request_id)
     values ($1::%s, ''refund'', $2, ''refund_partial'', $3, $4, $5)',
    v_transaction_deposit_id_type
  )
  using v_deposit_id, v_amount, v_notes, v_payment_method, v_request_id;

  v_cash_account_id := (select id from public.accounts where no='1111' limit 1);
  v_deposit_account_id := (select id from public.accounts where no='2200' limit 1);

  if v_cash_account_id is not null and v_deposit_account_id is not null then
    insert into public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id)
    values
      (gen_random_uuid()::text, 'DEP-REF-'||substr(v_deposit_id,1,6)||'-D', v_refund_date, v_deposit_account_id, v_amount, 'DEBIT', v_deposit_id, 'deposit_refund', v_deposit_id),
      (gen_random_uuid()::text, 'DEP-REF-'||substr(v_deposit_id,1,6)||'-C', v_refund_date, v_cash_account_id, v_amount, 'CREDIT', v_deposit_id, 'deposit_refund', v_deposit_id);
  end if;

  v_result := jsonb_build_object('success',true,'deposit_id',v_deposit_id,'refunded',v_amount,'remaining',v_deposit.remaining_amount-v_amount,'request_id',v_request_id);

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('refund_deposit_atomic', v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$;

alter function public.create_deposit_atomic(jsonb) owner to postgres;
alter function public.deduct_deposit_atomic(jsonb) owner to postgres;
alter function public.refund_deposit_atomic(jsonb) owner to postgres;

revoke all on function public.create_deposit_atomic(jsonb) from public, anon;
revoke all on function public.deduct_deposit_atomic(jsonb) from public, anon;
revoke all on function public.refund_deposit_atomic(jsonb) from public, anon;

grant execute on function public.create_deposit_atomic(jsonb) to authenticated, service_role;
grant execute on function public.deduct_deposit_atomic(jsonb) to authenticated, service_role;
grant execute on function public.refund_deposit_atomic(jsonb) to authenticated, service_role;

commit;
