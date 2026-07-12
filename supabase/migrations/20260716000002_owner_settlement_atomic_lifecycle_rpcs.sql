-- =============================================================================
-- Owner settlement atomic lifecycle RPCs
-- Policy source: docs/decisions/0001-product-accounting-policies.md
-- No rows are generated automatically and this migration is not applied by this PR.
-- =============================================================================

begin;

insert into public.accounts (id, no, name)
values ('2000', '2000', 'Owner Payables')
on conflict (id) do nothing;

create or replace function public.create_owner_settlement_draft_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_owner_id text := nullif(p_payload->>'owner_id', '');
  v_property_id text := nullif(p_payload->>'property_id', '');
  v_period_start date := nullif(p_payload->>'period_start', '')::date;
  v_period_end date := nullif(p_payload->>'period_end', '')::date;
  v_gross numeric := coalesce(nullif(p_payload->>'gross_collected', '')::numeric, 0);
  v_fee numeric := coalesce(nullif(p_payload->>'office_fee', '')::numeric, 0);
  v_expenses numeric := coalesce(nullif(p_payload->>'owner_expenses', '')::numeric, 0);
  v_tax numeric := coalesce(nullif(p_payload->>'tax_amount', '')::numeric, 0);
  v_net numeric;
  v_id text;
  v_no text;
  v_result jsonb;
  v_cached jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to create owner settlements.' using errcode = '42501';
  end if;
  if v_owner_id is null or v_period_start is null or v_period_end is null or v_request_id is null then
    raise exception 'owner_id, period_start, period_end, and request_id are required.';
  end if;
  if v_period_start > v_period_end then raise exception 'period_start must be on or before period_end.'; end if;
  if least(v_gross, v_fee, v_expenses, v_tax) < 0 then raise exception 'Settlement amounts cannot be negative.'; end if;

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'create_owner_settlement_draft_atomic' and request_id = v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'owner_settlement:' || v_owner_id || ':' || coalesce(v_property_id, '*') || ':' || v_period_start || ':' || v_period_end,
    0
  ));

  if exists (
    select 1 from public.owner_settlements
    where owner_id = v_owner_id
      and coalesce(property_id, '') = coalesce(v_property_id, '')
      and period_start = v_period_start
      and period_end = v_period_end
      and status <> 'CANCELLED'
  ) then
    raise exception 'An active settlement already exists for this owner, property, and period.' using errcode = '23505';
  end if;

  v_net := greatest(v_gross - v_fee - v_expenses - v_tax, 0);
  v_id := gen_random_uuid()::text;
  v_no := 'OST-' || to_char(v_period_end, 'YYYYMM') || '-' || upper(substr(replace(v_id, '-', ''), 1, 8));

  insert into public.owner_settlements (
    id, no, owner_id, property_id, date, period_start, period_end,
    gross_collected, office_fee, owner_expenses, tax_amount, net_payable,
    amount, status, request_id, notes, created_at, updated_at
  ) values (
    v_id, v_no, v_owner_id, v_property_id, v_period_end::text, v_period_start, v_period_end,
    v_gross, v_fee, v_expenses, v_tax, v_net,
    v_net, 'DRAFT', v_request_id::uuid, p_payload->>'notes', now(), now()
  );

  insert into public.audit_log (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'CREATE', 'owner_settlements', v_id, 'Owner settlement draft created',
    'owner_settlements', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false, 'settlement_id', v_id,
    'settlement_no', v_no, 'status', 'DRAFT', 'net_payable', v_net,
    'request_id', v_request_id
  );
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('create_owner_settlement_draft_atomic', v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;
  return v_result;
end;
$$;

create or replace function public.approve_owner_settlement_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_id text := nullif(p_payload->>'settlement_id', '');
  v_row public.owner_settlements%rowtype;
  v_cached jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to approve owner settlements.' using errcode = '42501';
  end if;
  if v_id is null or v_request_id is null then raise exception 'settlement_id and request_id are required.'; end if;
  select response_payload into v_cached from public.financial_operation_idempotency
   where operation_name = 'approve_owner_settlement_atomic' and request_id = v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  select * into v_row from public.owner_settlements where id = v_id for update;
  if not found then raise exception 'Owner settlement not found.'; end if;
  if v_row.status <> 'DRAFT' then raise exception 'Only DRAFT settlements can be approved.'; end if;

  update public.owner_settlements
     set status = 'APPROVED', approved_at = now(), approved_by = auth.uid(), updated_at = now()
   where id = v_id;

  insert into public.audit_log (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values (gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()), 'APPROVE', 'owner_settlements', v_id,
    'Owner settlement approved; owner payable is recognized operationally', 'owner_settlements', left(p_payload::text, 4000), now());

  v_result := jsonb_build_object('success', true, 'idempotent', false, 'settlement_id', v_id, 'status', 'APPROVED', 'net_payable', v_row.net_payable, 'request_id', v_request_id);
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('approve_owner_settlement_atomic', v_request_id, v_result) on conflict (operation_name, request_id) do nothing;
  return v_result;
end;
$$;

create or replace function public.pay_owner_settlement_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_id text := nullif(p_payload->>'settlement_id', '');
  v_method text := nullif(btrim(p_payload->>'method'), '');
  v_reference text := nullif(btrim(p_payload->>'payment_reference'), '');
  v_row public.owner_settlements%rowtype;
  v_owner_payable_account text;
  v_cash_account text;
  v_batch_id uuid := gen_random_uuid();
  v_entry_no text;
  v_cached jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to pay owner settlements.' using errcode = '42501';
  end if;
  if v_id is null or v_request_id is null or v_method is null then
    raise exception 'settlement_id, request_id, and method are required.';
  end if;
  select response_payload into v_cached from public.financial_operation_idempotency
   where operation_name = 'pay_owner_settlement_atomic' and request_id = v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  select * into v_row from public.owner_settlements where id = v_id for update;
  if not found then raise exception 'Owner settlement not found.'; end if;
  if v_row.status <> 'APPROVED' then raise exception 'Only APPROVED settlements can be paid.'; end if;

  select id into v_owner_payable_account from public.accounts where no = '2000' limit 1;
  select id into v_cash_account from public.accounts where no = '1111' limit 1;
  if v_owner_payable_account is null or v_cash_account is null then
    raise exception 'Owner payable or cash accounting account is not configured.';
  end if;

  v_entry_no := 'OST-PAY-' || upper(substr(replace(v_id, '-', ''), 1, 10));
  insert into public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, batch_id, created_at)
  values
    (gen_random_uuid(), v_entry_no || '-D', current_date, v_owner_payable_account, v_row.net_payable, 'DEBIT', v_id::uuid, 'owner_settlement_payment', v_id, v_batch_id, now()),
    (gen_random_uuid(), v_entry_no || '-C', current_date, v_cash_account, v_row.net_payable, 'CREDIT', v_id::uuid, 'owner_settlement_payment', v_id, v_batch_id, now());

  update public.owner_settlements
     set status = 'PAID', method = v_method, payment_reference = v_reference,
         paid_at = now(), paid_by = auth.uid(), updated_at = now()
   where id = v_id;

  insert into public.audit_log (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values (gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()), 'PAY', 'owner_settlements', v_id,
    'Owner settlement paid with balanced owner-payable/cash journal batch', 'owner_settlements', left(p_payload::text, 4000), now());

  v_result := jsonb_build_object('success', true, 'idempotent', false, 'settlement_id', v_id, 'status', 'PAID', 'net_payable', v_row.net_payable, 'journal_batch_id', v_batch_id, 'request_id', v_request_id);
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('pay_owner_settlement_atomic', v_request_id, v_result) on conflict (operation_name, request_id) do nothing;
  return v_result;
end;
$$;

create or replace function public.cancel_owner_settlement_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_id text := nullif(p_payload->>'settlement_id', '');
  v_reason text := nullif(btrim(p_payload->>'reason'), '');
  v_row public.owner_settlements%rowtype;
  v_cached jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to cancel owner settlements.' using errcode = '42501';
  end if;
  if v_id is null or v_request_id is null or v_reason is null then raise exception 'settlement_id, request_id, and reason are required.'; end if;
  select response_payload into v_cached from public.financial_operation_idempotency
   where operation_name = 'cancel_owner_settlement_atomic' and request_id = v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  select * into v_row from public.owner_settlements where id = v_id for update;
  if not found then raise exception 'Owner settlement not found.'; end if;
  if v_row.status not in ('DRAFT', 'APPROVED') then
    raise exception 'Only DRAFT or APPROVED settlements can be cancelled; paid settlements require a controlled reversal.';
  end if;

  update public.owner_settlements
     set status = 'CANCELLED', cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = v_reason, updated_at = now()
   where id = v_id;

  insert into public.audit_log (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values (gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()), 'CANCEL', 'owner_settlements', v_id,
    'Owner settlement cancelled: ' || v_reason, 'owner_settlements', left(p_payload::text, 4000), now());

  v_result := jsonb_build_object('success', true, 'idempotent', false, 'settlement_id', v_id, 'status', 'CANCELLED', 'request_id', v_request_id);
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('cancel_owner_settlement_atomic', v_request_id, v_result) on conflict (operation_name, request_id) do nothing;
  return v_result;
end;
$$;

alter function public.create_owner_settlement_draft_atomic(jsonb) owner to postgres;
alter function public.approve_owner_settlement_atomic(jsonb) owner to postgres;
alter function public.pay_owner_settlement_atomic(jsonb) owner to postgres;
alter function public.cancel_owner_settlement_atomic(jsonb) owner to postgres;

revoke all on function public.create_owner_settlement_draft_atomic(jsonb) from public, anon;
revoke all on function public.approve_owner_settlement_atomic(jsonb) from public, anon;
revoke all on function public.pay_owner_settlement_atomic(jsonb) from public, anon;
revoke all on function public.cancel_owner_settlement_atomic(jsonb) from public, anon;

grant execute on function public.create_owner_settlement_draft_atomic(jsonb) to authenticated, service_role;
grant execute on function public.approve_owner_settlement_atomic(jsonb) to authenticated, service_role;
grant execute on function public.pay_owner_settlement_atomic(jsonb) to authenticated, service_role;
grant execute on function public.cancel_owner_settlement_atomic(jsonb) to authenticated, service_role;

commit;
