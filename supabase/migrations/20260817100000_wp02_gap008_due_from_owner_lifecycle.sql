-- WP-02 / GAP-008: Due-from-Owner (1300) lifecycle — owner expense → receivable,
-- cash recovery, and lawful settlement offset. Canonical rules: FIN-008, OPS-012.
--
-- Invariants enforced:
--   * Owner obligations are booked to 1300 Due from Owners, never 6100 Company
--     Operating Expense (reuse gl_pm_post_owner_expense: Dr 1300 / Cr Cash-Bank).
--   * Every economic event posts through the canonical engine post_journal_event()
--     and is idempotent by (company_id, request_id); corrections are compensating
--     reversals via reverse_journal_batch(), never destructive edits.
--   * Lawful offset Dr 2000 Owner Funds Payable / Cr 1300 Due from Owners is
--     permitted ONLY when (a) the receivable carries an enforceable contractual/
--     legal offset right (owner_agreement_versions.offset_allowed) captured at
--     creation, and (b) a specific APPROVED owner settlement still owes the owner
--     at least the offset amount. 2000 is never forced negative.
--   * If money must be recovered after an owner payable has already been paid
--     (settlement PAID / no APPROVED balance), the offset is refused and the
--     caller must use a cash recovery that retains/creates a 1300 receivable.
--   * 1300 GL (debit - credit) is kept exactly equal to the due_from_owners
--     outstanding subledger; gl_reconcile_subledgers is superseded to compute it.

begin;

-- Local, immutable OMR authority helper.  GAP-008 must not depend on the
-- optional/isolated S04 helper in replay harnesses; every persisted amount is
-- rounded server-side to the canonical three decimals.
create or replace function public.wp02_gap008_round_omr(p_amount numeric)
returns numeric
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$ select round(p_amount, 3) $$;

revoke all on function public.wp02_gap008_round_omr(numeric) from public, anon, authenticated;
grant execute on function public.wp02_gap008_round_omr(numeric) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Operational Due-from-Owner subledger (asset 1300)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.due_from_owners (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  owner_id uuid not null references public.owners(id) on delete restrict,
  owner_agreement_id uuid references public.owner_agreements(id) on delete restrict,
  property_id text,
  source_type text not null check (source_type in ('OWNER_EXPENSE','RECOVERY','OFFSET','ADJUSTMENT')),
  source_id text,
  amount numeric(18,3) not null check (amount > 0),
  recovered_amount numeric(18,3) not null default 0,
  offset_amount numeric(18,3) not null default 0,
  waived_amount numeric(18,3) not null default 0,
  outstanding numeric(18,3) not null,
  lawful_offset_right boolean not null default false,
  status text not null default 'OPEN' check (status in ('OPEN','PARTIALLY_RECOVERED','RECOVERED','OFFSET','CLOSED','REVERSED')),
  request_id text not null,
  source_fingerprint text not null,
  created_by uuid not null,
  journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  reversed_request_id text,
  reversal_journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint due_from_owners_request_uq unique (company_id, request_id),
  constraint due_from_owners_outstanding_chk
    check (outstanding = public.wp02_gap008_round_omr(amount - recovered_amount - offset_amount - waived_amount)
           and outstanding >= 0),
  constraint due_from_owners_components_nn_chk
    check (recovered_amount >= 0 and offset_amount >= 0 and waived_amount >= 0),
  constraint due_from_owners_reversed_shape_chk
    check (status <> 'REVERSED'
           or (reversed_request_id is not null and reversal_journal_batch_id is not null))
);

create index if not exists due_from_owners_company_owner_idx
  on public.due_from_owners (company_id, owner_id, created_at desc);
create index if not exists due_from_owners_company_outstanding_idx
  on public.due_from_owners (company_id, status, outstanding)
  where status not in ('REVERSED','CLOSED','RECOVERED');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Append-only cash-recovery events (Dr Cash/Bank / Cr 1300)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.due_from_owner_recoveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  due_from_owner_id uuid not null references public.due_from_owners(id) on delete restrict,
  owner_id uuid not null references public.owners(id) on delete restrict,
  amount numeric(18,3) not null check (amount > 0),
  cash_account_no text not null check (cash_account_no in ('1111','1120')),
  effective_date date not null,
  request_id text not null,
  source_fingerprint text not null,
  journal_batch_id uuid not null references public.journal_batches(id) on delete restrict,
  status text not null default 'POSTED' check (status in ('POSTED','REVERSED')),
  posted_by uuid not null,
  reversed_request_id text,
  reversal_journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint due_from_owner_recoveries_request_uq unique (company_id, request_id),
  constraint due_from_owner_recoveries_reversal_shape_chk
    check (status <> 'REVERSED'
           or (reversed_request_id is not null and reversal_journal_batch_id is not null))
);

create index if not exists due_from_owner_recoveries_dfo_idx
  on public.due_from_owner_recoveries (company_id, due_from_owner_id, created_at desc);
create index if not exists due_from_owner_recoveries_owner_idx
  on public.due_from_owner_recoveries (owner_id, company_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Append-only lawful-offset events (Dr 2000 / Cr 1300)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.due_from_owner_offsets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  due_from_owner_id uuid not null references public.due_from_owners(id) on delete restrict,
  owner_id uuid not null references public.owners(id) on delete restrict,
  owner_settlement_id text not null references public.owner_settlements(id) on delete restrict,
  amount numeric(18,3) not null check (amount > 0),
  effective_date date not null,
  request_id text not null,
  source_fingerprint text not null,
  journal_batch_id uuid not null references public.journal_batches(id) on delete restrict,
  lawful_offset_evidence text not null check (length(btrim(lawful_offset_evidence)) between 3 and 2000),
  status text not null default 'POSTED' check (status in ('POSTED','REVERSED')),
  posted_by uuid not null,
  reversed_request_id text,
  reversal_journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint due_from_owner_offsets_request_uq unique (company_id, request_id),
  constraint due_from_owner_offsets_reversal_shape_chk
    check (status <> 'REVERSED'
           or (reversed_request_id is not null and reversal_journal_batch_id is not null))
);

create index if not exists due_from_owner_offsets_dfo_idx
  on public.due_from_owner_offsets (company_id, due_from_owner_id, created_at desc);
create index if not exists due_from_owner_offsets_owner_idx
  on public.due_from_owner_offsets (owner_id, company_id, created_at desc);
create index if not exists due_from_owner_offsets_settlement_idx
  on public.due_from_owner_offsets (company_id, owner_settlement_id);

-- Track lawful offsets applied against an owner settlement WITHOUT mutating the
-- server-derived net_payable (immutable per p1_owner_settlements_amounts_immutable,
-- which guards even definer-context writes). Effective payable = net_payable - offset_applied.
alter table public.owner_settlements
  add column if not exists offset_applied numeric(18,3) not null default 0
  check (offset_applied >= 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS: company-scoped reads; direct authenticated writes denied; RPCs only
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.due_from_owners enable row level security;
alter table public.due_from_owner_recoveries enable row level security;
alter table public.due_from_owner_offsets enable row level security;

drop policy if exists due_from_owners_company_read on public.due_from_owners;
create policy due_from_owners_company_read on public.due_from_owners
  for select to authenticated
  using (company_id = public.current_company_id()
         and (public.is_admin_or_manager() or public.is_accountant()));

drop policy if exists due_from_owner_recoveries_company_read on public.due_from_owner_recoveries;
create policy due_from_owner_recoveries_company_read on public.due_from_owner_recoveries
  for select to authenticated
  using (company_id = public.current_company_id()
         and (public.is_admin_or_manager() or public.is_accountant()));

drop policy if exists due_from_owner_offsets_company_read on public.due_from_owner_offsets;
create policy due_from_owner_offsets_company_read on public.due_from_owner_offsets
  for select to authenticated
  using (company_id = public.current_company_id()
         and (public.is_admin_or_manager() or public.is_accountant()));

revoke all on table public.due_from_owners from public, anon, authenticated;
revoke all on table public.due_from_owner_recoveries from public, anon, authenticated;
revoke all on table public.due_from_owner_offsets from public, anon, authenticated;
grant select on table public.due_from_owners to authenticated;
grant select on table public.due_from_owner_recoveries to authenticated;
grant select on table public.due_from_owner_offsets to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: create owner receivable (owner expense → 1300 + subledger)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_owner_receivable_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_owner_id uuid := nullif(p_payload->>'owner_id','')::uuid;
  v_agreement_id uuid := nullif(p_payload->>'owner_agreement_id','')::uuid;
  v_agreement_version_id uuid;
  v_property_id text := nullif(btrim(coalesce(p_payload->>'property_id','')), '');
  v_amount numeric := public.wp02_gap008_round_omr(nullif(p_payload->>'amount','')::numeric);
  v_cash_no text := coalesce(nullif(p_payload->>'cash_account_no',''), '1120');
  v_date date := nullif(p_payload->>'effective_date','')::date;
  v_source_id text := nullif(btrim(coalesce(p_payload->>'source_id','')), '');
  v_offset_right boolean := false;
  v_expense_id uuid := gen_random_uuid();
  v_dfo_id uuid := gen_random_uuid();
  v_fp text;
  v_cached jsonb;
  v_post jsonb;
  v_batch_id uuid;
  v_owner_company uuid;
  v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'DUE_FROM_OWNER_ROLE_REQUIRED' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if not public.is_company_member(v_company_id, v_actor) then
    raise exception 'DUE_FROM_OWNER_COMPANY_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;
  if p_payload ?| array['company_id','owner_agreement','offset_allowed','cash_account','target_account'] then
    raise exception 'DUE_FROM_OWNER_SERVER_OWNED_FIELDS_FORBIDDEN' using errcode = '22023';
  end if;
  if v_request_id is null or v_owner_id is null or v_amount is null or v_amount <= 0 or v_date is null then
    raise exception 'DUE_FROM_OWNER_REQUEST_OWNER_AMOUNT_DATE_REQUIRED' using errcode = '22023';
  end if;
  if v_cash_no not in ('1111','1120') then
    raise exception 'DUE_FROM_OWNER_CASH_ACCOUNT_INVALID' using errcode = '22023';
  end if;

  select o.company_id into v_owner_company
    from public.owners o where o.id = v_owner_id and o.deleted_at is null;
  if v_owner_company is null or v_owner_company <> v_company_id then
    raise exception 'DUE_FROM_OWNER_OWNER_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  if v_agreement_id is not null then
    -- The browser names an agreement; the server resolves the authoritative
    -- effective version at the economic date and snapshots its offset authority.
    select av.id, coalesce(av.offset_allowed, false)
      into v_agreement_version_id, v_offset_right
      from public.owner_agreement_versions av
      join public.owner_agreements oa on oa.id = av.owner_agreement_id and oa.company_id = v_company_id
     where av.owner_agreement_id = v_agreement_id
       and av.company_id = v_company_id
       and av.effective_from <= v_date
       and (av.effective_to is null or av.effective_to >= v_date)
     order by av.effective_from desc, av.version_no desc
     limit 1;
    if not found then
      raise exception 'DUE_FROM_OWNER_AGREEMENT_VERSION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  v_fp := encode(sha256(convert_to(jsonb_build_object(
    'owner_id', v_owner_id, 'owner_agreement_id', v_agreement_id, 'property_id', v_property_id,
    'amount', v_amount, 'cash_account_no', v_cash_no, 'effective_date', v_date, 'source_id', v_source_id
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended('due_from_owner_create:' || v_company_id::text || ':' || v_request_id, 0));

  select response_payload into v_cached
    from public.financial_operation_idempotency
   where operation_name = 'create_owner_receivable_atomic:' || v_company_id::text
     and request_id = v_request_id
   for update;
  if v_cached is not null then
    if v_cached->>'_request_fingerprint' is distinct from v_fp or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode = '22023';
    end if;
    return v_cached->'response';
  end if;

  -- Book the owner obligation to 1300 (never 6100) — reuse the canonical kernel.
  v_post := public.gl_pm_post_owner_expense(jsonb_build_object(
    'company_id', v_company_id,
    'expense_id', v_expense_id,
    'amount', v_amount,
    'cash_account_no', v_cash_no,
    'effective_date', v_date
  ));
  v_batch_id := (v_post->'batch'->>'batch_id')::uuid;

  insert into public.due_from_owners (
    id, company_id, owner_id, owner_agreement_id, property_id, source_type, source_id,
    amount, outstanding, lawful_offset_right, request_id, source_fingerprint, created_by, journal_batch_id
  ) values (
    v_dfo_id, v_company_id, v_owner_id, v_agreement_id, v_property_id, 'OWNER_EXPENSE', v_source_id,
    v_amount, v_amount, v_offset_right, v_request_id, v_fp, v_actor, v_batch_id
  );

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false, 'due_from_owner_id', v_dfo_id, 'owner_id', v_owner_id,
    'amount', v_amount, 'outstanding', v_amount, 'lawful_offset_right', v_offset_right,
    'journal_batch_id', v_batch_id, 'status', 'OPEN', 'request_id', v_request_id
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('create_owner_receivable_atomic:' || v_company_id::text, v_request_id,
          jsonb_build_object('_request_fingerprint', v_fp, 'response', v_result));

  return v_result;
end;
$fn$;

alter function public.create_owner_receivable_atomic(jsonb) owner to postgres;
revoke all on function public.create_owner_receivable_atomic(jsonb) from public, anon;
grant execute on function public.create_owner_receivable_atomic(jsonb) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC: cash recovery (Dr Cash/Bank / Cr 1300)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.recover_owner_receivable_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_dfo_id uuid := nullif(p_payload->>'due_from_owner_id','')::uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_amount numeric := public.wp02_gap008_round_omr(nullif(p_payload->>'amount','')::numeric);
  v_cash_no text := coalesce(nullif(p_payload->>'cash_account_no',''), '1120');
  v_date date := nullif(p_payload->>'effective_date','')::date;
  v_dfo public.due_from_owners%rowtype;
  v_cash_id text; v_due_id text; v_post jsonb; v_batch_id uuid;
  v_fp text; v_cached jsonb; v_id uuid := gen_random_uuid(); v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'DUE_FROM_OWNER_RECOVERY_ROLE_REQUIRED' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if p_payload ?| array['company_id','amount_override','target_account'] then
    raise exception 'DUE_FROM_OWNER_RECOVERY_SERVER_OWNED_FIELDS_FORBIDDEN' using errcode = '22023';
  end if;
  if v_dfo_id is null or v_request_id is null or v_amount is null or v_amount <= 0 or v_date is null then
    raise exception 'DUE_FROM_OWNER_RECOVERY_REQUEST_AMOUNT_DATE_REQUIRED' using errcode = '22023';
  end if;
  if v_cash_no not in ('1111','1120') then
    raise exception 'DUE_FROM_OWNER_RECOVERY_CASH_ACCOUNT_INVALID' using errcode = '22023';
  end if;

  v_fp := encode(sha256(convert_to(jsonb_build_object('due_from_owner_id', v_dfo_id, 'amount', v_amount, 'cash_account_no', v_cash_no, 'effective_date', v_date)::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended('due_from_owner_recover:' || v_company_id::text || ':' || v_request_id, 0));

  select response_payload into v_cached
    from public.financial_operation_idempotency
   where operation_name = 'recover_owner_receivable_atomic:' || v_company_id::text
     and request_id = v_request_id for update;
  if v_cached is not null then
    if v_cached->>'_request_fingerprint' is distinct from v_fp or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode = '22023';
    end if;
    return v_cached->'response';
  end if;

  select * into v_dfo from public.due_from_owners
   where id = v_dfo_id and company_id = v_company_id for update;
  if not found then
    raise exception 'DUE_FROM_OWNER_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;
  if v_dfo.status = 'REVERSED' then
    raise exception 'DUE_FROM_OWNER_RECOVERY_REVERSED' using errcode = '22023';
  end if;
  if v_amount > v_dfo.outstanding + 0.001 then
    raise exception 'DUE_FROM_OWNER_RECOVERY_EXCEEDS_OUTSTANDING' using errcode = '22023';
  end if;

  v_cash_id := public.gl_pm_require_account(v_company_id, v_cash_no);
  v_due_id := public.gl_pm_require_account(v_company_id, '1300');
  v_post := public.post_journal_event(jsonb_build_object(
    'company_id', v_company_id, 'source_type', 'pm_due_from_owner_recovery', 'source_id', v_dfo_id::text,
    'event_id', 'recover', 'effective_date', v_date,
    'description', 'Cash recovery of Due from Owner',
    'lines', jsonb_build_array(
      jsonb_build_object('account_id', v_cash_id, 'debit', v_amount, 'credit', 0,
        'ref_source_id', v_dfo_id::text, 'ref_entity_type', 'due_from_owner', 'ref_entity_id', v_dfo_id::text),
      jsonb_build_object('account_id', v_due_id, 'debit', 0, 'credit', v_amount,
        'ref_source_id', v_dfo_id::text, 'ref_entity_type', 'due_from_owner', 'ref_entity_id', v_dfo_id::text)
    )
  ));
  v_batch_id := (v_post->>'batch_id')::uuid;

  insert into public.due_from_owner_recoveries (
    id, company_id, due_from_owner_id, owner_id, amount, cash_account_no, effective_date,
    request_id, source_fingerprint, journal_batch_id, posted_by
  ) values (
    v_id, v_company_id, v_dfo_id, v_dfo.owner_id, v_amount, v_cash_no, v_date,
    v_request_id, v_fp, v_batch_id, v_actor
  );

  update public.due_from_owners
     set recovered_amount = public.wp02_gap008_round_omr(recovered_amount + v_amount),
         outstanding = public.wp02_gap008_round_omr(outstanding - v_amount),
         status = case
           when public.wp02_gap008_round_omr(outstanding - v_amount) = 0 then 'RECOVERED'
           when recovered_amount > 0 then 'PARTIALLY_RECOVERED'
           else 'OPEN' end,
         updated_at = now()
   where id = v_dfo_id;

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false, 'due_from_owner_id', v_dfo_id, 'amount', v_amount,
    'outstanding', public.wp02_gap008_round_omr(v_dfo.outstanding - v_amount), 'journal_batch_id', v_batch_id,
    'status', case when public.wp02_gap008_round_omr(v_dfo.outstanding - v_amount) = 0 then 'RECOVERED' else 'PARTIALLY_RECOVERED' end,
    'request_id', v_request_id
  );
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('recover_owner_receivable_atomic:' || v_company_id::text, v_request_id,
          jsonb_build_object('_request_fingerprint', v_fp, 'response', v_result));
  return v_result;
end;
$fn$;

alter function public.recover_owner_receivable_atomic(jsonb) owner to postgres;
revoke all on function public.recover_owner_receivable_atomic(jsonb) from public, anon;
grant execute on function public.recover_owner_receivable_atomic(jsonb) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RPC: lawful settlement offset (Dr 2000 / Cr 1300) — never forces 2000 negative
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.offset_owner_receivable_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_dfo_id uuid := nullif(p_payload->>'due_from_owner_id','')::uuid;
  v_settlement_id text := nullif(btrim(coalesce(p_payload->>'owner_settlement_id','')), '');
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_amount numeric := public.wp02_gap008_round_omr(nullif(p_payload->>'amount','')::numeric);
  v_date date := nullif(p_payload->>'effective_date','')::date;
  v_evidence text := nullif(btrim(coalesce(p_payload->>'lawful_offset_evidence','')), '');
  v_dfo public.due_from_owners%rowtype;
  v_settlement public.owner_settlements%rowtype;
  v_ofp_id text; v_due_id text; v_post jsonb; v_batch_id uuid;
  v_fp text; v_cached jsonb; v_id uuid := gen_random_uuid(); v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'DUE_FROM_OWNER_OFFSET_ROLE_REQUIRED' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if p_payload ?| array['company_id','amount_override','target_account'] then
    raise exception 'DUE_FROM_OWNER_OFFSET_SERVER_OWNED_FIELDS_FORBIDDEN' using errcode = '22023';
  end if;
  if v_dfo_id is null or v_settlement_id is null or v_request_id is null
     or v_amount is null or v_amount <= 0 or v_date is null or v_evidence is null or length(v_evidence) < 3 then
    raise exception 'DUE_FROM_OWNER_OFFSET_REQUEST_AMOUNT_DATE_EVIDENCE_REQUIRED' using errcode = '22023';
  end if;

  v_fp := encode(sha256(convert_to(jsonb_build_object('due_from_owner_id', v_dfo_id, 'owner_settlement_id', v_settlement_id, 'amount', v_amount, 'effective_date', v_date)::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended('due_from_owner_offset:' || v_company_id::text || ':' || v_request_id, 0));

  select response_payload into v_cached
    from public.financial_operation_idempotency
   where operation_name = 'offset_owner_receivable_atomic:' || v_company_id::text
     and request_id = v_request_id for update;
  if v_cached is not null then
    if v_cached->>'_request_fingerprint' is distinct from v_fp or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode = '22023';
    end if;
    return v_cached->'response';
  end if;

  select * into v_dfo from public.due_from_owners
   where id = v_dfo_id and company_id = v_company_id for update;
  if not found then
    raise exception 'DUE_FROM_OWNER_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;
  if v_dfo.status = 'REVERSED' then
    raise exception 'DUE_FROM_OWNER_OFFSET_REVERSED' using errcode = '22023';
  end if;
  if not v_dfo.lawful_offset_right then
    raise exception 'DUE_FROM_OWNER_OFFSET_RIGHT_MISSING: no enforceable contractual/legal offset right on this receivable.' using errcode = '23514';
  end if;
  if v_amount > v_dfo.outstanding + 0.001 then
    raise exception 'DUE_FROM_OWNER_OFFSET_EXCEEDS_OUTSTANDING' using errcode = '22023';
  end if;

  select * into v_settlement from public.owner_settlements
   where id = v_settlement_id and company_id = v_company_id for update;
  if not found then
    raise exception 'DUE_FROM_OWNER_OFFSET_SETTLEMENT_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;
  if v_settlement.owner_id::uuid is distinct from v_dfo.owner_id then
    raise exception 'DUE_FROM_OWNER_OFFSET_OWNER_MISMATCH' using errcode = '42501';
  end if;
  if v_settlement.status <> 'APPROVED' then
    raise exception 'DUE_FROM_OWNER_OFFSET_SETTLEMENT_NOT_APPROVED: offset is only permitted against an APPROVED (unpaid) owner payable.' using errcode = '22023';
  end if;
  if v_amount > public.wp02_gap008_round_omr(v_settlement.net_payable - v_settlement.offset_applied) + 0.001 then
    raise exception 'DUE_FROM_OWNER_OFFSET_EXCEEDS_PAYABLE: would force Owner Funds Payable negative.' using errcode = '22023';
  end if;

  v_ofp_id := public.gl_pm_require_account(v_company_id, '2000');
  v_due_id := public.gl_pm_require_account(v_company_id, '1300');
  v_post := public.post_journal_event(jsonb_build_object(
    'company_id', v_company_id, 'source_type', 'pm_due_from_owner_offset', 'source_id', v_dfo_id::text,
    'event_id', 'offset', 'effective_date', v_date,
    'description', 'Lawful settlement offset: Owner Funds Payable against Due from Owner',
    'lines', jsonb_build_array(
      jsonb_build_object('account_id', v_ofp_id, 'debit', v_amount, 'credit', 0,
        'ref_source_id', v_dfo_id::text, 'ref_entity_type', 'due_from_owner', 'ref_entity_id', v_dfo_id::text),
      jsonb_build_object('account_id', v_due_id, 'debit', 0, 'credit', v_amount,
        'ref_source_id', v_dfo_id::text, 'ref_entity_type', 'due_from_owner', 'ref_entity_id', v_dfo_id::text)
    )
  ));
  v_batch_id := (v_post->>'batch_id')::uuid;

  insert into public.due_from_owner_offsets (
    id, company_id, due_from_owner_id, owner_id, owner_settlement_id, amount, effective_date,
    request_id, source_fingerprint, journal_batch_id, lawful_offset_evidence, posted_by
  ) values (
    v_id, v_company_id, v_dfo_id, v_dfo.owner_id, v_settlement_id, v_amount, v_date,
    v_request_id, encode(sha256(convert_to(v_amount::text,'UTF8')),'hex'), v_batch_id, v_evidence, v_actor
  );

  -- Reduce the effective office payable by the offset (keeps 2000 GL and subledger
  -- in lockstep). net_payable itself stays server-derived/immutable.
  update public.owner_settlements
     set offset_applied = public.wp02_gap008_round_omr(offset_applied + v_amount), updated_at = now()
   where id = v_settlement_id;

  update public.due_from_owners
     set offset_amount = public.wp02_gap008_round_omr(offset_amount + v_amount),
         outstanding = public.wp02_gap008_round_omr(outstanding - v_amount),
         status = case
           when public.wp02_gap008_round_omr(outstanding - v_amount) = 0 then 'CLOSED'
           else 'OFFSET' end,
         updated_at = now()
   where id = v_dfo_id;

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false, 'due_from_owner_id', v_dfo_id, 'owner_settlement_id', v_settlement_id,
    'amount', v_amount, 'outstanding', public.wp02_gap008_round_omr(v_dfo.outstanding - v_amount),
    'journal_batch_id', v_batch_id, 'status', case when public.wp02_gap008_round_omr(v_dfo.outstanding - v_amount) = 0 then 'CLOSED' else 'OFFSET' end,
    'request_id', v_request_id
  );
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('offset_owner_receivable_atomic:' || v_company_id::text, v_request_id,
          jsonb_build_object('_request_fingerprint', v_fp, 'response', v_result));
  return v_result;
end;
$fn$;

alter function public.offset_owner_receivable_atomic(jsonb) owner to postgres;
revoke all on function public.offset_owner_receivable_atomic(jsonb) from public, anon;
grant execute on function public.offset_owner_receivable_atomic(jsonb) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Compensating reversals
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reverse_owner_receivable_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_dfo_id uuid := nullif(p_payload->>'due_from_owner_id','')::uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_reason text := nullif(btrim(coalesce(p_payload->>'reason','')), '');
  v_dfo public.due_from_owners%rowtype; v_rev jsonb; v_rev_batch uuid; v_cached jsonb; v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'DUE_FROM_OWNER_REVERSE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if v_dfo_id is null or v_request_id is null or v_reason is null or length(v_reason) < 3 then
    raise exception 'DUE_FROM_OWNER_REVERSE_REQUEST_REASON_REQUIRED' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('due_from_owner_reverse:' || v_company_id::text || ':' || v_dfo_id::text, 0));
  select * into v_dfo from public.due_from_owners where id = v_dfo_id and company_id = v_company_id for update;
  if not found then raise exception 'DUE_FROM_OWNER_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501'; end if;
  if v_dfo.status = 'REVERSED' then
    if v_dfo.reversed_request_id <> v_request_id then raise exception 'DUE_FROM_OWNER_REVERSE_IDEMPOTENCY_CONFLICT' using errcode = '22023'; end if;
    return jsonb_build_object('success', true, 'idempotent', true, 'due_from_owner_id', v_dfo_id, 'status', 'REVERSED', 'reversal_batch_id', v_dfo.reversal_journal_batch_id);
  end if;
  if v_dfo.journal_batch_id is null then raise exception 'DUE_FROM_OWNER_REVERSE_NO_BATCH' using errcode = '22023'; end if;
  if exists (select 1 from public.due_from_owner_recoveries r
              where r.due_from_owner_id = v_dfo_id and r.company_id = v_company_id and r.status = 'POSTED')
     or exists (select 1 from public.due_from_owner_offsets o
                 where o.due_from_owner_id = v_dfo_id and o.company_id = v_company_id and o.status = 'POSTED') then
    raise exception 'DUE_FROM_OWNER_REVERSE_HAS_DOWNSTREAM_SETTLEMENT: reverse recovery/offset first.' using errcode = '22023';
  end if;

  v_rev := public.reverse_journal_batch(v_dfo.journal_batch_id);
  v_rev_batch := (v_rev->>'reversal_batch_id')::uuid;

  update public.due_from_owners
     set status = 'REVERSED', outstanding = 0, reversed_request_id = v_request_id,
         reversal_journal_batch_id = v_rev_batch, updated_at = now()
   where id = v_dfo_id;

  v_result := jsonb_build_object('success', true, 'idempotent', false, 'due_from_owner_id', v_dfo_id, 'status', 'REVERSED', 'reversal_batch_id', v_rev_batch);
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('reverse_owner_receivable_atomic:' || v_company_id::text, v_request_id, jsonb_build_object('response', v_result));
  return v_result;
end;
$fn$;

alter function public.reverse_owner_receivable_atomic(jsonb) owner to postgres;
revoke all on function public.reverse_owner_receivable_atomic(jsonb) from public, anon;
grant execute on function public.reverse_owner_receivable_atomic(jsonb) to authenticated, service_role;

create or replace function public.reverse_owner_receivable_recovery_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_event_id uuid := nullif(p_payload->>'recovery_event_id','')::uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_reason text := nullif(btrim(coalesce(p_payload->>'reason','')), '');
  v_event public.due_from_owner_recoveries%rowtype; v_rev jsonb; v_rev_batch uuid; v_cached jsonb; v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'DUE_FROM_OWNER_RECOVERY_REVERSE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if v_event_id is null or v_request_id is null or v_reason is null or length(v_reason) < 3 then
    raise exception 'DUE_FROM_OWNER_RECOVERY_REVERSE_REQUEST_REASON_REQUIRED' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('due_from_owner_recover_reverse:' || v_company_id::text || ':' || v_event_id::text, 0));
  select * into v_event from public.due_from_owner_recoveries where id = v_event_id and company_id = v_company_id for update;
  if not found then raise exception 'DUE_FROM_OWNER_RECOVERY_EVENT_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501'; end if;
  if v_event.status = 'REVERSED' then
    if v_event.reversed_request_id <> v_request_id then raise exception 'DUE_FROM_OWNER_RECOVERY_REVERSE_IDEMPOTENCY_CONFLICT' using errcode = '22023'; end if;
    return jsonb_build_object('success', true, 'idempotent', true, 'recovery_event_id', v_event.id, 'status', 'REVERSED', 'reversal_batch_id', v_event.reversal_journal_batch_id);
  end if;
  v_rev := public.reverse_journal_batch(v_event.journal_batch_id);
  v_rev_batch := (v_rev->>'reversal_batch_id')::uuid;

  update public.due_from_owners
     set recovered_amount = public.wp02_gap008_round_omr(recovered_amount - v_event.amount),
         outstanding = public.wp02_gap008_round_omr(outstanding + v_event.amount),
         status = case
           when public.wp02_gap008_round_omr(recovered_amount - v_event.amount) <= 0 then 'OPEN'
           when public.wp02_gap008_round_omr(outstanding + v_event.amount) = 0 then 'RECOVERED'
           else 'PARTIALLY_RECOVERED' end,
         updated_at = now()
   where id = v_event.due_from_owner_id;

  update public.due_from_owner_recoveries
     set status = 'REVERSED', reversed_request_id = v_request_id, reversal_journal_batch_id = v_rev_batch, updated_at = now()
   where id = v_event.id;

  v_result := jsonb_build_object('success', true, 'idempotent', false, 'recovery_event_id', v_event.id, 'status', 'REVERSED', 'reversal_batch_id', v_rev_batch);
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('reverse_owner_receivable_recovery_atomic:' || v_company_id::text, v_request_id, jsonb_build_object('response', v_result));
  return v_result;
end;
$fn$;

alter function public.reverse_owner_receivable_recovery_atomic(jsonb) owner to postgres;
revoke all on function public.reverse_owner_receivable_recovery_atomic(jsonb) from public, anon;
grant execute on function public.reverse_owner_receivable_recovery_atomic(jsonb) to authenticated, service_role;

create or replace function public.reverse_owner_receivable_offset_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_event_id uuid := nullif(p_payload->>'offset_event_id','')::uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_reason text := nullif(btrim(coalesce(p_payload->>'reason','')), '');
  v_event public.due_from_owner_offsets%rowtype; v_rev jsonb; v_rev_batch uuid; v_cached jsonb; v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'DUE_FROM_OWNER_OFFSET_REVERSE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if v_event_id is null or v_request_id is null or v_reason is null or length(v_reason) < 3 then
    raise exception 'DUE_FROM_OWNER_OFFSET_REVERSE_REQUEST_REASON_REQUIRED' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('due_from_owner_offset_reverse:' || v_company_id::text || ':' || v_event_id::text, 0));
  select * into v_event from public.due_from_owner_offsets where id = v_event_id and company_id = v_company_id for update;
  if not found then raise exception 'DUE_FROM_OWNER_OFFSET_EVENT_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501'; end if;
  if v_event.status = 'REVERSED' then
    if v_event.reversed_request_id <> v_request_id then raise exception 'DUE_FROM_OWNER_OFFSET_REVERSE_IDEMPOTENCY_CONFLICT' using errcode = '22023'; end if;
    return jsonb_build_object('success', true, 'idempotent', true, 'offset_event_id', v_event.id, 'status', 'REVERSED', 'reversal_batch_id', v_event.reversal_journal_batch_id);
  end if;
  v_rev := public.reverse_journal_batch(v_event.journal_batch_id);
  v_rev_batch := (v_rev->>'reversal_batch_id')::uuid;

  -- Restore the effective office payable reduced by the original offset.
  update public.owner_settlements
     set offset_applied = greatest(public.wp02_gap008_round_omr(offset_applied - v_event.amount), 0), updated_at = now()
   where id = v_event.owner_settlement_id;

  update public.due_from_owners
     set offset_amount = public.wp02_gap008_round_omr(offset_amount - v_event.amount),
         outstanding = public.wp02_gap008_round_omr(outstanding + v_event.amount),
         status = case
           when public.wp02_gap008_round_omr(offset_amount - v_event.amount) <= 0 then 'OPEN'
           when public.wp02_gap008_round_omr(outstanding + v_event.amount) = 0 then 'CLOSED'
           else 'OFFSET' end,
         updated_at = now()
   where id = v_event.due_from_owner_id;

  update public.due_from_owner_offsets
     set status = 'REVERSED', reversed_request_id = v_request_id, reversal_journal_batch_id = v_rev_batch, updated_at = now()
   where id = v_event.id;

  v_result := jsonb_build_object('success', true, 'idempotent', false, 'offset_event_id', v_event.id, 'status', 'REVERSED', 'reversal_batch_id', v_rev_batch);
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('reverse_owner_receivable_offset_atomic:' || v_company_id::text, v_request_id, jsonb_build_object('response', v_result));
  return v_result;
end;
$fn$;

alter function public.reverse_owner_receivable_offset_atomic(jsonb) owner to postgres;
revoke all on function public.reverse_owner_receivable_offset_atomic(jsonb) from public, anon;
grant execute on function public.reverse_owner_receivable_offset_atomic(jsonb) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Supersede gl_reconcile_subledgers so 1300 reconciles to the operational
--    due_from_owners subledger (the prior definition hard-coded sub_1300 = 0).
--    The 2000 subledger computation is preserved unchanged.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_reconcile_subledgers(p_as_of_date date default current_date)
returns table (
  account_no text,
  account_name text,
  gl_balance numeric,
  subledger_balance numeric,
  mismatch numeric,
  is_reconciled boolean,
  details jsonb
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $fn$
declare
  v_company_id uuid := public.require_company_id();
  v_gl_2000 numeric := 0;
  v_gl_1201 numeric := 0;
  v_gl_2200 numeric := 0;
  v_gl_1300 numeric := 0;
  v_gl_2300 numeric := 0;
  v_sub_2000 numeric := 0;
  v_sub_1201 numeric := 0;
  v_sub_2200 numeric := 0;
  v_sub_1300 numeric := 0;
  v_sub_2300 numeric := 0;
begin
  select coalesce(sum(l.credit - l.debit), 0) into v_gl_2000
    from public.journal_lines l join public.journal_batches b on b.id = l.batch_id join public.accounts a on a.id = l.account_id
   where b.company_id = v_company_id and b.status = 'POSTED' and a.no = '2000' and b.effective_date <= p_as_of_date;
  select coalesce(sum(l.debit - l.credit), 0) into v_gl_1201
    from public.journal_lines l join public.journal_batches b on b.id = l.batch_id join public.accounts a on a.id = l.account_id
   where b.company_id = v_company_id and b.status = 'POSTED' and a.no = '1201' and b.effective_date <= p_as_of_date;
  select coalesce(sum(l.credit - l.debit), 0) into v_gl_2200
    from public.journal_lines l join public.journal_batches b on b.id = l.batch_id join public.accounts a on a.id = l.account_id
   where b.company_id = v_company_id and b.status = 'POSTED' and a.no = '2200' and b.effective_date <= p_as_of_date;
  select coalesce(sum(l.debit - l.credit), 0) into v_gl_1300
    from public.journal_lines l join public.journal_batches b on b.id = l.batch_id join public.accounts a on a.id = l.account_id
   where b.company_id = v_company_id and b.status = 'POSTED' and a.no = '1300' and b.effective_date <= p_as_of_date;
  select coalesce(sum(l.credit - l.debit), 0) into v_gl_2300
    from public.journal_lines l join public.journal_batches b on b.id = l.batch_id join public.accounts a on a.id = l.account_id
   where b.company_id = v_company_id and b.status = 'POSTED' and a.no = '2300' and b.effective_date <= p_as_of_date;

  select coalesce(sum(s.net_payable - s.offset_applied), 0) into v_sub_2000
    from public.owner_settlements s where s.company_id = v_company_id and s.status in ('PENDING','APPROVED') and s.period_end <= p_as_of_date;
  select coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - coalesce(i.paid_amount, 0)), 0) into v_sub_1201
    from public.invoices i where i.company_id = v_company_id and i.deleted_at is null and i.status in ('UNPAID','PARTIALLY_PAID') and i.due_date <= p_as_of_date;
  if to_regclass('public.tenant_deposits') is not null then
    select coalesce(sum(d.remaining_amount), 0) into v_sub_2200 from public.tenant_deposits d where d.company_id = v_company_id and d.deleted_at is null;
  end if;
  -- GAP-008: 1300 subledger = outstanding Due-from-Owner receivables.
  select coalesce(sum(o.outstanding), 0) into v_sub_1300
    from public.due_from_owners o where o.company_id = v_company_id and o.status <> 'REVERSED';
  if to_regclass('public.commissions') is not null then
    select coalesce(sum(c.amount), 0) into v_sub_2300 from public.commissions c where c.company_id = v_company_id and c.status = 'pending';
  end if;

  return query values
    ('2000'::text, 'Owner Funds Payable'::text, round(v_gl_2000, 3), round(v_sub_2000, 3), round(v_gl_2000 - v_sub_2000, 3), abs(v_gl_2000 - v_sub_2000) < 0.001, jsonb_build_object('account','2000','type','liability')),
    ('1201'::text, 'Tenant Receivable'::text, round(v_gl_1201, 3), round(v_sub_1201, 3), round(v_gl_1201 - v_sub_1201, 3), abs(v_gl_1201 - v_sub_1201) < 0.001, jsonb_build_object('account','1201','type','asset')),
    ('2200'::text, 'Tenant Deposits Payable'::text, round(v_gl_2200, 3), round(v_sub_2200, 3), round(v_gl_2200 - v_sub_2200, 3), abs(v_gl_2200 - v_sub_2200) < 0.001, jsonb_build_object('account','2200','type','liability')),
    ('1300'::text, 'Due from Owners'::text, round(v_gl_1300, 3), round(v_sub_1300, 3), round(v_gl_1300 - v_sub_1300, 3), abs(v_gl_1300 - v_sub_1300) < 0.001, jsonb_build_object('account','1300','type','asset')),
    ('2300'::text, 'Broker Commissions Payable'::text, round(v_gl_2300, 3), round(v_sub_2300, 3), round(v_gl_2300 - v_sub_2300, 3), abs(v_gl_2300 - v_sub_2300) < 0.001, jsonb_build_object('account','2300','type','liability'));
end;
$fn$;

alter function public.gl_reconcile_subledgers(date) owner to postgres;
revoke all on function public.gl_reconcile_subledgers(date) from public, anon;
grant execute on function public.gl_reconcile_subledgers(date) to authenticated, service_role;

comment on table public.due_from_owners is 'GAP-008 operational Due-from-Owner (1300) subledger; reconciled to GL 1300. Owner obligations never post to 6100.';
comment on table public.due_from_owner_recoveries is 'GAP-008 append-only cash-recovery events (Dr Cash/Bank / Cr 1300).';
comment on table public.due_from_owner_offsets is 'GAP-008 append-only lawful settlement offset events (Dr 2000 / Cr 1300); require enforceable offset right and never force 2000 negative.';


-- GAP-008: preserve FA-003/S02 reservation, idempotency and audit semantics;
-- its payment amount is the authoritative payable after an approved lawful offset.
-- S03 GL write boundary: the payout posts through the canonical engine
-- post_journal_event() — never through the legacy journal_entries surface.
-- When the lawful offset fully cleared the payable (effective payable = 0) the
-- settlement is closed as PAID without creating a zero-value journal event.
create or replace function public.pay_owner_settlement_atomic_s02_base(p_payload jsonb)
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
  v_post jsonb;
  v_cached jsonb;
  v_result jsonb;
  v_operation_name text;
  v_request_fingerprint text;
  v_cached_fingerprint text;
  v_cached_target_id text;
  v_updated_count integer;
  v_effective_payable numeric;
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

  -- GAP-008: the lawful offset already debited 2000 / credited 1300.
  v_effective_payable := public.wp02_gap008_round_omr(v_row.net_payable - coalesce(v_row.offset_applied, 0));
  if v_effective_payable < 0 then
    raise exception 'OWNER_SETTLEMENT_EFFECTIVE_PAYABLE_NEGATIVE' using errcode = '22023';
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

  -- GAP-008 + S03 GL write boundary: the residual owner payout posts through
  -- the canonical posting engine (Dr 2000 Owner Funds Payable / Cr 1111 Cash),
  -- never through a new legacy journal_entries writer. When the lawful offset
  -- already cleared the full payable (effective payable = 0) the settlement is
  -- closed without creating a zero-value journal event: the offset itself was
  -- the final economic event (Dr 2000 / Cr 1300) and a 0/0 batch would be
  -- rejected by the engine's positive-side line contract anyway.
  if v_effective_payable > 0 then
    v_owner_payable_account := public.require_company_account_id(v_company_id, '2000');
    v_cash_account := public.require_company_account_id(v_company_id, '1111');

    -- Bootstrap only a company's very first accounting period (same rule as the
    -- S03 receipt path). Once any period exists, the fail-closed OPEN/SOFT_CLOSED/
    -- HARD_CLOSED resolver inside the engine remains authoritative.
    perform public.gl_ensure_initial_open_period(v_company_id, current_date);

    v_post := public.post_journal_event(jsonb_build_object(
      'company_id', v_company_id,
      'source_type', 'owner_settlement_payment',
      'source_id', v_id,
      'event_id', 'pay',
      'effective_date', current_date,
      'description', 'Owner settlement payout: Owner Funds Payable vs Cash (net of lawful offset)',
      'lines', jsonb_build_array(
        jsonb_build_object(
          'account_id', v_owner_payable_account, 'debit', v_effective_payable, 'credit', 0,
          'ref_source_id', v_id, 'ref_entity_type', 'owner_settlement_payment', 'ref_entity_id', v_id
        ),
        jsonb_build_object(
          'account_id', v_cash_account, 'debit', 0, 'credit', v_effective_payable,
          'ref_source_id', v_id, 'ref_entity_type', 'owner_settlement_payment', 'ref_entity_id', v_id
        )
      )
    ));
    v_batch_id := (v_post->>'batch_id')::uuid;
    if v_batch_id is null then
      raise exception 'OWNER_SETTLEMENT_JOURNAL_BATCH_MISSING'
        using errcode = 'P0001';
    end if;
  else
    v_batch_id := null;
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
    case
      when v_effective_payable > 0
        then 'Owner settlement paid with balanced owner-payable/cash journal batch (canonical GL engine)'
      else 'Owner settlement closed as PAID: lawful offset fully cleared the payable; no zero-value journal event created'
    end,
    'owner_settlements', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'settlement_id', v_id,
    'status', 'PAID',
    'net_payable', v_row.net_payable,
    'offset_applied', coalesce(v_row.offset_applied, 0),
    'effective_payable', v_effective_payable,
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


-- D-002 private ACL contract (S02-T10): the preserved base implementation is a
-- private implementation detail. It must NOT be externally executable by
-- authenticated OR service_role; the governed public wrapper
-- pay_owner_settlement_atomic(jsonb) remains the only external entry point.
alter function public.pay_owner_settlement_atomic_s02_base(jsonb) owner to postgres;
revoke all on function public.pay_owner_settlement_atomic_s02_base(jsonb)
  from public, anon, authenticated, service_role;

commit;
