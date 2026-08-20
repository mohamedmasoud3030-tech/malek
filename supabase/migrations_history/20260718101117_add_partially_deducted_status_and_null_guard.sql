-- Fix deposits status: don't use partially_refunded for deduction partial
-- Add partially_deducted status, add explicit NULL guard for contracts.id type detection

begin;

-- 1. Add new status to check constraint
-- Drop old constraint and recreate with new value
alter table public.tenant_deposits drop constraint if exists tenant_deposits_status_check;
-- The original constraint was inline check, need to find its name - it was created as check in column definition
-- Postgres auto-generated name may be tenant_deposits_status_check, we try to drop if exists
DO $$
BEGIN
  -- Try to drop any check constraint that includes status check
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tenant_deposits'::regclass AND conname='tenant_deposits_status_check') THEN
    ALTER TABLE public.tenant_deposits DROP CONSTRAINT tenant_deposits_status_check;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not drop tenant_deposits_status_check, may not exist with that name';
END $$;

-- Add new check with partially_deducted included
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='public.tenant_deposits'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%partially_deducted%'
  ) THEN
    ALTER TABLE public.tenant_deposits
    ADD CONSTRAINT tenant_deposits_status_check
    CHECK (status IN ('held','partially_refunded','refunded','forfeited_damage','forfeited_arrears','partially_deducted'));
  END IF;
END $$;

-- 2. Update deduct_deposit_atomic to use partially_deducted instead of partially_refunded for partial deduction
create or replace function public.deduct_deposit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
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

  if v_request_id is null then v_request_id := gen_random_uuid()::text; end if;
  select response_payload into v_cached from public.financial_operation_idempotency where operation_name='deduct_deposit_atomic' and request_id=v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  if v_deposit_id is null then raise exception 'deposit_id required'; end if;
  if v_amount is null or v_amount <=0 then raise exception 'amount >0 required'; end if;
  if v_reason is null then v_reason := 'other'; end if;
  if v_charged_date is null then v_charged_date := current_date; end if;

  perform pg_advisory_xact_lock(hashtextextended('deduct_deposit:'||v_deposit_id,0));

  select * into v_deposit from public.tenant_deposits where id=v_deposit_id and deleted_at is null for update;
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

  insert into public.deposit_transactions (deposit_id, type, amount, reason, description, request_id)
  values (v_deposit_id, 'deduction', v_amount, v_reason, v_description, v_request_id);

  v_expense_account_id := (select id from public.accounts where no='6100' limit 1);
  v_deposit_account_id := (select id from public.accounts where no='2200' limit 1);
  if v_expense_account_id is null then
    insert into public.accounts (id, no, name) values ('6100','6100','Operating Expenses') on conflict (id) do nothing;
    v_expense_account_id := '6100';
  end if;

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
        (id, property_id, category, amount, expense_date, description, status, no)
       values ($1, $2::%s, $3, $4, $5, $6, $7, $8)',
      v_expense_property_id_type
    )
    USING v_expense_id,
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

  v_result := jsonb_build_object('success',true,'deposit_id',v_deposit_id,'deducted',v_amount,'remaining', v_deposit.remaining_amount - v_amount,'request_id',v_request_id, 'new_status', (case when (v_deposit.deposit_amount - (v_deposit.deducted_amount + v_amount) - v_deposit.refunded_amount) <=0 then 'forfeited_damage' else 'partially_deducted' end));

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('deduct_deposit_atomic', v_request_id, v_result) on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$$;

revoke all on function public.deduct_deposit_atomic(jsonb) from public, anon;
grant execute on function public.deduct_deposit_atomic(jsonb) to authenticated, service_role;

-- 3. Update create_deposit_atomic to have explicit NULL guard after detecting contracts.id type
create or replace function public.create_deposit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
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
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role required' using errcode='42501';
  end if;

  if v_request_id is null then v_request_id := gen_random_uuid()::text; end if;

  select response_payload into v_cached from public.financial_operation_idempotency where operation_name='create_deposit_atomic' and request_id=v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  if v_contract_id_raw is null then raise exception 'contract_id required'; end if;
  if v_amount is null or v_amount <=0 then raise exception 'amount must be >0'; end if;
  if v_received_date is null then v_received_date := current_date; end if;

  -- Detect contracts.id type with explicit NULL guard
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

  v_deposit_id := gen_random_uuid()::text;

  EXECUTE format(
    'insert into public.tenant_deposits
      (id, contract_id, tenant_id, property_id, unit_id, deposit_amount, remaining_amount, status, received_date, notes, request_id)
     values ($1, $2::%s, $3, $4::%s, $5::%s, $6, $6, ''held'', $7, $8, $9)',
    v_contract_id_type,
    v_property_id_type,
    v_unit_id_type
  )
  USING v_deposit_id, v_contract_id_raw, v_tenant_id, v_property_id_raw, v_unit_id_raw,
        v_amount, v_received_date, v_notes, v_request_id;

  insert into public.deposit_transactions (deposit_id, type, amount, reason, description, request_id)
  values (v_deposit_id, 'held', v_amount, 'initial_deposit', 'استلام وديعة تأمين', v_request_id || '-held');

  v_cash_account_id := (select id from public.accounts where no='1111' limit 1);
  v_deposit_account_id := (select id from public.accounts where no='2200' limit 1);
  if v_deposit_account_id is null then
    insert into public.accounts (id, no, name) values ('2200','2200','Tenant Deposits Payable') on conflict (id) do nothing;
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
  values ('create_deposit_atomic', v_request_id, v_result) on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$$;

revoke all on function public.create_deposit_atomic(jsonb) from public, anon;
grant execute on function public.create_deposit_atomic(jsonb) to authenticated, service_role;

commit;
