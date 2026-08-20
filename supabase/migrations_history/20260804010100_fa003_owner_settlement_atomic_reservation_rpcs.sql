-- =============================================================================
-- FA-003 — atomic owner-settlement input reservation (RPC lifecycle changes)
-- =============================================================================
-- Modifies the four official settlement RPCs so item membership is derived and
-- reserved atomically. It does NOT change any amount, account, fee, commission,
-- net-payable formula, revenue timing, or accounting entry.
--
--   create  -> reserves every derived payment/expense; rejects with
--              SETTLEMENT_INPUT_ALREADY_RESERVED if any item is already active.
--   approve -> requires the settlement to be fully reserved by its derived
--              items (no released links, no missing items).
--   pay     -> same reservation guard; never creates new links; PAID keeps
--              links permanently unreleased.
--   cancel  -> releases the settlement's links (released_at/by + reason),
--              idempotently, only for DRAFT/APPROVED.
--
-- Backward note: these CREATE OR REPLACE bodies start from the current main
-- (20260729091000 / 20260729090000) definitions and only ADD the reservation
-- logic. All pre-existing role/company/idempotency/lock/amount semantics are
-- preserved byte-for-byte where the reservation logic is not inserted.
-- =============================================================================

begin;

-- ── create ───────────────────────────────────────────────────────────────────
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
  -- FA-003: item sets derived for reservation (payment_id / expense_id units).
  v_payment_ids uuid[];
  v_expense_ids uuid[];
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

  -- P1: derive every amount from canonical sources (unchanged).
  select c.gross_collected, c.office_fee, c.owner_expenses, c.tax_amount, c.net_payable
    into v_gross, v_fee, v_expenses, v_tax, v_net
  from public.calculate_owner_net_payout(
    v_owner_id::uuid,
    v_period_start,
    v_period_end,
    v_property_id
  ) as c;

  -- ── FA-003: derive the exact item sets and validate they are free. ─────────
  v_payment_ids := array(
    select public.owner_settlement_reservable_payments(
      v_company_id, v_owner_id::uuid, v_period_start, v_period_end, v_property_id
    )
  );
  v_expense_ids := array(
    select public.owner_settlement_reservable_expenses(
      v_company_id, v_owner_id::uuid, v_period_start, v_period_end, v_property_id
    )
  );

  -- Reject up-front with a clear error when any target item is already actively
  -- reserved (overlapping period or an earlier non-cancelled settlement).
  if exists (
    select 1
      from public.owner_settlement_payment_links l
     where l.company_id = v_company_id
       and l.released_at is null
       and l.payment_id = any(v_payment_ids)
  ) then
    raise exception 'SETTLEMENT_INPUT_ALREADY_RESERVED: one or more payments in this period are already reserved by another active settlement in your company. Cancel that settlement first to reuse them.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
      from public.owner_settlement_expense_links l
     where l.company_id = v_company_id
       and l.released_at is null
       and l.expense_id = any(v_expense_ids)
  ) then
    raise exception 'SETTLEMENT_INPUT_ALREADY_RESERVED: one or more expenses in this period are already reserved by another active settlement in your company. Cancel that settlement first to reuse them.'
      using errcode = '23505';
  end if;

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

  -- ── FA-003: persist the reservations in the SAME transaction. The partial
  -- unique index is the authoritative concurrency gate: if a truly concurrent
  -- overlapping settlement already reserved any of these items, this insert
  -- violates the unique index and the whole RPC (including the settlement row
  -- just inserted) is rolled back. No partial settlement, no orphan links.
  begin
    insert into public.owner_settlement_payment_links (
      id, company_id, settlement_id, payment_id,
      reserved_at, reserved_by, created_at, updated_at
    )
    select gen_random_uuid(), v_company_id, v_id, t.payment_id,
           now(), auth.uid(), now(), now()
      from unnest(v_payment_ids) as t(payment_id);

    insert into public.owner_settlement_expense_links (
      id, company_id, settlement_id, expense_id,
      reserved_at, reserved_by, created_at, updated_at
    )
    select gen_random_uuid(), v_company_id, v_id, t.expense_id,
           now(), auth.uid(), now(), now()
      from unnest(v_expense_ids) as t(expense_id);
  exception when unique_violation then
    raise exception 'SETTLEMENT_INPUT_ALREADY_RESERVED: a concurrent or earlier settlement already reserved an item in this period.'
      using errcode = '23505';
  end;

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'CREATE', 'owner_settlements', v_id,
    'Owner settlement draft created (server-derived amounts, items reserved)',
    'owner_settlements', left(p_payload::text, 4000), now()
  );

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'RESERVE', 'owner_settlement_payment_links', v_id,
    'Reserved ' || coalesce(array_length(v_payment_ids, 1), 0) || ' payment(s) and '
      || coalesce(array_length(v_expense_ids, 1), 0) || ' expense(s)',
    'owner_settlement_payment_links', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'settlement_id', v_id,
    'settlement_no', v_no,
    'status', 'DRAFT',
    'net_payable', v_net,
    'amounts_source', 'server_derived',
    'reserved_payments', coalesce(array_length(v_payment_ids, 1), 0),
    'reserved_expenses', coalesce(array_length(v_expense_ids, 1), 0),
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

-- ── approve ──────────────────────────────────────────────────────────────────
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

  -- ── FA-003: the settlement must be fully reserved by its derived items and
  -- must own no released link. We never re-select items from the date range.
  if exists (
    select 1
      from public.owner_settlement_reservable_payments(
        v_company_id, v_row.owner_id::uuid, v_row.period_start, v_row.period_end, v_row.property_id::text) p
      left join public.owner_settlement_payment_links l
        on l.payment_id = p and l.settlement_id = v_row.id::text
       and l.company_id = v_company_id and l.released_at is null
     where l.id is null
  ) or exists (
    select 1
      from public.owner_settlement_reservable_expenses(
        v_company_id, v_row.owner_id::uuid, v_row.period_start, v_row.period_end, v_row.property_id::text) e
      left join public.owner_settlement_expense_links l
        on l.expense_id = e and l.settlement_id = v_row.id::text
       and l.company_id = v_company_id and l.released_at is null
     where l.id is null
  ) then
    raise exception 'OWNER_SETTLEMENT_INCOMPLETE_RESERVATION: settlement is not fully reserved by its derived items.'
      using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.owner_settlement_payment_links l
     where l.settlement_id = v_row.id::text and l.company_id = v_company_id and l.released_at is not null
  ) or exists (
    select 1 from public.owner_settlement_expense_links l
     where l.settlement_id = v_row.id::text and l.company_id = v_company_id and l.released_at is not null
  ) then
    raise exception 'OWNER_SETTLEMENT_HAS_RELEASED_LINKS: released items cannot be approved.'
      using errcode = 'P0001';
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

-- ── pay ──────────────────────────────────────────────────────────────────────
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

  -- ── FA-003: the paid settlement must own exactly its fully-reserved items and
  -- no released link. No new links are created here; the reserved set is the
  -- final set. PAID links stay released_at = NULL forever.
  if exists (
    select 1
      from public.owner_settlement_reservable_payments(
        v_company_id, v_row.owner_id::uuid, v_row.period_start, v_row.period_end, v_row.property_id::text) p
      left join public.owner_settlement_payment_links l
        on l.payment_id = p and l.settlement_id = v_row.id::text
       and l.company_id = v_company_id and l.released_at is null
     where l.id is null
  ) or exists (
    select 1
      from public.owner_settlement_reservable_expenses(
        v_company_id, v_row.owner_id::uuid, v_row.period_start, v_row.period_end, v_row.property_id::text) e
      left join public.owner_settlement_expense_links l
        on l.expense_id = e and l.settlement_id = v_row.id::text
       and l.company_id = v_company_id and l.released_at is null
     where l.id is null
  ) then
    raise exception 'OWNER_SETTLEMENT_INCOMPLETE_RESERVATION: settlement is not fully reserved by its derived items.'
      using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.owner_settlement_payment_links l
     where l.settlement_id = v_row.id::text and l.company_id = v_company_id and l.released_at is not null
  ) or exists (
    select 1 from public.owner_settlement_expense_links l
     where l.settlement_id = v_row.id::text and l.company_id = v_company_id and l.released_at is not null
  ) then
    raise exception 'OWNER_SETTLEMENT_HAS_RELEASED_LINKS: released items cannot be paid.'
      using errcode = 'P0001';
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

-- ── cancel ───────────────────────────────────────────────────────────────────
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
  v_released_payments integer := 0;
  v_released_expenses integer := 0;
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

  -- ── FA-003: release this settlement's reservations so its items may be used
  -- by a replacement settlement. Links are NEVER deleted; PAID links are never
  -- touched because cancel disallows PAID above.
  update public.owner_settlement_payment_links
     set released_at = now(),
         released_by = auth.uid(),
         release_reason = 'SETTLEMENT_CANCELLED',
         updated_at = now()
   where settlement_id = v_row.id::text
     and company_id = v_company_id
     and released_at is null;
  get diagnostics v_released_payments = row_count;

  update public.owner_settlement_expense_links
     set released_at = now(),
         released_by = auth.uid(),
         release_reason = 'SETTLEMENT_CANCELLED',
         updated_at = now()
   where settlement_id = v_row.id::text
     and company_id = v_company_id
     and released_at is null;
  get diagnostics v_released_expenses = row_count;

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'CANCEL', 'owner_settlements', v_id,
    'Owner settlement cancelled: ' || v_reason,
    'owner_settlements', left(p_payload::text, 4000), now()
  );

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'RELEASE', 'owner_settlement_payment_links', v_id,
    'Released ' || v_released_payments || ' payment link(s) and ' || v_released_expenses || ' expense link(s) on cancellation',
    'owner_settlement_payment_links', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'settlement_id', v_id,
    'status', 'CANCELLED',
    'released_payments', v_released_payments,
    'released_expenses', v_released_expenses,
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
  'FA-003: atomically reserves every derived payment/expense for a settlement; rejects SETTLEMENT_INPUT_ALREADY_RESERVED on any active conflict. Amounts remain server-derived (P1).';
comment on function public.approve_owner_settlement_atomic(jsonb) is
  'FA-003: approval requires the settlement to be fully reserved by its derived items with no released link.';
comment on function public.pay_owner_settlement_atomic(jsonb) is
  'FA-003: payment requires full reservation, creates no new links, and leaves PAID links permanently unreleased.';
comment on function public.cancel_owner_settlement_atomic(jsonb) is
  'FA-003: cancellation releases the settlement reservations (released_at/by + SETTLEMENT_CANCELLED) so items may be reused; links are never deleted.';

commit;
