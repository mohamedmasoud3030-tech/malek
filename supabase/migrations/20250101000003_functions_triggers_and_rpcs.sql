-- Rentrix code-first baseline: functions, triggers, and browser-facing RPCs.

begin;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_role text;
  v_claims jsonb;
begin
  select u.role into v_user_role
  from public.users u
  where u.id = (event ->> 'user_id')::uuid
    and u.deleted_at is null
    and u.is_active
    and u.status = 'ACTIVE';

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  v_claims := jsonb_set(v_claims, '{app_metadata,user_role}', to_jsonb(coalesce(v_user_role, 'USER')), true);
  return jsonb_set(event, '{claims}', v_claims, true);
end;
$$;

create or replace function public.find_payment_account_id(account_role text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_no text;
  v_account_id text;
begin
  case account_role
    when 'cash' then v_target_no := '1111';
    when 'receivable' then v_target_no := '1201';
    else return null;
  end case;

  select a.id into v_account_id
  from public.accounts a
  where a.no = v_target_no
  limit 1;

  return v_account_id;
end;
$$;

create or replace function public.validate_property_owner_active_totals()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_other_active_percentage_total numeric;
begin
  if new.ends_on is not null then
    return new;
  end if;

  select coalesce(sum(ownership_percentage), 0)
    into v_other_active_percentage_total
  from public.property_owners
  where property_id = new.property_id
    and ends_on is null
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_other_active_percentage_total + new.ownership_percentage > 100 then
    raise exception 'Active ownership percentages for a property cannot exceed 100.';
  end if;

  return new;
end;
$$;

create or replace function public.recalculate_invoice_status(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.invoices i
  set status = case
      when i.status = 'VOID' then 'VOID'
      when coalesce(i.paid_amount, 0) <= 0 and i.due_date < current_date then 'OVERDUE'
      when coalesce(i.paid_amount, 0) <= 0 then 'UNPAID'
      when coalesce(i.paid_amount, 0) < (i.amount + coalesce(i.tax_amount, 0)) then 'PARTIALLY_PAID'
      else 'PAID'
    end,
    updated_at = now()
  where i.id = p_invoice_id;
end;
$$;

create or replace function public.post_receipt_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id text := nullif(payload ->> 'request_id', '');
  v_receipt jsonb := payload -> 'receipt';
  v_receipt_id uuid := coalesce(nullif(v_receipt ->> 'id', '')::uuid, gen_random_uuid());
  v_existing jsonb;
  v_allocation jsonb;
  v_invoice_id uuid;
  v_amount numeric;
  v_no text;
begin
  if v_request_id is null then
    raise exception 'request_id is required';
  end if;

  select response_payload into v_existing
  from public.financial_operation_idempotency
  where operation_name = 'post_receipt_atomic'
    and request_id = v_request_id
  for update;

  if v_existing is not null then
    return v_existing;
  end if;

  v_no := coalesce(v_receipt ->> 'no', 'REC-' || upper(substr(replace(v_receipt_id::text, '-', ''), 1, 8)));

  insert into public.receipts (
    id, no, contract_id, date_time, channel, amount, ref, notes, status,
    request_id, tenant_id, created_at, updated_at
  )
  values (
    v_receipt_id,
    v_no,
    nullif(v_receipt ->> 'contract_id', '')::uuid,
    coalesce(nullif(v_receipt ->> 'date_time', '')::timestamptz, now()),
    nullif(v_receipt ->> 'channel', ''),
    (v_receipt ->> 'amount')::numeric,
    nullif(v_receipt ->> 'ref', ''),
    nullif(v_receipt ->> 'notes', ''),
    coalesce(nullif(v_receipt ->> 'status', ''), 'POSTED'),
    v_request_id,
    nullif(v_receipt ->> 'tenant_id', '')::uuid,
    now(),
    now()
  );

  for v_allocation in select * from jsonb_array_elements(coalesce(payload -> 'allocations', '[]'::jsonb))
  loop
    v_invoice_id := nullif(v_allocation ->> 'invoice_id', '')::uuid;
    v_amount := (v_allocation ->> 'amount')::numeric;

    insert into public.receipt_allocations (id, receipt_id, invoice_id, amount, tenant_id, created_at, updated_at)
    values (
      coalesce(nullif(v_allocation ->> 'id', '')::uuid, gen_random_uuid()),
      v_receipt_id,
      v_invoice_id,
      v_amount,
      nullif(v_allocation ->> 'tenant_id', '')::uuid,
      now(),
      now()
    );

    update public.invoices
    set paid_amount = coalesce(paid_amount, 0) + v_amount,
      updated_at = now()
    where id = v_invoice_id;

    perform public.recalculate_invoice_status(v_invoice_id);
  end loop;

  v_existing := jsonb_build_object('success', true, 'receipt_id', v_receipt_id, 'receipt_no', v_no);

  insert into public.financial_operation_idempotency(operation_name, request_id, response_payload)
  values ('post_receipt_atomic', v_request_id, v_existing);

  return v_existing;
end;
$$;

create or replace function public.record_invoice_payment_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  v_invoice record;
  v_invoice_id uuid := nullif(payload ->> 'invoice_id', '')::uuid;
  v_amount numeric := coalesce((payload ->> 'amount')::numeric, 0);
  v_method text := nullif(payload ->> 'method', '');
  v_date date := coalesce(nullif(payload ->> 'date', '')::date, current_date);
  v_reference text := nullif(payload ->> 'reference', '');
  v_request_id text := nullif(payload ->> 'request_id', '');
  v_payment_id uuid := gen_random_uuid();
  v_receipt_id uuid := gen_random_uuid();
  v_result jsonb;
  v_existing jsonb;
begin
  if actor_id is null then
    raise exception 'Authentication is required to record invoice payments';
  end if;
  if not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to record invoice payments' using errcode = '42501';
  end if;
  if v_request_id is null then
    raise exception 'request_id is required for idempotent payment recording';
  end if;
  if v_invoice_id is null then
    raise exception 'invoice_id is required';
  end if;
  if v_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('record_invoice_payment_atomic:' || v_request_id, 0));

  select response_payload into v_existing
  from public.financial_operation_idempotency
  where operation_name = 'record_invoice_payment_atomic'
    and request_id = v_request_id
  for update;

  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_invoice
  from public.invoices
  where id = v_invoice_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Invoice not found';
  end if;
  if v_amount > (v_invoice.amount + coalesce(v_invoice.tax_amount, 0) - coalesce(v_invoice.paid_amount, 0)) + 0.001 then
    raise exception 'Payment amount exceeds outstanding invoice balance';
  end if;
  if public.find_payment_account_id('cash') is null or public.find_payment_account_id('receivable') is null then
    raise exception 'Payment accounting accounts are not configured';
  end if;

  insert into public.payments (
    id, invoice_id, contract_id, amount, payment_method, payment_date,
    reference_number, reference_no, date_time, channel, status, notes,
    receipt_id, created_by, created_at, updated_at
  )
  values (
    v_payment_id, v_invoice_id, v_invoice.contract_id, v_amount, coalesce(v_method, 'cash'), v_date,
    v_reference, v_reference, v_date::timestamptz, v_method, 'POSTED',
    'Invoice payment ' || v_invoice_id::text, v_receipt_id, actor_id, now(), now()
  );

  v_result := public.post_receipt_atomic(jsonb_build_object(
    'request_id', v_request_id,
    'receipt', jsonb_build_object(
      'id', v_receipt_id,
      'contract_id', v_invoice.contract_id,
      'date_time', v_date::text,
      'channel', v_method,
      'amount', v_amount,
      'ref', coalesce(v_reference, v_request_id),
      'status', 'POSTED'
    ),
    'allocations', jsonb_build_array(jsonb_build_object(
      'invoice_id', v_invoice_id,
      'amount', v_amount
    ))
  ));

  update public.receipts set payment_id = v_payment_id where id = v_receipt_id;

  v_result := jsonb_build_object(
    'status', 'recorded',
    'success', true,
    'request_id', v_request_id,
    'invoice_id', v_invoice_id,
    'payment_id', v_payment_id,
    'receipt_id', v_receipt_id,
    'receipt_no', v_result ->> 'receipt_no',
    'idempotent', false
  );

  insert into public.financial_operation_idempotency(operation_name, request_id, response_payload)
  values ('record_invoice_payment_atomic', v_request_id, v_result);

  return v_result;
end;
$$;

create or replace function public.renew_contract_atomic(old_contract_id uuid, new_contract_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.contracts%rowtype;
  v_new_id uuid;
  v_new_start date := nullif(new_contract_data ->> 'new_start', '')::date;
  v_new_end date := nullif(new_contract_data ->> 'new_end', '')::date;
  v_new_amount numeric := nullif(new_contract_data ->> 'new_amount', '')::numeric;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to renew contracts' using errcode = '42501';
  end if;

  select * into v_old
  from public.contracts
  where id = old_contract_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Original contract not found';
  end if;

  update public.contracts
  set status = 'expired', updated_at = now()
  where id = old_contract_id;

  insert into public.contracts (
    property_id, unit_id, tenant_id, start_date, end_date, rent_amount,
    payment_cycle, status, renewed_from_id, notes, attachment_url
  )
  values (
    v_old.property_id, v_old.unit_id, v_old.tenant_id,
    coalesce(v_new_start, v_old.end_date + 1),
    coalesce(v_new_end, v_old.end_date + 365),
    coalesce(v_new_amount, v_old.rent_amount),
    v_old.payment_cycle,
    'active',
    old_contract_id,
    v_old.notes,
    v_old.attachment_url
  )
  returning id into v_new_id;

  return jsonb_build_object('status', 'renewed', 'old_contract_id', old_contract_id, 'new_contract_id', v_new_id);
end;
$$;

create or replace function public.generate_invoices_from_active_contracts()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to generate invoices' using errcode = '42501';
  end if;

  insert into public.invoices (contract_id, issue_date, due_date, amount, status)
  select c.id, current_date, current_date, c.rent_amount, 'UNPAID'
  from public.contracts c
  where c.deleted_at is null
    and lower(c.status) = 'active'
    and not exists (
      select 1
      from public.invoices i
      where i.contract_id = c.id
        and i.issue_date = current_date
        and i.deleted_at is null
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.void_receipt_atomic(
  p_receipt_id uuid,
  p_voided_at timestamptz default now(),
  p_invoice_updates jsonb default '[]'::jsonb,
  p_reverse_entries jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt public.receipts%rowtype;
  v_allocation record;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to void receipts' using errcode = '42501';
  end if;

  select * into v_receipt from public.receipts where id = p_receipt_id for update;
  if not found then
    raise exception 'Receipt not found';
  end if;
  if v_receipt.status = 'VOID' then
    return jsonb_build_object('success', true, 'idempotent', true, 'voided_at', coalesce(v_receipt.voided_at, p_voided_at)::text);
  end if;

  update public.receipts
  set status = 'VOID', voided_at = p_voided_at, updated_at = now()
  where id = p_receipt_id;

  update public.payments
  set status = 'VOID', deleted_at = p_voided_at, updated_at = now()
  where receipt_id = p_receipt_id;

  for v_allocation in select * from public.receipt_allocations where receipt_id = p_receipt_id
  loop
    update public.invoices
    set paid_amount = greatest(0, coalesce(paid_amount, 0) - v_allocation.amount),
      updated_at = now()
    where id = v_allocation.invoice_id;

    perform public.recalculate_invoice_status(v_allocation.invoice_id);
  end loop;

  delete from public.receipt_allocations where receipt_id = p_receipt_id;
  return jsonb_build_object('success', true, 'idempotent', false, 'voided_at', p_voided_at::text);
end;
$$;

create or replace function public.void_receipt_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt_id uuid := nullif(payload ->> 'receipt_id', '')::uuid;
begin
  if v_receipt_id is null then
    raise exception 'receipt_id is required';
  end if;
  return public.void_receipt_atomic(v_receipt_id, now(), '[]'::jsonb, '[]'::jsonb);
end;
$$;

create or replace function public.rpt_financial_summary(p_from date, p_to date)
returns table (
  collected numeric,
  expenses numeric,
  net numeric,
  revenue numeric,
  net_income numeric,
  overdue_amount numeric,
  overdue_count bigint,
  active_contracts bigint,
  total_units bigint,
  occupied_units bigint,
  occupancy_rate numeric,
  pending_invoices bigint,
  period_from date,
  period_to date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with totals as (
    select
      coalesce((select sum(amount) from public.payments where deleted_at is null and payment_date between p_from and p_to and coalesce(status, 'POSTED') <> 'VOID'), 0) as collected,
      coalesce((select sum(amount) from public.expenses where deleted_at is null and expense_date between p_from and p_to), 0) as expenses,
      coalesce((select sum(amount + coalesce(tax_amount, 0)) from public.invoices where deleted_at is null and issue_date between p_from and p_to), 0) as revenue,
      coalesce((select sum(amount + coalesce(tax_amount, 0) - paid_amount) from public.invoices where deleted_at is null and status in ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE') and due_date < current_date), 0) as overdue_amount,
      coalesce((select count(*) from public.invoices where deleted_at is null and status in ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE') and due_date < current_date), 0) as overdue_count,
      coalesce((select count(*) from public.contracts where deleted_at is null and lower(status) = 'active'), 0) as active_contracts,
      coalesce((select count(*) from public.units where deleted_at is null), 0) as total_units,
      coalesce((select count(*) from public.units where deleted_at is null and status = 'occupied'), 0) as occupied_units,
      coalesce((select count(*) from public.invoices where deleted_at is null and status in ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE')), 0) as pending_invoices
  )
  select
    collected,
    expenses,
    collected - expenses as net,
    revenue,
    collected - expenses as net_income,
    overdue_amount,
    overdue_count,
    active_contracts,
    total_units,
    occupied_units,
    case when total_units = 0 then 0 else round((occupied_units::numeric / total_units::numeric) * 100, 2) end as occupancy_rate,
    pending_invoices,
    p_from,
    p_to
  from totals
$$;

create or replace function public.update_unit_status_from_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit_id uuid := coalesce(new.unit_id, old.unit_id);
begin
  if v_unit_id is null then
    return coalesce(new, old);
  end if;

  update public.units u
  set status = case
      when exists (
        select 1 from public.maintenance_records m
        where m.unit_id = v_unit_id
          and m.deleted_at is null
          and coalesce(m.status, '') in ('open', 'in_progress', 'urgent')
      ) then 'maintenance'
      when exists (
        select 1 from public.contracts c
        where c.unit_id = v_unit_id
          and c.deleted_at is null
          and lower(c.status) = 'active'
          and current_date between c.start_date and c.end_date
      ) then 'occupied'
      else 'available'
    end,
    updated_at = now()
  where u.id = v_unit_id;

  return coalesce(new, old);
end;
$$;

create trigger set_users_updated_at before update on public.users for each row execute function public.touch_updated_at();
create trigger set_company_settings_updated_at before update on public.company_settings for each row execute function public.touch_updated_at();
create trigger set_owners_updated_at before update on public.owners for each row execute function public.touch_updated_at();
create trigger set_properties_updated_at before update on public.properties for each row execute function public.touch_updated_at();
create trigger set_property_owners_updated_at before update on public.property_owners for each row execute function public.touch_updated_at();
create trigger validate_property_owner_active_totals
before insert or update of property_id, ownership_percentage, ends_on on public.property_owners
for each row execute function public.validate_property_owner_active_totals();
create trigger set_units_updated_at before update on public.units for each row execute function public.touch_updated_at();
create trigger set_people_updated_at before update on public.people for each row execute function public.touch_updated_at();
create trigger set_contracts_updated_at before update on public.contracts for each row execute function public.touch_updated_at();
create trigger set_invoices_updated_at before update on public.invoices for each row execute function public.touch_updated_at();
create trigger set_payments_updated_at before update on public.payments for each row execute function public.touch_updated_at();
create trigger set_receipts_updated_at before update on public.receipts for each row execute function public.touch_updated_at();
create trigger set_receipt_allocations_updated_at before update on public.receipt_allocations for each row execute function public.touch_updated_at();
create trigger set_expenses_updated_at before update on public.expenses for each row execute function public.touch_updated_at();
create trigger set_maintenance_records_updated_at before update on public.maintenance_records for each row execute function public.touch_updated_at();

create trigger update_unit_status_after_contract_change
after insert or update or delete on public.contracts
for each row execute function public.update_unit_status_from_activity();

create trigger update_unit_status_after_maintenance_change
after insert or update or delete on public.maintenance_records
for each row execute function public.update_unit_status_from_activity();

revoke all on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

revoke all on function public.find_payment_account_id(text) from public, anon, authenticated;
revoke all on function public.post_receipt_atomic(jsonb) from public, anon, authenticated;
revoke all on function public.void_receipt_atomic(uuid, timestamptz, jsonb, jsonb) from public, anon, authenticated;

revoke all on function public.record_invoice_payment_atomic(jsonb) from public, anon;
grant execute on function public.record_invoice_payment_atomic(jsonb) to authenticated;

revoke all on function public.renew_contract_atomic(uuid, jsonb) from public, anon;
grant execute on function public.renew_contract_atomic(uuid, jsonb) to authenticated;

revoke all on function public.generate_invoices_from_active_contracts() from public, anon;
grant execute on function public.generate_invoices_from_active_contracts() to authenticated;

revoke all on function public.void_receipt_atomic(jsonb) from public, anon;
grant execute on function public.void_receipt_atomic(jsonb) to authenticated;

revoke all on function public.rpt_financial_summary(date, date) from public, anon;
grant execute on function public.rpt_financial_summary(date, date) to authenticated;

commit;
