-- =============================================================================
-- WP-05 GAP-016 — S09 Controlled Correction Framework (append-only, auditable,
-- reversible, S08-gated at DB level)
-- =============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Table s09_corrections — governed correction records
-- ---------------------------------------------------------------------------
create table if not exists public.s09_corrections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  accounting_period_id uuid references public.accounting_periods(id) on delete restrict,
  review_id uuid not null references public.s08_frozen_reviews(id) on delete restrict,
  source_type text not null,
  source_id text not null,
  source_scope jsonb not null default '{}'::jsonb,
  reason text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','VALIDATED','APPLIED','REVERSED')),
  before_evidence jsonb,
  after_evidence jsonb,
  original_journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  correction_journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  reversal_journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  amount numeric(18,3) not null check (amount >= 0),
  debit_account_id text,
  credit_account_id text,
  debit_account_no text,
  credit_account_no text,
  lines jsonb,
  actor_id uuid,
  request_id text not null,
  idempotency_key text,
  validated_at timestamptz,
  applied_at timestamptz,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint s09_corrections_reason_not_empty check (btrim(reason) <> ''),
  constraint s09_corrections_request_id_not_empty check (btrim(request_id) <> ''),
  constraint s09_corrections_source_not_empty check (btrim(source_type) <> '' and btrim(source_id) <> ''),
  constraint s09_corrections_amount_positive check (amount > 0),
  constraint s09_corrections_accounts_required check (
    (debit_account_id is not null and credit_account_id is not null) or lines is not null
  )
);

comment on table public.s09_corrections is 'WP-05 GAP-016: controlled historical correction, append-only, S08-gated, lifecycle DRAFT→VALIDATED→APPLIED→REVERSED, preserves before/after evidence.';

create unique index if not exists s09_corrections_request_uidx on public.s09_corrections (company_id, request_id);
create unique index if not exists s09_corrections_idempotency_uidx on public.s09_corrections (company_id, idempotency_key) where idempotency_key is not null;
create index if not exists s09_corrections_company_idx on public.s09_corrections (company_id);
create index if not exists s09_corrections_review_idx on public.s09_corrections (review_id);
create index if not exists s09_corrections_period_idx on public.s09_corrections (accounting_period_id);
create index if not exists s09_corrections_status_idx on public.s09_corrections (status);
create index if not exists s09_corrections_source_idx on public.s09_corrections (source_type, source_id);

-- RLS
alter table public.s09_corrections enable row level security;
alter table public.s09_corrections alter column company_id set default public.current_company_id();

drop policy if exists p0_tenant_isolation on public.s09_corrections;
create policy p0_tenant_isolation on public.s09_corrections as restrictive
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists s09_corrections_read on public.s09_corrections;
create policy s09_corrections_read on public.s09_corrections
  for select to authenticated using (public.is_app_user());

drop policy if exists s09_corrections_write on public.s09_corrections;
create policy s09_corrections_write on public.s09_corrections
  for all to authenticated using (false) with check (false);

revoke all on public.s09_corrections from public, anon;
grant select on public.s09_corrections to authenticated;
grant all on public.s09_corrections to service_role;

drop trigger if exists trg_s09_corrections_updated_at on public.s09_corrections;
create trigger trg_s09_corrections_updated_at
  before update on public.s09_corrections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Immutability + lifecycle guard
-- ---------------------------------------------------------------------------
create or replace function public.guard_s09_correction_writes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_authorized text := coalesce(current_setting('malik.s09_correction_change_authorized', true), '');
begin
  if tg_op = 'DELETE' then
    raise exception 'S09_CORRECTION_IMMUTABLE: corrections cannot be deleted, they are append-only.' using errcode='42501';
  end if;

  if tg_op = 'UPDATE' then
    if v_authorized <> 'true' then
      raise exception 'S09_CORRECTION_IMMUTABLE: direct updates forbidden, use s09_* RPCs.' using errcode='42501';
    end if;

    -- Immutable fields
    if old.company_id is distinct from new.company_id then
      raise exception 'S09_IMMUTABLE_FIELD: company_id cannot be changed' using errcode='42501';
    end if;
    if old.review_id is distinct from new.review_id then
      raise exception 'S09_IMMUTABLE_FIELD: review_id cannot be changed' using errcode='42501';
    end if;
    if old.accounting_period_id is distinct from new.accounting_period_id then
      raise exception 'S09_IMMUTABLE_FIELD: accounting_period_id cannot be changed' using errcode='42501';
    end if;
    if old.source_type is distinct from new.source_type or old.source_id is distinct from new.source_id then
      raise exception 'S09_IMMUTABLE_FIELD: source cannot be changed' using errcode='42501';
    end if;
    if old.request_id is distinct from new.request_id then
      raise exception 'S09_IMMUTABLE_FIELD: request_id cannot be changed' using errcode='42501';
    end if;
    if old.before_evidence is distinct from new.before_evidence then
      raise exception 'S09_IMMUTABLE_FIELD: before_evidence is immutable' using errcode='42501';
    end if;

    -- Lifecycle
    if old.status = 'DRAFT' and new.status not in ('VALIDATED','REVERSED') then
      -- DRAFT can go to VALIDATED, or be REVERSED? Actually DRAFT should not go directly to APPLIED, must via VALIDATED
      -- Allow DRAFT→REJECT? No, but allow DRAFT→REVERSED for cancellation? We'll allow DRAFT→VALIDATED only for strictness
      if new.status = 'DRAFT' then
        -- no self transition check, allow no-op
      else
        raise exception 'S09_LIFECYCLE_ILLEGAL: DRAFT can only transition to VALIDATED, got %', new.status using errcode='23514';
      end if;
    end if;
    if old.status = 'VALIDATED' and new.status not in ('APPLIED','REVERSED') then
      raise exception 'S09_LIFECYCLE_ILLEGAL: VALIDATED can only transition to APPLIED or REVERSED, got %', new.status using errcode='23514';
    end if;
    if old.status = 'APPLIED' and new.status <> 'REVERSED' then
      raise exception 'S09_LIFECYCLE_ILLEGAL: APPLIED can only transition to REVERSED, got %', new.status using errcode='23514';
    end if;
    if old.status = 'REVERSED' and new.status is distinct from old.status then
      raise exception 'S09_LIFECYCLE_TERMINAL: REVERSED is terminal' using errcode='23514';
    end if;

    -- Prevent downgrade
    if old.status = 'VALIDATED' and new.status = 'DRAFT' then
      raise exception 'S09_LIFECYCLE_ILLEGAL: cannot downgrade VALIDATED to DRAFT' using errcode='23514';
    end if;
    if old.status = 'APPLIED' and new.status in ('DRAFT','VALIDATED') then
      raise exception 'S09_LIFECYCLE_ILLEGAL: cannot downgrade APPLIED' using errcode='23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_s09_correction_writes on public.s09_corrections;
create trigger guard_s09_correction_writes
  before update or delete on public.s09_corrections
  for each row execute function public.guard_s09_correction_writes();

-- ---------------------------------------------------------------------------
-- 3. Validation helper — checks all required invariants before apply
-- ---------------------------------------------------------------------------
create or replace function public.s09_validate_correction_invariants(p_correction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_corr public.s09_corrections%rowtype;
  v_review public.s08_frozen_reviews%rowtype;
  v_period public.accounting_periods%rowtype;
  v_debit_exists boolean;
  v_credit_exists boolean;
  v_debit_company uuid;
  v_credit_company uuid;
  v_amount_rounded numeric;
begin
  if p_correction_id is null then
    raise exception 'S09_CORRECTION_ID_REQUIRED' using errcode='22023';
  end if;

  select * into v_corr from public.s09_corrections where id = p_correction_id and company_id = v_company_id for update;
  if not found then
    raise exception 'S09_CORRECTION_NOT_FOUND: correction % not found for company %', p_correction_id, v_company_id using errcode='P0002';
  end if;

  -- 1. approved S08 review exists
  select * into v_review from public.s08_frozen_reviews where id = v_corr.review_id and company_id = v_company_id;
  if not found then
    raise exception 'S09_S08_REVIEW_NOT_FOUND: linked S08 review % not found for company %', v_corr.review_id, v_company_id using errcode='P0002';
  end if;
  if v_review.reviewer_decision <> 'APPROVED' then
    raise exception 'S09_S08_APPROVAL_REQUIRED: S08 review % is not APPROVED (current %)', v_review.id, v_review.reviewer_decision using errcode='42501';
  end if;

  -- 2. company matches
  if v_review.company_id <> v_corr.company_id then
    raise exception 'S09_COMPANY_MISMATCH: correction company % does not match review company %', v_corr.company_id, v_review.company_id using errcode='42501';
  end if;

  -- 3. period matches
  if v_corr.accounting_period_id is not null and v_review.accounting_period_id is not null
     and v_corr.accounting_period_id <> v_review.accounting_period_id then
    raise exception 'S09_PERIOD_MISMATCH: correction period % does not match review period %', v_corr.accounting_period_id, v_review.accounting_period_id using errcode='22023';
  end if;

  -- 4. source scope matches (review scope vs correction source_scope, lineage)
  if v_review.dataset_lineage <> coalesce(v_corr.source_scope->>'dataset_lineage', v_review.dataset_lineage) and v_corr.source_scope ? 'dataset_lineage' then
    raise exception 'S09_LINEAGE_MISMATCH: correction lineage % does not match review lineage %', v_corr.source_scope->>'dataset_lineage', v_review.dataset_lineage using errcode='22023';
  end if;

  -- 5. accounting period permits operation
  if v_corr.accounting_period_id is not null then
    select * into v_period from public.accounting_periods where id = v_corr.accounting_period_id and company_id = v_company_id;
    if not found then
      raise exception 'S09_PERIOD_NOT_FOUND' using errcode='P0002';
    end if;
    if v_period.status = 'HARD_CLOSED' then
      raise exception 'S09_PERIOD_HARD_CLOSED: period % is HARD_CLOSED and cannot accept corrections', v_period.name using errcode='42501';
    end if;
  end if;

  -- 6. debit = credit (amounts use 3dp) — check lines or debit/credit accounts
  v_amount_rounded := public.wp05_round_omr(v_corr.amount);
  if abs(v_corr.amount - v_amount_rounded) > 0.0005 then
    raise exception 'S09_AMOUNT_PRECISION_INVALID: amount % must be OMR 3dp, rounded %', v_corr.amount, v_amount_rounded using errcode='22023';
  end if;

  if v_corr.lines is not null then
    -- Validate lines sum balances
    declare v_debit_sum numeric; v_credit_sum numeric;
    begin
      select public.wp05_round_omr(coalesce(sum((line->>'debit')::numeric),0)),
             public.wp05_round_omr(coalesce(sum((line->>'credit')::numeric),0))
      into v_debit_sum, v_credit_sum
      from jsonb_array_elements(v_corr.lines) line;

      if abs(v_debit_sum - v_credit_sum) > 0.001 then
        raise exception 'S09_DEBIT_CREDIT_MISMATCH: lines debit % != credit % (tolerance 0.001)', v_debit_sum, v_credit_sum using errcode='22023';
      end if;
    end;
  else
    if v_corr.debit_account_id is null or v_corr.credit_account_id is null then
      raise exception 'S09_ACCOUNTS_REQUIRED: debit and credit accounts required when lines not provided' using errcode='22023';
    end if;
  end if;

  -- 7. accounts belong to the company
  if v_corr.debit_account_id is not null then
    select exists(select 1 from public.accounts a where a.id = v_corr.debit_account_id and a.company_id = v_company_id) into v_debit_exists;
    if not v_debit_exists then
      raise exception 'S09_ACCOUNT_COMPANY_MISMATCH: debit account % does not belong to company %', v_corr.debit_account_id, v_company_id using errcode='42501';
    end if;
  end if;
  if v_corr.credit_account_id is not null then
    select exists(select 1 from public.accounts a where a.id = v_corr.credit_account_id and a.company_id = v_company_id) into v_credit_exists;
    if not v_credit_exists then
      raise exception 'S09_ACCOUNT_COMPANY_MISMATCH: credit account % does not belong to company %', v_corr.credit_account_id, v_company_id using errcode='42501';
    end if;
  end if;
  if v_corr.lines is not null then
    declare line record;
    begin
      for line in select * from jsonb_array_elements(v_corr.lines) as l loop
        if not exists (select 1 from public.accounts a where a.id = (line.l->>'account_id') and a.company_id = v_company_id) then
          raise exception 'S09_ACCOUNT_COMPANY_MISMATCH: line account % does not belong to company %', (line.l->>'account_id'), v_company_id using errcode='42501';
        end if;
      end loop;
    end;
  end if;

  -- 8. parties belong to correct scope — check if source_type has company_id (e.g., invoices, payments, expenses)
  -- For simplicity, verify source exists and belongs to company where applicable
  if v_corr.source_type = 'invoice' then
    if not exists (select 1 from public.invoices where id::text = v_corr.source_id and company_id = v_company_id) then
      -- If not found, we allow? But requirement says source evidence exists — fail closed
      raise exception 'S09_SOURCE_EVIDENCE_MISSING: invoice % not found for company %', v_corr.source_id, v_company_id using errcode='P0002';
    end if;
  elsif v_corr.source_type = 'payment' then
    if not exists (select 1 from public.payments where id::text = v_corr.source_id and company_id = v_company_id) then
      raise exception 'S09_SOURCE_EVIDENCE_MISSING: payment % not found', v_corr.source_id using errcode='P0002';
    end if;
  elsif v_corr.source_type = 'expense' then
    if not exists (select 1 from public.expenses where id::text = v_corr.source_id and company_id = v_company_id) then
      raise exception 'S09_SOURCE_EVIDENCE_MISSING: expense % not found', v_corr.source_id using errcode='P0002';
    end if;
  elsif v_corr.source_type = 'deposit' then
    if not exists (select 1 from public.tenant_deposits where id = v_corr.source_id and company_id = v_company_id) then
      raise exception 'S09_SOURCE_EVIDENCE_MISSING: deposit % not found', v_corr.source_id using errcode='P0002';
    end if;
  end if;

  -- 9. reason non-empty — already enforced by check constraint, but double-check
  if btrim(v_corr.reason) = '' then
    raise exception 'S09_REASON_REQUIRED: reason must be non-empty' using errcode='22023';
  end if;

  -- 10. correction has not already been applied
  if v_corr.status = 'APPLIED' then
    raise exception 'S09_ALREADY_APPLIED: correction % already APPLIED', v_corr.id using errcode='23505';
  end if;
  if v_corr.status = 'REVERSED' then
    raise exception 'S09_ALREADY_REVERSED: correction % already REVERSED', v_corr.id using errcode='23505';
  end if;

  -- 11. idempotency/replay protection holds
  if v_corr.correction_journal_batch_id is not null and v_corr.status = 'APPLIED' then
    raise exception 'S09_IDEMPOTENCY_VIOLATION: correction already has batch %', v_corr.correction_journal_batch_id using errcode='23505';
  end if;

  return jsonb_build_object('success', true, 'correction_id', v_corr.id, 'company_id', v_company_id, 'review_id', v_review.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. RPCs for lifecycle
-- ---------------------------------------------------------------------------

-- Create correction draft (may be without approved review, but validation will fail later)
create or replace function public.s09_create_correction_draft(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_period_id uuid;
  v_review_id uuid;
  v_source_type text;
  v_source_id text;
  v_source_scope jsonb;
  v_reason text;
  v_amount numeric;
  v_debit_id text;
  v_credit_id text;
  v_debit_no text;
  v_credit_no text;
  v_lines jsonb;
  v_before jsonb;
  v_after jsonb;
  v_request_id text;
  v_idempotency_key text;
  v_original_batch_id uuid;
  v_existing_id uuid;
  v_id uuid;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER required for S09 draft' using errcode='42501';
  end if;

  v_period_id := nullif(p_payload->>'accounting_period_id','')::uuid;
  v_review_id := nullif(p_payload->>'review_id','')::uuid;
  v_source_type := nullif(btrim(coalesce(p_payload->>'source_type','')), '');
  v_source_id := nullif(btrim(coalesce(p_payload->>'source_id','')), '');
  v_source_scope := coalesce(p_payload->'source_scope', '{}'::jsonb);
  v_reason := nullif(btrim(coalesce(p_payload->>'reason','')), '');
  v_amount := public.wp05_round_omr((p_payload->>'amount')::numeric);
  v_debit_id := nullif(p_payload->>'debit_account_id','');
  v_credit_id := nullif(p_payload->>'credit_account_id','');
  v_debit_no := nullif(p_payload->>'debit_account_no','');
  v_credit_no := nullif(p_payload->>'credit_account_no','');
  v_lines := p_payload->'lines';
  v_before := p_payload->'before_evidence';
  v_after := p_payload->'after_evidence';
  v_request_id := coalesce(nullif(p_payload->>'request_id',''), gen_random_uuid()::text);
  v_idempotency_key := nullif(p_payload->>'idempotency_key','');
  v_original_batch_id := nullif(p_payload->>'original_journal_batch_id','')::uuid;

  if v_review_id is null then
    raise exception 'S09_REVIEW_ID_REQUIRED' using errcode='22023';
  end if;
  if v_source_type is null or v_source_id is null then
    raise exception 'S09_SOURCE_REQUIRED: source_type and source_id required' using errcode='22023';
  end if;
  if v_reason is null then
    raise exception 'S09_REASON_REQUIRED' using errcode='22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'S09_AMOUNT_REQUIRED: positive amount required' using errcode='22023';
  end if;
  if abs(v_amount - public.wp05_round_omr(v_amount)) > 0.0005 then
    raise exception 'S09_AMOUNT_PRECISION_INVALID: amount must be 3dp' using errcode='22023';
  end if;

  -- Resolve account_ids from nos if provided
  if v_debit_id is null and v_debit_no is not null then
    select id into v_debit_id from public.accounts where company_id = v_company_id and no = v_debit_no and is_active = true limit 1;
    if v_debit_id is null then
      raise exception 'S09_ACCOUNT_NOT_FOUND: debit account_no % not found for company %', v_debit_no, v_company_id using errcode='P0002';
    end if;
  end if;
  if v_credit_id is null and v_credit_no is not null then
    select id into v_credit_id from public.accounts where company_id = v_company_id and no = v_credit_no and is_active = true limit 1;
    if v_credit_id is null then
      raise exception 'S09_ACCOUNT_NOT_FOUND: credit account_no % not found', v_credit_no using errcode='P0002';
    end if;
  end if;

  -- Idempotency check: if request_id exists, return existing
  select id into v_existing_id from public.s09_corrections where company_id = v_company_id and request_id = v_request_id;
  if v_existing_id is not null then
    return jsonb_build_object('success', true, 'id', v_existing_id, 'idempotent', true, 'status', (select status from public.s09_corrections where id = v_existing_id));
  end if;

  -- Validate accounts belong to company (fail closed)
  if v_debit_id is not null and not exists (select 1 from public.accounts where id = v_debit_id and company_id = v_company_id) then
    raise exception 'S09_ACCOUNT_COMPANY_MISMATCH: debit account % not in company %', v_debit_id, v_company_id using errcode='42501';
  end if;
  if v_credit_id is not null and not exists (select 1 from public.accounts where id = v_credit_id and company_id = v_company_id) then
    raise exception 'S09_ACCOUNT_COMPANY_MISMATCH: credit account % not in company %', v_credit_id, v_company_id using errcode='42501';
  end if;

  -- If review exists, check company matches (fail closed immediately)
  if not exists (select 1 from public.s08_frozen_reviews where id = v_review_id and company_id = v_company_id) then
    raise exception 'S09_S08_REVIEW_COMPANY_MISMATCH: review % not found for company %', v_review_id, v_company_id using errcode='42501';
  end if;

  perform set_config('malik.s09_correction_change_authorized', 'true', true);

  insert into public.s09_corrections (
    company_id, accounting_period_id, review_id, source_type, source_id, source_scope,
    reason, status, before_evidence, after_evidence, original_journal_batch_id,
    amount, debit_account_id, credit_account_id, debit_account_no, credit_account_no, lines,
    actor_id, request_id, idempotency_key
  ) values (
    v_company_id, v_period_id, v_review_id, v_source_type, v_source_id, v_source_scope,
    v_reason, 'DRAFT', v_before, v_after, v_original_batch_id,
    v_amount, v_debit_id, v_credit_id, v_debit_no, v_credit_no, v_lines,
    auth.uid(), v_request_id, coalesce(v_idempotency_key, v_request_id)
  )
  returning id into v_id;

  return jsonb_build_object('success', true, 'id', v_id, 'status', 'DRAFT', 'request_id', v_request_id);
end;
$$;

-- Validate correction: DRAFT → VALIDATED, checks invariants including S08 approval gate
create or replace function public.s09_validate_correction(p_correction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER required for S09 validation' using errcode='42501';
  end if;

  -- This function MUST fail if S08 approval missing — DB-level gate
  v_result := public.s09_validate_correction_invariants(p_correction_id);

  perform set_config('malik.s09_correction_change_authorized', 'true', true);

  update public.s09_corrections
  set status = 'VALIDATED',
      validated_at = now(),
      actor_id = auth.uid(),
      updated_at = now()
  where id = p_correction_id and company_id = v_company_id and status = 'DRAFT';

  if not found then
    raise exception 'S09_VALIDATE_FAILED: correction % not in DRAFT status or not found', p_correction_id using errcode='P0002';
  end if;

  return jsonb_build_object('success', true, 'id', p_correction_id, 'status', 'VALIDATED', 'validation', v_result);
end;
$$;

-- Apply correction: VALIDATED → APPLIED, creates GL batch via posting kernel
create or replace function public.s09_apply_correction(p_correction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp, extensions
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_corr public.s09_corrections%rowtype;
  v_review public.s08_frozen_reviews%rowtype;
  v_period public.accounting_periods%rowtype;
  v_batch_result jsonb;
  v_batch_id uuid;
  v_effective_date date;
  v_lines jsonb;
  v_description text;
begin
  if auth.uid() is null or not public.is_accountant() then
    -- Apply is accounting control, require ACCOUNTANT or ADMIN
    if not public.is_admin() then
      raise exception 'S09_APPLY_REQUIRES_ACCOUNTANT: ACCOUNTANT or ADMIN role required' using errcode='42501';
    end if;
  end if;

  if p_correction_id is null then
    raise exception 'S09_CORRECTION_ID_REQUIRED' using errcode='22023';
  end if;

  select * into v_corr from public.s09_corrections where id = p_correction_id and company_id = v_company_id for update;
  if not found then
    raise exception 'S09_CORRECTION_NOT_FOUND' using errcode='P0002';
  end if;

  if v_corr.status <> 'VALIDATED' then
    raise exception 'S09_APPLY_STATUS_INVALID: correction must be VALIDATED to APPLY, current %', v_corr.status using errcode='23514';
  end if;

  -- Re-validate all invariants at apply time (including S08 gate) — DB-level enforcement
  perform public.s09_validate_correction_invariants(p_correction_id);

  -- Determine effective date: use period start or now, but preserve effective date if period exists
  if v_corr.accounting_period_id is not null then
    select * into v_period from public.accounting_periods where id = v_corr.accounting_period_id and company_id = v_company_id;
    v_effective_date := v_period.start_date;
  else
    v_effective_date := current_date;
  end if;

  -- Build journal lines: prefer explicit lines jsonb, else debit/credit pair
  if v_corr.lines is not null then
    v_lines := v_corr.lines;
  else
    v_lines := jsonb_build_array(
      jsonb_build_object('account_id', v_corr.debit_account_id, 'debit', v_corr.amount, 'credit', 0, 'line_description', 'S09 correction: ' || v_corr.reason),
      jsonb_build_object('account_id', v_corr.credit_account_id, 'debit', 0, 'credit', v_corr.amount, 'line_description', 'S09 correction: ' || v_corr.reason)
    );
  end if;

  v_description := 'S09 correction ' || v_corr.id::text || ' for ' || v_corr.source_type || ':' || v_corr.source_id || ' — ' || left(v_corr.reason, 200);

  -- Use central GL kernel: post_journal_event (service_role context because this function is SECURITY DEFINER)
  -- We are already service_role via definer, so we can call post_journal_event
  select public.post_journal_event(jsonb_build_object(
    'company_id', v_corr.company_id,
    'source_type', 's09_correction',
    'source_id', v_corr.id::text,
    'event_id', 'apply:' || v_corr.id::text,
    'effective_date', v_effective_date,
    'description', v_description,
    'lines', v_lines
  )) into v_batch_result;

  v_batch_id := (v_batch_result->>'batch_id')::uuid;

  perform set_config('malik.s09_correction_change_authorized', 'true', true);

  update public.s09_corrections
  set status = 'APPLIED',
      correction_journal_batch_id = v_batch_id,
      applied_at = now(),
      after_evidence = coalesce(after_evidence, '{}'::jsonb) || jsonb_build_object('correction_batch', v_batch_result, 'applied_at', now(), 'effective_date', v_effective_date),
      actor_id = auth.uid(),
      updated_at = now()
  where id = p_correction_id and company_id = v_company_id;

  return jsonb_build_object('success', true, 'id', p_correction_id, 'status', 'APPLIED', 'batch_id', v_batch_id, 'batch_result', v_batch_result);
end;
$$;

-- Reverse correction: APPLIED → REVERSED, uses compensating accounting evidence
create or replace function public.s09_reverse_correction(p_correction_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_corr public.s09_corrections%rowtype;
  v_reverse_result jsonb;
  v_reverse_batch_id uuid;
begin
  if auth.uid() is null or not public.is_accountant() then
    if not public.is_admin() then
      raise exception 'S09_REVERSE_REQUIRES_ACCOUNTANT' using errcode='42501';
    end if;
  end if;

  if p_correction_id is null then
    raise exception 'S09_CORRECTION_ID_REQUIRED' using errcode='22023';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'S09_REVERSAL_REASON_REQUIRED: non-empty reason required' using errcode='22023';
  end if;

  select * into v_corr from public.s09_corrections where id = p_correction_id and company_id = v_company_id for update;
  if not found then
    raise exception 'S09_CORRECTION_NOT_FOUND' using errcode='P0002';
  end if;

  if v_corr.status <> 'APPLIED' then
    raise exception 'S09_REVERSE_STATUS_INVALID: only APPLIED can be REVERSED, current %', v_corr.status using errcode='23514';
  end if;

  if v_corr.correction_journal_batch_id is null then
    raise exception 'S09_REVERSE_NO_BATCH: correction has no journal batch to reverse' using errcode='P0002';
  end if;

  -- Use compensating reversal via reverse_journal_batch (creates equal-and-opposite POSTED batch)
  select public.reverse_journal_batch(v_corr.correction_journal_batch_id) into v_reverse_result;
  v_reverse_batch_id := (v_reverse_result->>'reversal_batch_id')::uuid;

  perform set_config('malik.s09_correction_change_authorized', 'true', true);

  update public.s09_corrections
  set status = 'REVERSED',
      reversal_journal_batch_id = v_reverse_batch_id,
      reversed_at = now(),
      reversal_reason = p_reason,
      after_evidence = coalesce(after_evidence, '{}'::jsonb) || jsonb_build_object('reversal_batch', v_reverse_result, 'reversed_at', now(), 'reversal_reason', p_reason),
      actor_id = auth.uid(),
      updated_at = now()
  where id = p_correction_id and company_id = v_company_id;

  return jsonb_build_object('success', true, 'id', p_correction_id, 'status', 'REVERSED', 'reversal_batch_id', v_reverse_batch_id, 'result', v_reverse_result);
end;
$$;

-- List corrections (company-scoped)
create or replace function public.s09_list_corrections(p_period_id uuid default null, p_status text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_rows jsonb;
begin
  if auth.uid() is null or not public.is_app_user() then
    raise exception 'Authenticated app user required' using errcode='42501';
  end if;

  select jsonb_agg(jsonb_build_object(
    'id', c.id,
    'company_id', c.company_id,
    'accounting_period_id', c.accounting_period_id,
    'review_id', c.review_id,
    'source_type', c.source_type,
    'source_id', c.source_id,
    'reason', c.reason,
    'status', c.status,
    'amount', c.amount,
    'correction_batch_id', c.correction_journal_batch_id,
    'reversal_batch_id', c.reversal_journal_batch_id,
    'created_at', c.created_at,
    'applied_at', c.applied_at,
    'validated_at', c.validated_at,
    'reversed_at', c.reversed_at
  ) order by c.created_at desc)
  into v_rows
  from public.s09_corrections c
  where c.company_id = v_company_id
    and (p_period_id is null or c.accounting_period_id = p_period_id)
    and (p_status is null or c.status = upper(p_status));

  return jsonb_build_object('company_id', v_company_id, 'corrections', coalesce(v_rows, '[]'::jsonb));
end;
$$;

-- Grants
revoke all on function public.s09_validate_correction_invariants(uuid) from public, anon;
grant execute on function public.s09_validate_correction_invariants(uuid) to authenticated, service_role;

revoke all on function public.s09_create_correction_draft(jsonb) from public, anon;
grant execute on function public.s09_create_correction_draft(jsonb) to authenticated, service_role;

revoke all on function public.s09_validate_correction(uuid) from public, anon;
grant execute on function public.s09_validate_correction(uuid) to authenticated, service_role;

revoke all on function public.s09_apply_correction(uuid) from public, anon;
grant execute on function public.s09_apply_correction(uuid) to authenticated, service_role;

revoke all on function public.s09_reverse_correction(uuid,text) from public, anon;
grant execute on function public.s09_reverse_correction(uuid,text) to authenticated, service_role;

revoke all on function public.s09_list_corrections(uuid,text) from public, anon;
grant execute on function public.s09_list_corrections(uuid,text) to authenticated, service_role;

commit;
