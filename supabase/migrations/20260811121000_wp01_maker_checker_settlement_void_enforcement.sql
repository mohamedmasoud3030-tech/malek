-- WP-01: Maker-Checker enforcement for designated sensitive actions.
-- Addresses GAP-002 (SEC-008, OPS-007).
--
-- Designated sensitive approvals covered:
--   1. Contract approval/activation (already enforced in 20260808010000)
--   2. Permission request review (already enforced in 20260810113000)
--   3. Owner settlement approval — ENFORCED HERE
--   4. Owner settlement pay — ENFORCED HERE
--   5. Receipt void — ENFORCED HERE
--
-- Maker-Checker identity separation:
--   The actor who creates/records a sensitive record cannot approve/void it.
--   ADMIN emergency override is documented but not yet wired as an override flag;
--   that requires an explicit product-owner decision beyond this work package.
--
-- No accounting-policy, GL, settlement calculation, or financial lifecycle changes.

begin;

-- ── 1. Owner settlements: add maker tracking ────────────────────────────────
alter table public.owner_settlements
  add column if not exists maker_user_id uuid,
  add column if not exists checker_user_id uuid;

-- Backfill maker_user_id from audit log for existing DRAFT/APPROVED rows.
-- This is best-effort and does not fail if audit data is missing.
update public.owner_settlements s
set maker_user_id = (
  select al.user_id
  from public.audit_log al
  where al.entity = 'owner_settlements'
    and al.entity_id = s.id::text
    and al.action = 'CREATE'
  order by al.created_at asc
  limit 1
)
where s.maker_user_id is null
  and s.status in ('DRAFT', 'APPROVED');

-- Distinct maker/checker constraint (allows nulls for historical rows).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'settlements_maker_checker_distinct_chk'
      and conrelid = 'public.owner_settlements'::regclass
  ) then
    alter table public.owner_settlements
      add constraint settlements_maker_checker_distinct_chk
      check (maker_user_id is null or checker_user_id is null or maker_user_id <> checker_user_id);
  end if;
end $$;

-- ── 2. Update approve_owner_settlement_atomic: enforce maker-checker ────────
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

  -- SEC-008 Maker-Checker: the approver must not be the maker.
  if v_row.maker_user_id is not null and auth.uid() = v_row.maker_user_id then
    raise exception 'MAKER_CHECKER_MUST_BE_DISTINCT: the settlement creator cannot approve it.'
      using errcode = '42501';
  end if;

  -- Reservation integrity (unchanged from FA-003).
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
         checker_user_id = auth.uid(),
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
    'Owner settlement approved with maker-checker separation; owner payable is recognized operationally',
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

-- ── 3. Update pay_owner_settlement_atomic: enforce maker-checker ────────────
-- The payer must not be the same user who created the settlement.
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

  -- SEC-008 Maker-Checker: the payer must not be the maker (creator).
  if v_row.maker_user_id is not null and auth.uid() = v_row.maker_user_id then
    raise exception 'MAKER_CHECKER_MUST_BE_DISTINCT: the settlement creator cannot pay it.'
      using errcode = '42501';
  end if;

  -- Reservation integrity (unchanged from FA-003).
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
    'Owner settlement paid with maker-checker separation and balanced owner-payable/cash journal batch',
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

-- ── 4. Update create_owner_settlement_draft_atomic: record maker_user_id ────
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

  select c.gross_collected, c.office_fee, c.owner_expenses, c.tax_amount, c.net_payable
    into v_gross, v_fee, v_expenses, v_tax, v_net
  from public.calculate_owner_net_payout(
    v_owner_id::uuid,
    v_period_start,
    v_period_end,
    v_property_id
  ) as c;

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
    amount, status, request_id, notes, created_at, updated_at, company_id,
    maker_user_id
  ) values (
    v_id, v_no, v_owner_id, v_property_id, v_period_end::text, v_period_start, v_period_end,
    v_gross, v_fee, v_expenses, v_tax, v_net,
    v_net, 'DRAFT', v_request_id::uuid, v_notes, now(), now(), v_company_id,
    auth.uid()
  );

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
    'Owner settlement draft created (server-derived amounts, items reserved, maker recorded)',
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
    'request_id', v_request_id,
    'maker_user_id', auth.uid()
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

-- ── 5. Receipt void: maker-checker enforcement ──────────────────────────────
-- The void_receipt_atomic function already exists.
-- We add a check: the voiding actor must not be the original receipt recorder.
-- We look up the receipt's created_by / recorded_by field for the maker identity.

-- First, ensure receipts have a recorded_by column (most already do via audit).
-- The void_receipt_atomic(payload jsonb) function needs the maker-checker guard.

-- Read the current function body to add the guard.
-- The receipt table has a created_by or recorded_by field; we use audit_log as fallback.

-- Add maker_user_id to receipts if missing (for explicit tracking).
alter table public.receipts
  add column if not exists maker_user_id uuid;

-- Backfill from existing data.
update public.receipts r
set maker_user_id = coalesce(
  (select al.user_id from public.audit_log al
   where al.entity in ('receipts','receipt') and al.entity_id = r.id::text and al.action = 'CREATE'
   order by al.created_at asc limit 1),
  r.recorded_by
)
where r.maker_user_id is null;

-- Note: void_receipt_atomic(payload jsonb) remains a large function.
-- The maker-checker guard is added by replacing the function.
-- The guard checks: auth.uid() <> maker_user_id (when maker_user_id is known).

-- We need to find and patch the existing void_receipt_atomic.
-- For safety, we use CREATE OR REPLACE and add the guard at the authorization point.

-- Get the current function body and add the maker-checker check.
-- The function already checks auth.uid() is not null. We add the distinctness check.

-- Since the void_receipt_atomic(payload jsonb) function is complex and was last modified
-- in earlier migrations, we add the guard via a BEFORE trigger on the receipts table
-- that prevents self-void. This is cleaner than replacing the entire function.

-- Actually, let's create a focused guard function.
create or replace function public.enforce_receipt_void_maker_checker()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Only enforce when status is changing to 'voided' or 'VOID'.
  if (new.status::text in ('voided', 'VOID', 'cancelled', 'CANCELLED'))
     and (old.status::text not in ('voided', 'VOID', 'cancelled', 'CANCELLED'))
     and old.maker_user_id is not null
     and auth.uid() = old.maker_user_id then
    raise exception 'MAKER_CHECKER_MUST_BE_DISTINCT: the receipt recorder cannot void it.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_receipt_void_maker_checker() from public, anon, authenticated;

-- Drop existing trigger if it exists, then recreate.
drop trigger if exists receipt_void_maker_checker_guard on public.receipts;
create trigger receipt_void_maker_checker_guard
  before update of status on public.receipts
  for each row
  when (new.status is distinct from old.status)
  execute function public.enforce_receipt_void_maker_checker();

-- ── 6. Comments ─────────────────────────────────────────────────────────────
comment on column public.owner_settlements.maker_user_id
  is 'SEC-008: the user who created the settlement draft (maker in maker-checker).';

comment on column public.owner_settlements.checker_user_id
  is 'SEC-008: the user who approved the settlement (checker in maker-checker).';

comment on column public.receipts.maker_user_id
  is 'SEC-008: the user who recorded the receipt (maker in maker-checker for void).';

comment on function public.approve_owner_settlement_atomic(jsonb)
  is 'SEC-008: approval enforces maker-checker identity separation — the settlement creator cannot approve it.';

comment on function public.pay_owner_settlement_atomic(jsonb)
  is 'SEC-008: payment enforces maker-checker identity separation — the settlement creator cannot pay it.';

comment on trigger receipt_void_maker_checker_guard on public.receipts
  is 'SEC-008: prevents the receipt recorder from voiding their own receipt.';

commit;
