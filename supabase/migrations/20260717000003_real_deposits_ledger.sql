-- Phase: Real Deposits Ledger
-- Implements proper tenant deposits with immutable transactions, idempotency, and balance guards
-- Does NOT drop existing deposit_txs (legacy), creates new tables tenant_deposits and deposit_transactions

begin;

-- 1. Create tenant_deposits table
create table if not exists public.tenant_deposits (
  id text primary key default gen_random_uuid()::text,
  contract_id text not null references public.contracts(id) on delete restrict,
  tenant_id text,
  property_id uuid references public.properties(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  deposit_amount numeric(14,2) not null check (deposit_amount >= 0),
  deducted_amount numeric(14,2) not null default 0 check (deducted_amount >= 0),
  refunded_amount numeric(14,2) not null default 0 check (refunded_amount >= 0),
  remaining_amount numeric(14,2) not null default 0 check (remaining_amount >= 0),
  status text not null default 'held' check (status in ('held','partially_refunded','refunded','forfeited_damage','forfeited_arrears')),
  received_date date not null default current_date,
  settled_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  request_id text unique,
  constraint tenant_deposits_amounts_check check (deducted_amount + refunded_amount + remaining_amount <= deposit_amount + 0.001),
  constraint tenant_deposits_remaining_check check (remaining_amount = deposit_amount - deducted_amount - refunded_amount)
);

create index if not exists idx_tenant_deposits_contract on public.tenant_deposits(contract_id) where deleted_at is null;
create index if not exists idx_tenant_deposits_status on public.tenant_deposits(status) where deleted_at is null;
create index if not exists idx_tenant_deposits_tenant on public.tenant_deposits(tenant_id) where deleted_at is null;

alter table public.tenant_deposits enable row level security;

drop policy if exists app_read_tenant_deposits on public.tenant_deposits;
drop policy if exists manager_write_tenant_deposits on public.tenant_deposits;
drop policy if exists app_user_tenant_deposits on public.tenant_deposits;

create policy app_read_tenant_deposits on public.tenant_deposits
  for select to authenticated
  using (public.is_app_user());

create policy manager_write_tenant_deposits on public.tenant_deposits
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

grant select on public.tenant_deposits to authenticated;
grant insert, update on public.tenant_deposits to authenticated;
revoke delete on public.tenant_deposits from authenticated;

-- 2. Create deposit_transactions immutable log
create table if not exists public.deposit_transactions (
  id uuid primary key default gen_random_uuid(),
  deposit_id text not null references public.tenant_deposits(id) on delete cascade,
  type text not null check (type in ('held','deduction','refund')),
  amount numeric(14,2) not null check (amount > 0),
  reason text check (reason in ('maintenance_damage','unpaid_arrears','cleaning_fee','other','initial_deposit','refund_full','refund_partial')),
  description text,
  payment_method text check (payment_method in ('cash','bank_transfer','check')),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  request_id text not null unique,
  journal_batch_id uuid
);

create index if not exists idx_deposit_transactions_deposit on public.deposit_transactions(deposit_id);
create index if not exists idx_deposit_transactions_type on public.deposit_transactions(type);
create index if not exists idx_deposit_transactions_created on public.deposit_transactions(created_at desc);

alter table public.deposit_transactions enable row level security;

drop policy if exists app_read_deposit_transactions on public.deposit_transactions;
drop policy if exists manager_write_deposit_transactions on public.deposit_transactions;

create policy app_read_deposit_transactions on public.deposit_transactions
  for select to authenticated
  using (public.is_app_user());

create policy manager_write_deposit_transactions on public.deposit_transactions
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

grant select on public.deposit_transactions to authenticated;
grant insert on public.deposit_transactions to authenticated;
revoke update, delete on public.deposit_transactions from authenticated;

-- 3. Trigger for updated_at
drop trigger if exists trg_tenant_deposits_updated_at on public.tenant_deposits;
create trigger trg_tenant_deposits_updated_at
  before update on public.tenant_deposits
  for each row execute function public.set_updated_at();

-- 4. RPC: create_deposit_atomic - creates deposit + initial transaction + journal
create or replace function public.create_deposit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_request_id text := nullif(p_payload->>'request_id','');
  v_contract_id text := nullif(p_payload->>'contract_id','');
  v_tenant_id text := nullif(p_payload->>'tenant_id','');
  v_property_id uuid := nullif(p_payload->>'property_id','')::uuid;
  v_unit_id uuid := nullif(p_payload->>'unit_id','')::uuid;
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

  if v_contract_id is null then raise exception 'contract_id required'; end if;
  if v_amount is null or v_amount <=0 then raise exception 'amount must be >0'; end if;
  if v_received_date is null then v_received_date := current_date; end if;

  perform pg_advisory_xact_lock(hashtextextended('create_deposit:'||v_request_id,0));

  v_deposit_id := gen_random_uuid()::text;

  insert into public.tenant_deposits (id, contract_id, tenant_id, property_id, unit_id, deposit_amount, remaining_amount, status, received_date, notes, request_id)
  values (v_deposit_id, v_contract_id, v_tenant_id, v_property_id, v_unit_id, v_amount, v_amount, 'held', v_received_date, v_notes, v_request_id);

  insert into public.deposit_transactions (deposit_id, type, amount, reason, description, request_id)
  values (v_deposit_id, 'held', v_amount, 'initial_deposit', 'استلام وديعة تأمين', v_request_id || '-held');

  -- Journal: Debit cash (1111), Credit deposit liability (need account, assume 2200 Deposits Payable)
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

-- 5. RPC: deduct_deposit_atomic
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
  v_property_id uuid := nullif(p_payload->>'property_id','')::uuid;
  v_deposit record;
  v_cached jsonb;
  v_result jsonb;
  v_expense_account_id text;
  v_deposit_account_id text;
  v_expense_id uuid;
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
      status = case when (deposit_amount - (deducted_amount + v_amount) - refunded_amount) <=0 then 'forfeited_damage' else 'partially_refunded' end,
      updated_at = now()
  where id=v_deposit_id;

  insert into public.deposit_transactions (deposit_id, type, amount, reason, description, request_id)
  values (v_deposit_id, 'deduction', v_amount, v_reason, v_description, v_request_id);

  -- Create expense for damage
  v_expense_account_id := (select id from public.accounts where no='6100' limit 1);
  v_deposit_account_id := (select id from public.accounts where no='2200' limit 1);
  if v_expense_account_id is null then
    insert into public.accounts (id, no, name) values ('6100','6100','Operating Expenses') on conflict (id) do nothing;
    v_expense_account_id := '6100';
  end if;

  if v_deposit_account_id is not null and v_expense_account_id is not null then
    v_expense_id := gen_random_uuid();
    insert into public.expenses (id, property_id, category, amount, expense_date, description, status, no)
    values (v_expense_id, coalesce(v_property_id, v_deposit.property_id), 'صيانة من تأمين', v_amount, v_charged_date, 'خصم تأمين: '||coalesce(v_description,''), 'POSTED', 'EXP-DEP-'||substr(v_deposit_id,1,6));

    insert into public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id)
    values
      (gen_random_uuid()::text, 'DEP-DED-'||substr(v_deposit_id,1,6)||'-D', v_charged_date, v_deposit_account_id, v_amount, 'DEBIT', v_deposit_id, 'deposit_deduction', v_deposit_id),
      (gen_random_uuid()::text, 'DEP-DED-'||substr(v_deposit_id,1,6)||'-C', v_charged_date, v_expense_account_id, v_amount, 'CREDIT', v_deposit_id, 'deposit_deduction', v_deposit_id);
  end if;

  v_result := jsonb_build_object('success',true,'deposit_id',v_deposit_id,'deducted',v_amount,'remaining', v_deposit.remaining_amount - v_amount,'request_id',v_request_id);

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('deduct_deposit_atomic', v_request_id, v_result) on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$$;

revoke all on function public.deduct_deposit_atomic(jsonb) from public, anon;
grant execute on function public.deduct_deposit_atomic(jsonb) to authenticated, service_role;

-- 6. RPC: refund_deposit_atomic
create or replace function public.refund_deposit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
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

  if v_request_id is null then v_request_id := gen_random_uuid()::text; end if;
  select response_payload into v_cached from public.financial_operation_idempotency where operation_name='refund_deposit_atomic' and request_id=v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  if v_deposit_id is null then raise exception 'deposit_id required'; end if;
  if v_amount is null or v_amount <=0 then raise exception 'amount >0 required'; end if;
  if v_refund_date is null then v_refund_date := current_date; end if;
  if v_payment_method is null then v_payment_method := 'bank_transfer'; end if;

  perform pg_advisory_xact_lock(hashtextextended('refund_deposit:'||v_deposit_id,0));

  select * into v_deposit from public.tenant_deposits where id=v_deposit_id and deleted_at is null for update;
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

  insert into public.deposit_transactions (deposit_id, type, amount, reason, description, payment_method, request_id)
  values (v_deposit_id, 'refund', v_amount, 'refund_partial', v_notes, v_payment_method, v_request_id);

  v_cash_account_id := (select id from public.accounts where no='1111' limit 1);
  v_deposit_account_id := (select id from public.accounts where no='2200' limit 1);

  if v_cash_account_id is not null and v_deposit_account_id is not null then
    insert into public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id)
    values
      (gen_random_uuid()::text, 'DEP-REF-'||substr(v_deposit_id,1,6)||'-D', v_refund_date, v_deposit_account_id, v_amount, 'DEBIT', v_deposit_id, 'deposit_refund', v_deposit_id),
      (gen_random_uuid()::text, 'DEP-REF-'||substr(v_deposit_id,1,6)||'-C', v_refund_date, v_cash_account_id, v_amount, 'CREDIT', v_deposit_id, 'deposit_refund', v_deposit_id);
  end if;

  v_result := jsonb_build_object('success',true,'deposit_id',v_deposit_id,'refunded',v_amount,'remaining', v_deposit.remaining_amount - v_amount,'request_id',v_request_id);

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('refund_deposit_atomic', v_request_id, v_result) on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$$;

revoke all on function public.refund_deposit_atomic(jsonb) from public, anon;
grant execute on function public.refund_deposit_atomic(jsonb) to authenticated, service_role;

commit;
