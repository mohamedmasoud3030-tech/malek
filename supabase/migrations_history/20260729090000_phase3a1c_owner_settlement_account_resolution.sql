-- ============================================================================
-- Phase 3A-1C — canonical owner-settlement accounts and immutable requests
-- ============================================================================
-- Scope:
--   * preserve the P1 server-derived settlement amounts and lifecycle states;
--   * resolve payout accounts 2000/1111 through require_company_account_id;
--   * bind every settlement request_id to one immutable request per company;
--   * resolve and lock settlement targets inside the caller's company before
--     any cache replay, then assert every status UPDATE affects exactly one row.
--
-- No table, column, row, trigger, RLS policy, or calculation is changed.
-- Rollback:
--   supabase/rollback/20260729_rollback_phase3a1c_owner_settlement_account_resolution.sql
-- ============================================================================

begin;

create or replace function public.create_owner_settlement_draft_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_owner_id text := nullif(p_payload->>'owner_id', '');
  v_property_id text := nullif(p_payload->>'property_id', '');
  v_period_start date := nullif(p_payload->>'period_start', '')::date;
  v_period_end date := nullif(p_payload->>'period_end', '')::date;
  v_notes text := nullif(btrim(p_payload->>'notes'), '');
  v_gross numeric;
  v_fee numeric;
  v_expenses numeric;
  v_tax numeric;
  v_net numeric;
  v_id text;
  v_no text;
  v_result jsonb;
  v_cached jsonb;
  v_operation_name text;
  v_target_id text;
  v_request_fingerprint text;
  v_cached_fingerprint text;
  v_cached_target_id text;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to create owner settlements.'
      using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_company_id is null then
    raise exception 'Company context is required (no company_id claim in JWT).'
      using errcode = '42501';
  end if;

  if v_owner_id is null or v_period_start is null or v_period_end is null or v_request_id is null then
    raise exception 'owner_id, period_start, period_end, and request_id are required.'
      using errcode = '22023';
  end if;
  if v_period_start > v_period_end then
    raise exception 'period_start must be on or before period_end.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.owners o
    where o.id::text = v_owner_id
      and o.company_id = v_company_id
      and o.deleted_at is null
  ) then
    raise exception 'Settlement target owner was not found.'
      using errcode = 'P0002';
  end if;

  if v_property_id is not null and not exists (
    select 1
    from public.properties p
    where p.id::text = v_property_id
      and p.company_id = v_company_id
      and p.deleted_at is null
  ) then
    raise exception 'Settlement target property was not found.'
      using errcode = 'P0002';
  end if;

  v_operation_name := 'create_owner_settlement_draft_atomic:' || v_company_id::text;
  v_target_id := v_owner_id || ':' || coalesce(v_property_id, '*') || ':'
    || v_period_start::text || ':' || v_period_end::text;
  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'owner_id', v_owner_id,
    'property_id', v_property_id,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'notes', v_notes
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(
    hashtextextended(v_operation_name || ':' || v_request_id, 0)
  );

  select response_payload
    into v_cached
  from public.financial_operation_idempotency
  where operation_name = v_operation_name
    and request_id = v_request_id
  for update;

  if v_cached is not null then
    v_cached_fingerprint := v_cached->>'_request_fingerprint';
    v_cached_target_id := v_cached->>'_target_id';
    if v_cached_fingerprint is null
       or v_cached_target_id is null
       or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED'
        using errcode = '22023';
    end if;
    if v_cached_fingerprint <> v_request_fingerprint
       or v_cached_target_id <> v_target_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        using errcode = '22023';
    end if;
    return (v_cached->'response') || jsonb_build_object('idempotent', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'owner_settlement:' || v_company_id::text || ':' || v_target_id,
    0
  ));

  if exists (
    select 1
    from public.owner_settlements s
    where s.company_id = v_company_id
      and s.owner_id::text = v_owner_id
      and coalesce(s.property_id::text, '') = coalesce(v_property_id, '')
      and s.period_start = v_period_start
      and s.period_end = v_period_end
      and s.status <> 'CANCELLED'
  ) then
    raise exception 'An active settlement already exists for this owner, property, and period.'
      using errcode = '23505';
  end if;

  select c.gross_collected, c.office_fee, c.owner_expenses, c.tax_amount, c.net_payable
    into v_gross, v_fee, v_expenses, v_tax, v_net
  from public.calculate_owner_net_payout(
    v_owner_id::uuid,
    v_period_start,
    v_period_end,
    v_property_id::uuid
  ) as c;

  v_id := gen_random_uuid()::text;
  v_no := 'OST-' || to_char(v_period_end, 'YYYYMM') || '-'
    || upper(substr(replace(v_id, '-', ''), 1, 8));

  insert into public.owner_settlements (
    id, no, owner_id, property_id, date, period_start, period_end,
    gross_collected, office_fee, owner_expenses, tax_amount, net_payable,
    amount, status, request_id, notes, created_at, updated_at, company_id
  ) values (
    v_id, v_no, v_owner_id, v_property_id, v_period_end::text, v_period_start, v_period_end,
    v_gross, v_fee, v_expenses, v_tax, v_net,
    v_net, 'DRAFT', v_request_id::uuid, v_notes, now(), now(), v_company_id
  );

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'CREATE', 'owner_settlements', v_id,
    'Owner settlement draft created (server-derived amounts)',
    'owner_settlements', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'settlement_id', v_id,
    'settlement_no', v_no,
    'status', 'DRAFT',
    'net_payable', v_net,
    'amounts_source', 'server_derived',
    'request_id', v_request_id
  );

  insert into public.financial_operation_idempotency (
    operation_name, request_id, response_payload
  ) values (
    v_operation_name,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_request_fingerprint,
      '_target_id', v_target_id,
      'response', v_result
    )
  )
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$;

create or replace function public.approve_owner_settlement_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_id text := nullif(p_payload->>'settlement_id', '');
  v_row public.owner_settlements%rowtype;
  v_cached jsonb;
  v_result jsonb;
  v_operation_name text;
  v_request_fingerprint text;
  v_cached_fingerprint text;
  v_cached_target_id text;
  v_updated_count integer;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to approve owner settlements.'
      using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_company_id is null then
    raise exception 'Company context is required (no company_id claim in JWT).'
      using errcode = '42501';
  end if;
  if v_id is null or v_request_id is null then
    raise exception 'settlement_id and request_id are required.'
      using errcode = '22023';
  end if;

  v_operation_name := 'approve_owner_settlement_atomic:' || v_company_id::text;
  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'settlement_id', v_id
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(
    hashtextextended(v_operation_name || ':' || v_request_id, 0)
  );

  select *
    into v_row
  from public.owner_settlements s
  where s.id::text = v_id
    and s.company_id = v_company_id
  for update;

  if not found then
    raise exception 'Owner settlement not found.'
      using errcode = 'P0002';
  end if;

  select response_payload
    into v_cached
  from public.financial_operation_idempotency
  where operation_name = v_operation_name
    and request_id = v_request_id
  for update;

  if v_cached is not null then
    v_cached_fingerprint := v_cached->>'_request_fingerprint';
    v_cached_target_id := v_cached->>'_target_id';
    if v_cached_fingerprint is null
       or v_cached_target_id is null
       or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED'
        using errcode = '22023';
    end if;
    if v_cached_fingerprint <> v_request_fingerprint
       or v_cached_target_id <> v_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        using errcode = '22023';
    end if;
    return (v_cached->'response') || jsonb_build_object('idempotent', true);
  end if;

  if v_row.status <> 'DRAFT' then
    raise exception 'Only DRAFT settlements can be approved.'
      using errcode = '22023';
  end if;

  update public.owner_settlements
     set status = 'APPROVED',
         approved_at = now(),
         approved_by = auth.uid(),
         updated_at = now()
   where id::text = v_id
     and company_id = v_company_id;
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'OWNER_SETTLEMENT_UPDATE_COUNT_MISMATCH'
      using errcode = 'P0001';
  end if;

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'APPROVE', 'owner_settlements', v_id,
    'Owner settlement approved; owner payable is recognized operationally',
    'owner_settlements', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'settlement_id', v_id,
    'status', 'APPROVED',
    'net_payable', v_row.net_payable,
    'request_id', v_request_id
  );

  insert into public.financial_operation_idempotency (
    operation_name, request_id, response_payload
  ) values (
    v_operation_name,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_request_fingerprint,
      '_target_id', v_id,
      'response', v_result
    )
  )
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$;

create or replace function public.pay_owner_settlement_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_id text := nullif(p_payload->>'settlement_id', '');
  v_method text := nullif(btrim(p_payload->>'method'), '');
  v_reference text := nullif(btrim(p_payload->>'payment_reference'), '');
  v_row public.owner_settlements%rowtype;
  v_owner_payable_account text;
  v_cash_account text;
  v_batch_id uuid;
  v_entry_no text;
  v_cached jsonb;
  v_result jsonb;
  v_operation_name text;
  v_request_fingerprint text;
  v_cached_fingerprint text;
  v_cached_target_id text;
  v_journal_count integer;
  v_updated_count integer;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to pay owner settlements.'
      using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_company_id is null then
    raise exception 'Company context is required (no company_id claim in JWT).'
      using errcode = '42501';
  end if;
  if v_id is null or v_request_id is null or v_method is null then
    raise exception 'settlement_id, request_id, and method are required.'
      using errcode = '22023';
  end if;

  v_operation_name := 'pay_owner_settlement_atomic:' || v_company_id::text;
  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'settlement_id', v_id,
    'method', v_method,
    'payment_reference', v_reference
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(
    hashtextextended(v_operation_name || ':' || v_request_id, 0)
  );

  select *
    into v_row
  from public.owner_settlements s
  where s.id::text = v_id
    and s.company_id = v_company_id
  for update;

  if not found then
    raise exception 'Owner settlement not found.'
      using errcode = 'P0002';
  end if;

  select response_payload
    into v_cached
  from public.financial_operation_idempotency
  where operation_name = v_operation_name
    and request_id = v_request_id
  for update;

  if v_cached is not null then
    v_cached_fingerprint := v_cached->>'_request_fingerprint';
    v_cached_target_id := v_cached->>'_target_id';
    if v_cached_fingerprint is null
       or v_cached_target_id is null
       or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED'
        using errcode = '22023';
    end if;
    if v_cached_fingerprint <> v_request_fingerprint
       or v_cached_target_id <> v_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        using errcode = '22023';
    end if;
    return (v_cached->'response') || jsonb_build_object('idempotent', true);
  end if;

  if v_row.status <> 'APPROVED' then
    raise exception 'Only APPROVED settlements can be paid.'
      using errcode = '22023';
  end if;

  v_owner_payable_account := public.require_company_account_id(v_company_id, '2000');
  v_cash_account := public.require_company_account_id(v_company_id, '1111');

  v_batch_id := gen_random_uuid();
  v_entry_no := 'OST-PAY-' || upper(substr(replace(v_id, '-', ''), 1, 10));

  insert into public.journal_entries (
    id, no, date, account_id, amount, type, source_id,
    entity_type, entity_id, batch_id, created_at, company_id
  ) values
    (
      gen_random_uuid(), v_entry_no || '-D', current_date,
      v_owner_payable_account, v_row.net_payable, 'DEBIT', v_id::uuid,
      'owner_settlement_payment', v_id, v_batch_id, now(), v_company_id
    ),
    (
      gen_random_uuid(), v_entry_no || '-C', current_date,
      v_cash_account, v_row.net_payable, 'CREDIT', v_id::uuid,
      'owner_settlement_payment', v_id, v_batch_id, now(), v_company_id
    );
  get diagnostics v_journal_count = row_count;
  if v_journal_count <> 2 then
    raise exception 'OWNER_SETTLEMENT_JOURNAL_COUNT_MISMATCH'
      using errcode = 'P0001';
  end if;

  update public.owner_settlements
     set status = 'PAID',
         method = v_method,
         payment_reference = v_reference,
         paid_at = now(),
         paid_by = auth.uid(),
         updated_at = now()
   where id::text = v_id
     and company_id = v_company_id;
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'OWNER_SETTLEMENT_UPDATE_COUNT_MISMATCH'
      using errcode = 'P0001';
  end if;

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'PAY', 'owner_settlements', v_id,
    'Owner settlement paid with balanced owner-payable/cash journal batch',
    'owner_settlements', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'settlement_id', v_id,
    'status', 'PAID',
    'net_payable', v_row.net_payable,
    'journal_batch_id', v_batch_id,
    'request_id', v_request_id
  );

  insert into public.financial_operation_idempotency (
    operation_name, request_id, response_payload
  ) values (
    v_operation_name,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_request_fingerprint,
      '_target_id', v_id,
      'response', v_result
    )
  )
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$;

create or replace function public.cancel_owner_settlement_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_id text := nullif(p_payload->>'settlement_id', '');
  v_reason text := nullif(btrim(p_payload->>'reason'), '');
  v_row public.owner_settlements%rowtype;
  v_cached jsonb;
  v_result jsonb;
  v_operation_name text;
  v_request_fingerprint text;
  v_cached_fingerprint text;
  v_cached_target_id text;
  v_updated_count integer;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to cancel owner settlements.'
      using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_company_id is null then
    raise exception 'Company context is required (no company_id claim in JWT).'
      using errcode = '42501';
  end if;
  if v_id is null or v_request_id is null or v_reason is null then
    raise exception 'settlement_id, request_id, and reason are required.'
      using errcode = '22023';
  end if;

  v_operation_name := 'cancel_owner_settlement_atomic:' || v_company_id::text;
  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'settlement_id', v_id,
    'reason', v_reason
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(
    hashtextextended(v_operation_name || ':' || v_request_id, 0)
  );

  select *
    into v_row
  from public.owner_settlements s
  where s.id::text = v_id
    and s.company_id = v_company_id
  for update;

  if not found then
    raise exception 'Owner settlement not found.'
      using errcode = 'P0002';
  end if;

  select response_payload
    into v_cached
  from public.financial_operation_idempotency
  where operation_name = v_operation_name
    and request_id = v_request_id
  for update;

  if v_cached is not null then
    v_cached_fingerprint := v_cached->>'_request_fingerprint';
    v_cached_target_id := v_cached->>'_target_id';
    if v_cached_fingerprint is null
       or v_cached_target_id is null
       or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED'
        using errcode = '22023';
    end if;
    if v_cached_fingerprint <> v_request_fingerprint
       or v_cached_target_id <> v_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        using errcode = '22023';
    end if;
    return (v_cached->'response') || jsonb_build_object('idempotent', true);
  end if;

  if v_row.status not in ('DRAFT', 'APPROVED') then
    raise exception 'Only DRAFT or APPROVED settlements can be cancelled; paid settlements require a controlled reversal.'
      using errcode = '22023';
  end if;

  update public.owner_settlements
     set status = 'CANCELLED',
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancellation_reason = v_reason,
         updated_at = now()
   where id::text = v_id
     and company_id = v_company_id;
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'OWNER_SETTLEMENT_UPDATE_COUNT_MISMATCH'
      using errcode = 'P0001';
  end if;

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'CANCEL', 'owner_settlements', v_id,
    'Owner settlement cancelled: ' || v_reason,
    'owner_settlements', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'settlement_id', v_id,
    'status', 'CANCELLED',
    'request_id', v_request_id
  );

  insert into public.financial_operation_idempotency (
    operation_name, request_id, response_payload
  ) values (
    v_operation_name,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_request_fingerprint,
      '_target_id', v_id,
      'response', v_result
    )
  )
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$;

comment on function public.create_owner_settlement_draft_atomic(jsonb) is
  'Phase 3A-1C: P1-derived settlement draft with company-scoped immutable request binding.';
comment on function public.approve_owner_settlement_atomic(jsonb) is
  'Phase 3A-1C: company-scoped approval with immutable request binding and exact row-count assertion.';
comment on function public.pay_owner_settlement_atomic(jsonb) is
  'Phase 3A-1C: company-canonical 2000/1111 payout with immutable request binding and atomic assertions.';
comment on function public.cancel_owner_settlement_atomic(jsonb) is
  'Phase 3A-1C: company-scoped cancellation with immutable request binding and exact row-count assertion.';

commit;
