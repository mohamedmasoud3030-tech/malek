-- =============================================================================
-- WP-05 GAP-018 — Subledger↔GL variance diagnostics, reason codes and
--                 pending-approval correction proposals.
--
-- Context
--   GAP-013 (20260814040000) answers "is class X reconciled?" with PASS/FAIL and
--   a signed variance. It does not answer "why", and it offers no governed route
--   from a detected variance to an accounting decision.
--
-- What this migration adds (read-only analysis + governed proposal register):
--   1. public.wp05_gl_side_totals            — debit/credit split + COA presence
--   2. public.wp05_variance_diagnostics      — per-class reason code + evidence
--   3. public.wp05_correction_proposals      — append-only proposal register,
--                                              every row starts PENDING_APPROVAL
--   4. wp05_generate_correction_proposals    — deterministic, idempotent maker
--   5. wp05_approve/reject_correction_proposal — checker (maker≠checker)
--   6. wp05_list_correction_proposals        — company-scoped read
--   7. wp05_assert_no_unapproved_correction_postings — machine-checkable proof
--
-- Non-goals / hard guarantees:
--   * NOTHING here posts to the GL. post_journal_event / reverse_journal_batch
--     are not referenced anywhere in this file.
--   * No existing financial computation changes. GAP-013 balances are read, not
--     redefined, so no posted history moves as a side effect of diagnosis.
--   * Approving a proposal does NOT post anything. It only authorises Accounting
--     to open an S09 correction through the existing S08→S09 gate.
-- =============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. GL side totals — debit/credit split and chart-of-accounts presence
-- ---------------------------------------------------------------------------
create or replace function public.wp05_gl_side_totals(
  p_company_id uuid,
  p_account_no text,
  p_as_of date default current_date
)
returns table (debits numeric, credits numeric, line_count bigint, account_exists boolean)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_exists boolean;
begin
  if p_company_id is null or p_account_no is null then
    raise exception 'WP05_GL_SIDE_TOTALS_REQUIRED: company_id and account_no required' using errcode='22023';
  end if;

  select exists (
    select 1 from public.accounts a
    where a.company_id = p_company_id and a.no = p_account_no
  ) into v_exists;

  return query
  select
    public.wp05_round_omr(coalesce(sum(jl.debit), 0)),
    public.wp05_round_omr(coalesce(sum(jl.credit), 0)),
    count(*)::bigint,
    v_exists
  from public.journal_lines jl
  join public.journal_batches jb on jb.id = jl.batch_id
  join public.accounts a on a.id = jl.account_id and a.company_id = jl.company_id
  where jl.company_id = p_company_id
    and a.no = p_account_no
    and a.company_id = p_company_id
    and jb.company_id = p_company_id
    and jb.status in ('POSTED', 'REVERSED')
    and jb.effective_date <= p_as_of
    and jl.deleted_at is null;
end;
$$;

comment on function public.wp05_gl_side_totals(uuid, text, date) is
  'WP-05 GAP-018: debit/credit totals and COA presence for one account, company-scoped, OMR 3dp.';

-- ---------------------------------------------------------------------------
-- 2. Variance diagnostics — deterministic reason code per reconciliation class
--
-- Reason codes (stable vocabulary, ordered by classification priority):
--   RECONCILED                             abs(variance) <= 0.001
--   GL_ACCOUNT_MISSING_IN_COA              account_no absent from company COA
--   GL_NO_POSTINGS_FOR_ACCOUNT             account exists, zero posted lines
--   SUBLEDGER_MOVEMENT_NOT_POSTED_TO_GL    subledger movement has no GL counterpart
--   GL_CONTRA_BALANCE_ON_DEBIT_NORMAL      debit-normal account carries net credit
--   SUBLEDGER_OMITS_CREDIT_BALANCE_ROWS    helper floors negatives out of scope
--   GL_POSTINGS_WITHOUT_SUBLEDGER_ROWS     GL moved, subledger has no open rows
--   SUBLEDGER_SNAPSHOT_NOT_AS_OF           source has no as-of dimension
--   UNCLASSIFIED_VARIANCE                  none of the above matched
-- ---------------------------------------------------------------------------
create or replace function public.wp05_variance_diagnostics(
  p_company_id uuid default public.current_company_id(),
  p_as_of date default current_date
)
returns table (
  reconciliation_class text,
  account_no text,
  account_name text,
  subledger_balance numeric,
  gl_balance numeric,
  variance numeric,
  abs_variance numeric,
  currency text,
  reconciliation_status text,
  reason_code text,
  reason_detail text,
  proposal_type text,
  recommended_action text,
  evidence jsonb
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  r record;
  v_gl record;
  v_evidence jsonb;
  v_reason text;
  v_detail text;
  v_type text;
  v_action text;
  v_debit_normal boolean;
  -- tenant receivable extras
  v_credit_rows bigint;
  v_credit_amount numeric;
  v_open_rows bigint;
  -- deposit extras
  v_dep_total numeric;
  v_dep_deducted numeric;
  v_dep_refunded numeric;
  v_dep_remaining numeric;
  v_dep_undated bigint;
  v_dep_rows bigint;
  -- owner extras
  v_owner_rows bigint;
  v_owner_positive bigint;
  v_settlement_rows bigint;
  v_settlement_amount numeric;
  -- commission extras
  v_comm_rows bigint;
  v_comm_after_as_of bigint;
begin
  if p_company_id is null then
    raise exception 'WP05_DIAGNOSTICS_COMPANY_REQUIRED: company_id required' using errcode='22023';
  end if;

  if public.current_company_id() is not null
     and public.current_company_id() <> p_company_id
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'WP05_COMPANY_ISOLATION_VIOLATION' using errcode='42501';
  end if;

  for r in
    select * from public.wp05_reconcile_all(p_company_id, p_as_of)
  loop
    select * into v_gl from public.wp05_gl_side_totals(p_company_id, r.account_no, p_as_of);

    v_debit_normal := r.account_no in ('1201', '1300', '1111', '1120', '1600');
    v_evidence := jsonb_build_object(
      'company_id', p_company_id,
      'as_of', p_as_of,
      'account_no', r.account_no,
      'gl_debits', v_gl.debits,
      'gl_credits', v_gl.credits,
      'gl_line_count', v_gl.line_count,
      'gl_account_exists', v_gl.account_exists,
      'subledger_count', r.subledger_count,
      'normal_balance', case when v_debit_normal then 'debit' else 'credit' end
    );

    -- ---- class-specific evidence -----------------------------------------
    v_credit_rows := 0; v_credit_amount := 0; v_open_rows := 0;
    v_dep_total := 0; v_dep_deducted := 0; v_dep_refunded := 0; v_dep_remaining := 0;
    v_dep_undated := 0; v_dep_rows := 0;
    v_owner_rows := 0; v_owner_positive := 0; v_settlement_rows := 0; v_settlement_amount := 0;
    v_comm_rows := 0; v_comm_after_as_of := 0;

    if r.reconciliation_class = 'TENANT_RECEIVABLES' then
      select
        count(*) filter (where (i.amount + coalesce(i.tax_amount,0) - coalesce(i.paid_amount,0)) < -0.0005)::bigint,
        public.wp05_round_omr(coalesce(sum(
          case when (i.amount + coalesce(i.tax_amount,0) - coalesce(i.paid_amount,0)) < -0.0005
               then (i.amount + coalesce(i.tax_amount,0) - coalesce(i.paid_amount,0))
               else 0 end
        ), 0)),
        count(*) filter (where (i.amount + coalesce(i.tax_amount,0) - coalesce(i.paid_amount,0)) > 0.0005)::bigint
      into v_credit_rows, v_credit_amount, v_open_rows
      from public.invoices i
      where i.company_id = p_company_id
        and i.deleted_at is null
        and coalesce(upper(i.status::text), '') not in ('VOID', 'VOIDED', 'CANCELLED')
        and i.issue_date <= p_as_of;

      v_evidence := v_evidence || jsonb_build_object(
        'open_invoice_rows', v_open_rows,
        'credit_balance_invoice_rows', v_credit_rows,
        'credit_balance_invoice_amount', v_credit_amount
      );

    elsif r.reconciliation_class = 'SECURITY_DEPOSITS' then
      select
        count(*)::bigint,
        public.wp05_round_omr(coalesce(sum(td.deposit_amount), 0)),
        public.wp05_round_omr(coalesce(sum(td.deducted_amount), 0)),
        public.wp05_round_omr(coalesce(sum(td.refunded_amount), 0)),
        public.wp05_round_omr(coalesce(sum(td.remaining_amount), 0)),
        count(*) filter (where td.received_date is null)::bigint
      into v_dep_rows, v_dep_total, v_dep_deducted, v_dep_refunded, v_dep_remaining, v_dep_undated
      from public.tenant_deposits td
      where td.company_id = p_company_id
        and td.deleted_at is null;

      v_evidence := v_evidence || jsonb_build_object(
        'deposit_rows', v_dep_rows,
        'deposit_gross_total', v_dep_total,
        'deposit_deducted_total', v_dep_deducted,
        'deposit_refunded_total', v_dep_refunded,
        'deposit_remaining_total', v_dep_remaining,
        'deposit_rows_without_received_date', v_dep_undated,
        'deposit_applied_total', public.wp05_round_omr(v_dep_deducted + v_dep_refunded)
      );

    elsif r.reconciliation_class = 'OWNER_PAYABLES' then
      select count(*)::bigint, count(*) filter (where ob.net_balance > 0.0005)::bigint
      into v_owner_rows, v_owner_positive
      from public.owner_balances ob
      where ob.company_id = p_company_id;

      select count(*)::bigint, public.wp05_round_omr(coalesce(sum(s.net_payable), 0))
      into v_settlement_rows, v_settlement_amount
      from public.owner_settlements s
      where s.company_id = p_company_id
        and upper(coalesce(s.status::text, '')) in ('PENDING', 'APPROVED', 'PENDING_APPROVAL')
        and coalesce(s.net_payable, 0) > 0.0005;

      v_evidence := v_evidence || jsonb_build_object(
        'owner_balance_rows', v_owner_rows,
        'owner_balance_rows_positive', v_owner_positive,
        'owner_balances_has_as_of_dimension', false,
        'open_settlement_rows', v_settlement_rows,
        'open_settlement_net_payable', v_settlement_amount
      );

    elsif r.reconciliation_class = 'COMMISSION' then
      select
        count(*)::bigint,
        count(*) filter (where c.created_at::date > p_as_of)::bigint
      into v_comm_rows, v_comm_after_as_of
      from public.commissions c
      where c.company_id = p_company_id
        and upper(coalesce(c.status::text, '')) in ('PENDING', 'APPROVED', 'PAYABLE')
        and coalesce(c.amount, 0) > 0.0005;

      v_evidence := v_evidence || jsonb_build_object(
        'commission_rows', v_comm_rows,
        'commission_rows_created_after_as_of', v_comm_after_as_of,
        'commissions_has_as_of_dimension', false
      );
    end if;

    -- ---- deterministic classification -------------------------------------
    if r.reconciliation_status = 'PASS' then
      v_reason := 'RECONCILED';
      v_detail := format('Variance %s OMR is within the 0.001 tolerance.', r.variance);
      v_type := 'NONE';
      v_action := 'No action required.';

    elsif not v_gl.account_exists then
      v_reason := 'GL_ACCOUNT_MISSING_IN_COA';
      v_detail := format(
        'Account %s is not provisioned in this company chart of accounts, so the GL side of %s can only ever read 0.000 while the subledger reports %s OMR.',
        r.account_no, r.reconciliation_class, r.subledger_balance);
      v_type := 'MAPPING_FIX';
      v_action := format('Provision account %s via provision_company_chart_of_accounts, or re-point the %s reconciliation class at the account actually used by this company.',
        r.account_no, r.reconciliation_class);

    elsif v_gl.line_count = 0 then
      v_reason := 'GL_NO_POSTINGS_FOR_ACCOUNT';
      v_detail := format(
        'Account %s exists but carries zero posted journal lines up to %s, while the subledger reports %s OMR across %s row(s). The subledger balance was never recognised in the ledger.',
        r.account_no, p_as_of, r.subledger_balance, r.subledger_count);
      v_type := 'MISSING_GL_POSTING';
      v_action := 'Identify the business events behind the subledger rows and confirm whether their GL recognition was skipped, routed to a different account, or intentionally deferred.';

    elsif r.reconciliation_class = 'SECURITY_DEPOSITS'
          and (v_dep_deducted + v_dep_refunded) > 0.0005
          and abs(abs(r.variance) - public.wp05_round_omr(v_dep_deducted + v_dep_refunded)) <= 0.001
          and v_gl.debits <= 0.0005 then
      v_reason := 'SUBLEDGER_MOVEMENT_NOT_POSTED_TO_GL';
      v_detail := format(
        'Deposits show %s OMR deducted and %s OMR refunded, but account %s carries no offsetting debit. The deposit liability was reduced in the subledger without a matching GL entry, which is exactly the %s OMR variance.',
        v_dep_deducted, v_dep_refunded, r.account_no, abs(r.variance));
      v_type := 'MISSING_GL_POSTING';
      v_action := 'Reconstruct the deposit application/refund events and confirm whether their GL postings were never emitted; escalate to S09 only after Accounting approves.';

    elsif v_debit_normal and r.gl_balance < -0.001 then
      v_reason := 'GL_CONTRA_BALANCE_ON_DEBIT_NORMAL';
      v_detail := format(
        'Account %s is debit-normal but nets to %s OMR (debits %s, credits %s). Credits posted to a receivable account exceed the debits, so the ledger reports a liability where the subledger reports an asset.',
        r.account_no, r.gl_balance, v_gl.debits, v_gl.credits);
      v_type := 'INVESTIGATE_ONLY';
      v_action := 'Review the credit postings on this account: unapplied receipts, collections posted without an originating invoice, and reversals posted to the wrong side all produce this shape.';

    elsif r.reconciliation_class = 'TENANT_RECEIVABLES' and v_credit_rows > 0 then
      v_reason := 'SUBLEDGER_OMITS_CREDIT_BALANCE_ROWS';
      v_detail := format(
        '%s invoice(s) carry a credit balance totalling %s OMR. The receivables subledger helper floors outstanding amounts at zero, so over-collected invoices are dropped from the subledger while their GL effect remains.',
        v_credit_rows, v_credit_amount);
      v_type := 'SUBLEDGER_DATA_FIX';
      v_action := 'Decide with Accounting whether over-collections should be reclassified to a tenant-credit liability account instead of being floored out of the receivables subledger.';

    elsif r.subledger_count = 0 and v_gl.line_count > 0 then
      v_reason := 'GL_POSTINGS_WITHOUT_SUBLEDGER_ROWS';
      v_detail := format(
        'Account %s carries %s posted line(s) totalling %s OMR while the %s subledger has no qualifying open rows as of %s.',
        r.account_no, v_gl.line_count, r.gl_balance, r.reconciliation_class, p_as_of);
      v_type := 'INVESTIGATE_ONLY';
      v_action := 'Confirm whether the subledger rows were closed/settled without reversing the GL, or whether the GL postings belong to a different class.';

    elsif r.reconciliation_class in ('OWNER_PAYABLES', 'SECURITY_DEPOSITS', 'COMMISSION') then
      v_reason := 'SUBLEDGER_SNAPSHOT_NOT_AS_OF';
      v_detail := format(
        'The %s subledger source is a running snapshot with no as-of dimension, so it is compared against a GL balance that IS cut at %s. Any movement after the cut-off appears as variance.',
        r.reconciliation_class, p_as_of);
      v_type := 'INVESTIGATE_ONLY';
      v_action := 'Re-run the comparison at current_date. If the variance disappears, it is a cut-off artefact, not a posting defect.';

    else
      v_reason := 'UNCLASSIFIED_VARIANCE';
      v_detail := format(
        'Variance %s OMR on account %s does not match any known signature (debits %s, credits %s, subledger rows %s).',
        r.variance, r.account_no, v_gl.debits, v_gl.credits, r.subledger_count);
      v_type := 'INVESTIGATE_ONLY';
      v_action := 'Manual accounting review required; no automated signature matched.';
    end if;

    v_evidence := v_evidence || jsonb_build_object('reason_code', v_reason);

    reconciliation_class := r.reconciliation_class;
    account_no := r.account_no;
    account_name := r.account_name;
    subledger_balance := r.subledger_balance;
    gl_balance := r.gl_balance;
    variance := r.variance;
    abs_variance := r.abs_variance;
    currency := r.currency;
    reconciliation_status := r.reconciliation_status;
    reason_code := v_reason;
    reason_detail := v_detail;
    proposal_type := v_type;
    recommended_action := v_action;
    evidence := v_evidence;
    return next;
  end loop;

  return;
end;
$$;

comment on function public.wp05_variance_diagnostics(uuid, date) is
  'WP-05 GAP-018: read-only subledger↔GL variance diagnosis with a stable reason-code vocabulary and per-class evidence. Never writes.';

-- ---------------------------------------------------------------------------
-- 3. Correction proposal register — every row starts PENDING_APPROVAL
-- ---------------------------------------------------------------------------
create table if not exists public.wp05_correction_proposals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  accounting_period_id uuid references public.accounting_periods(id) on delete restrict,
  as_of date not null,
  reconciliation_class text not null,
  account_no text,
  reason_code text not null,
  reason_detail text not null,
  proposal_type text not null check (proposal_type in ('MAPPING_FIX', 'MISSING_GL_POSTING', 'SUBLEDGER_DATA_FIX', 'INVESTIGATE_ONLY')),
  recommended_action text not null,
  status text not null default 'PENDING_APPROVAL'
    check (status in ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
  subledger_balance numeric(18,3) not null,
  gl_balance numeric(18,3) not null,
  variance_amount numeric(18,3) not null,
  evidence jsonb not null default '{}'::jsonb,
  maker_user_id uuid,
  checker_user_id uuid,
  decided_at timestamptz,
  decision_note text,
  s09_correction_id uuid references public.s09_corrections(id) on delete restrict,
  request_id text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wp05_proposal_request_id_not_empty check (btrim(request_id) <> ''),
  constraint wp05_proposal_idempotency_not_empty check (btrim(idempotency_key) <> ''),
  constraint wp05_proposal_reason_not_empty check (btrim(reason_code) <> '' and btrim(reason_detail) <> ''),
  constraint wp05_proposal_decision_requires_checker check (
    status in ('PENDING_APPROVAL', 'SUPERSEDED') or checker_user_id is not null
  )
);

comment on table public.wp05_correction_proposals is
  'WP-05 GAP-018: append-only register of subledger↔GL variance findings. Rows are created PENDING_APPROVAL and never post to the GL; approval only authorises an S09 correction through the existing S08→S09 gate.';

create unique index if not exists wp05_correction_proposals_idempotency_uidx
  on public.wp05_correction_proposals (company_id, idempotency_key);
create unique index if not exists wp05_correction_proposals_request_uidx
  on public.wp05_correction_proposals (company_id, request_id, reconciliation_class);
create index if not exists wp05_correction_proposals_company_idx
  on public.wp05_correction_proposals (company_id);
create index if not exists wp05_correction_proposals_status_idx
  on public.wp05_correction_proposals (status);
create index if not exists wp05_correction_proposals_class_idx
  on public.wp05_correction_proposals (reconciliation_class, reason_code);

alter table public.wp05_correction_proposals enable row level security;
alter table public.wp05_correction_proposals alter column company_id set default public.current_company_id();

drop policy if exists p0_tenant_isolation on public.wp05_correction_proposals;
create policy p0_tenant_isolation on public.wp05_correction_proposals as restrictive
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists wp05_correction_proposals_read on public.wp05_correction_proposals;
create policy wp05_correction_proposals_read on public.wp05_correction_proposals
  for select to authenticated using (public.is_app_user());

drop policy if exists wp05_correction_proposals_write on public.wp05_correction_proposals;
create policy wp05_correction_proposals_write on public.wp05_correction_proposals
  for all to authenticated using (false) with check (false);

revoke all on public.wp05_correction_proposals from public, anon;
grant select on public.wp05_correction_proposals to authenticated;
grant all on public.wp05_correction_proposals to service_role;

drop trigger if exists trg_wp05_correction_proposals_updated_at on public.wp05_correction_proposals;
create trigger trg_wp05_correction_proposals_updated_at
  before update on public.wp05_correction_proposals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Immutability, lifecycle and maker–checker guard
-- ---------------------------------------------------------------------------
create or replace function public.guard_wp05_correction_proposal_writes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_authorized text := coalesce(current_setting('malik.wp05_proposal_change_authorized', true), '');
begin
  if tg_op = 'DELETE' then
    raise exception 'WP05_PROPOSAL_IMMUTABLE: correction proposals are append-only and cannot be deleted.' using errcode='42501';
  end if;

  if tg_op = 'UPDATE' then
    if v_authorized <> 'true' then
      raise exception 'WP05_PROPOSAL_IMMUTABLE: direct updates forbidden, use the wp05_*_correction_proposal RPCs.' using errcode='42501';
    end if;

    if old.company_id is distinct from new.company_id then
      raise exception 'WP05_PROPOSAL_IMMUTABLE_FIELD: company_id cannot be changed' using errcode='42501';
    end if;
    if old.as_of is distinct from new.as_of
       or old.reconciliation_class is distinct from new.reconciliation_class
       or old.account_no is distinct from new.account_no then
      raise exception 'WP05_PROPOSAL_IMMUTABLE_FIELD: reconciliation scope cannot be changed' using errcode='42501';
    end if;
    if old.reason_code is distinct from new.reason_code
       or old.variance_amount is distinct from new.variance_amount
       or old.subledger_balance is distinct from new.subledger_balance
       or old.gl_balance is distinct from new.gl_balance then
      raise exception 'WP05_PROPOSAL_IMMUTABLE_FIELD: finding and balances are immutable evidence' using errcode='42501';
    end if;
    if old.evidence is distinct from new.evidence then
      raise exception 'WP05_PROPOSAL_IMMUTABLE_FIELD: evidence is immutable' using errcode='42501';
    end if;
    if old.maker_user_id is distinct from new.maker_user_id then
      raise exception 'WP05_PROPOSAL_IMMUTABLE_FIELD: maker_user_id cannot be changed' using errcode='42501';
    end if;
    if old.request_id is distinct from new.request_id
       or old.idempotency_key is distinct from new.idempotency_key then
      raise exception 'WP05_PROPOSAL_IMMUTABLE_FIELD: idempotency identity cannot be changed' using errcode='42501';
    end if;

    if old.status <> new.status then
      if old.status <> 'PENDING_APPROVAL' then
        raise exception 'WP05_PROPOSAL_LIFECYCLE_TERMINAL: % is terminal, cannot move to %', old.status, new.status using errcode='23514';
      end if;
      if new.status not in ('APPROVED', 'REJECTED', 'SUPERSEDED') then
        raise exception 'WP05_PROPOSAL_LIFECYCLE_ILLEGAL: PENDING_APPROVAL can only move to APPROVED, REJECTED or SUPERSEDED, got %', new.status using errcode='23514';
      end if;
      if new.status in ('APPROVED', 'REJECTED') then
        if new.checker_user_id is null then
          raise exception 'WP05_PROPOSAL_CHECKER_REQUIRED: a checker is required to decide a proposal' using errcode='42501';
        end if;
        if new.maker_user_id is not null and new.checker_user_id = new.maker_user_id then
          raise exception 'WP05_PROPOSAL_MAKER_CHECKER_VIOLATION: the checker must differ from the maker' using errcode='42501';
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_wp05_correction_proposal_writes on public.wp05_correction_proposals;
create trigger guard_wp05_correction_proposal_writes
  before update or delete on public.wp05_correction_proposals
  for each row execute function public.guard_wp05_correction_proposal_writes();

-- ---------------------------------------------------------------------------
-- 5. Maker — deterministic, idempotent proposal generation
-- ---------------------------------------------------------------------------
create or replace function public.wp05_generate_correction_proposals(
  p_as_of date default current_date,
  p_request_id text default null,
  p_accounting_period_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_request_id text;
  v_row record;
  v_key text;
  v_id uuid;
  v_created int := 0;
  v_existing int := 0;
  v_reconciled int := 0;
  v_results jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'WP05_PROPOSAL_MAKER_ROLE_REQUIRED: ADMIN or MANAGER required to generate correction proposals' using errcode='42501';
  end if;

  v_request_id := coalesce(nullif(btrim(coalesce(p_request_id, '')), ''),
                           'wp05-diag:' || v_company_id::text || ':' || p_as_of::text);

  if p_accounting_period_id is not null
     and not exists (select 1 from public.accounting_periods ap
                     where ap.id = p_accounting_period_id and ap.company_id = v_company_id) then
    raise exception 'WP05_PROPOSAL_PERIOD_NOT_FOUND: accounting period % not found for company %', p_accounting_period_id, v_company_id using errcode='P0002';
  end if;

  for v_row in
    select * from public.wp05_variance_diagnostics(v_company_id, p_as_of)
  loop
    if v_row.reconciliation_status = 'PASS' then
      v_reconciled := v_reconciled + 1;
      continue;
    end if;

    -- Deterministic identity: same company, cut-off, class, reason and variance
    -- always resolves to the same proposal row.
    v_key := encode(sha256(convert_to(
      v_company_id::text || '|' || p_as_of::text || '|' || v_row.reconciliation_class || '|' ||
      coalesce(v_row.account_no, '') || '|' || v_row.reason_code || '|' ||
      to_char(v_row.variance, 'FM9999999999990.000'), 'UTF8')), 'hex');

    select id into v_id
    from public.wp05_correction_proposals
    where company_id = v_company_id and idempotency_key = v_key;

    if v_id is not null then
      v_existing := v_existing + 1;
      v_results := v_results || jsonb_build_object(
        'id', v_id,
        'reconciliation_class', v_row.reconciliation_class,
        'reason_code', v_row.reason_code,
        'idempotent', true
      );
      continue;
    end if;

    insert into public.wp05_correction_proposals (
      company_id, accounting_period_id, as_of, reconciliation_class, account_no,
      reason_code, reason_detail, proposal_type, recommended_action, status,
      subledger_balance, gl_balance, variance_amount, evidence,
      maker_user_id, request_id, idempotency_key
    ) values (
      v_company_id, p_accounting_period_id, p_as_of, v_row.reconciliation_class, v_row.account_no,
      v_row.reason_code, v_row.reason_detail, v_row.proposal_type, v_row.recommended_action, 'PENDING_APPROVAL',
      v_row.subledger_balance, v_row.gl_balance, v_row.variance, v_row.evidence,
      auth.uid(), v_request_id, v_key
    )
    returning id into v_id;

    v_created := v_created + 1;
    v_results := v_results || jsonb_build_object(
      'id', v_id,
      'reconciliation_class', v_row.reconciliation_class,
      'reason_code', v_row.reason_code,
      'proposal_type', v_row.proposal_type,
      'variance', v_row.variance,
      'status', 'PENDING_APPROVAL',
      'idempotent', false
    );

    insert into public.audit_log (
      id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at, new_value
    ) values (
      gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
      (select email from auth.users where id = auth.uid()),
      'WP05_PROPOSAL_CREATED', 'wp05_correction_proposals', v_id::text,
      format('Variance proposal raised for %s (%s), left PENDING_APPROVAL; no GL posting performed.',
             v_row.reconciliation_class, v_row.reason_code),
      'wp05_correction_proposals',
      left(v_row.evidence::text, 4000), now(),
      jsonb_build_object('status', 'PENDING_APPROVAL', 'reason_code', v_row.reason_code,
                         'variance', v_row.variance, 'as_of', p_as_of)
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'as_of', p_as_of,
    'request_id', v_request_id,
    'created', v_created,
    'already_present', v_existing,
    'reconciled_classes', v_reconciled,
    'posted_to_gl', false,
    'proposals', v_results
  );
end;
$$;

comment on function public.wp05_generate_correction_proposals(date, text, uuid) is
  'WP-05 GAP-018: maker step. Turns FAIL reconciliation classes into PENDING_APPROVAL proposals. Deterministic and idempotent; performs no GL posting.';

-- ---------------------------------------------------------------------------
-- 6. Checker — approve / reject. Approval never posts.
-- ---------------------------------------------------------------------------
create or replace function public.wp05_approve_correction_proposal(
  p_proposal_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_row public.wp05_correction_proposals%rowtype;
begin
  if auth.uid() is null or not (public.is_accountant() or public.is_admin()) then
    raise exception 'WP05_PROPOSAL_CHECKER_ROLE_REQUIRED: ACCOUNTANT or ADMIN required to approve a correction proposal' using errcode='42501';
  end if;
  if p_proposal_id is null then
    raise exception 'WP05_PROPOSAL_ID_REQUIRED' using errcode='22023';
  end if;

  select * into v_row
  from public.wp05_correction_proposals
  where id = p_proposal_id and company_id = v_company_id
  for update;

  if not found then
    raise exception 'WP05_PROPOSAL_NOT_FOUND: proposal % not found for company %', p_proposal_id, v_company_id using errcode='P0002';
  end if;
  if v_row.status <> 'PENDING_APPROVAL' then
    raise exception 'WP05_PROPOSAL_STATUS_INVALID: only PENDING_APPROVAL can be approved, current %', v_row.status using errcode='23514';
  end if;
  if v_row.maker_user_id is not null and v_row.maker_user_id = auth.uid() then
    raise exception 'WP05_PROPOSAL_MAKER_CHECKER_VIOLATION: the maker of a proposal cannot approve it' using errcode='42501';
  end if;

  perform set_config('malik.wp05_proposal_change_authorized', 'true', true);

  update public.wp05_correction_proposals
  set status = 'APPROVED',
      checker_user_id = auth.uid(),
      decided_at = now(),
      decision_note = nullif(btrim(coalesce(p_note, '')), ''),
      updated_at = now()
  where id = p_proposal_id and company_id = v_company_id;

  perform set_config('malik.wp05_proposal_change_authorized', 'false', true);

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at, old_value, new_value
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'WP05_PROPOSAL_APPROVED', 'wp05_correction_proposals', p_proposal_id::text,
    'Proposal approved for accounting action. Approval authorises an S09 correction; it does not post to the GL.',
    'wp05_correction_proposals', left(coalesce(p_note, ''), 4000), now(),
    jsonb_build_object('status', 'PENDING_APPROVAL'),
    jsonb_build_object('status', 'APPROVED', 'checker_user_id', auth.uid())
  );

  return jsonb_build_object(
    'success', true,
    'id', p_proposal_id,
    'status', 'APPROVED',
    'posted_to_gl', false,
    'next_step', 's09_create_correction_draft against an APPROVED S08 frozen review'
  );
end;
$$;

create or replace function public.wp05_reject_correction_proposal(
  p_proposal_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_row public.wp05_correction_proposals%rowtype;
begin
  if auth.uid() is null or not (public.is_accountant() or public.is_admin()) then
    raise exception 'WP05_PROPOSAL_CHECKER_ROLE_REQUIRED: ACCOUNTANT or ADMIN required to reject a correction proposal' using errcode='42501';
  end if;
  if p_proposal_id is null then
    raise exception 'WP05_PROPOSAL_ID_REQUIRED' using errcode='22023';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'WP05_PROPOSAL_REJECTION_REASON_REQUIRED: non-empty reason required' using errcode='22023';
  end if;

  select * into v_row
  from public.wp05_correction_proposals
  where id = p_proposal_id and company_id = v_company_id
  for update;

  if not found then
    raise exception 'WP05_PROPOSAL_NOT_FOUND: proposal % not found for company %', p_proposal_id, v_company_id using errcode='P0002';
  end if;
  if v_row.status <> 'PENDING_APPROVAL' then
    raise exception 'WP05_PROPOSAL_STATUS_INVALID: only PENDING_APPROVAL can be rejected, current %', v_row.status using errcode='23514';
  end if;

  perform set_config('malik.wp05_proposal_change_authorized', 'true', true);

  update public.wp05_correction_proposals
  set status = 'REJECTED',
      checker_user_id = auth.uid(),
      decided_at = now(),
      decision_note = btrim(p_reason),
      updated_at = now()
  where id = p_proposal_id and company_id = v_company_id;

  perform set_config('malik.wp05_proposal_change_authorized', 'false', true);

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at, old_value, new_value
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'WP05_PROPOSAL_REJECTED', 'wp05_correction_proposals', p_proposal_id::text,
    'Proposal rejected by Accounting; no GL posting performed.',
    'wp05_correction_proposals', left(p_reason, 4000), now(),
    jsonb_build_object('status', 'PENDING_APPROVAL'),
    jsonb_build_object('status', 'REJECTED', 'checker_user_id', auth.uid())
  );

  return jsonb_build_object('success', true, 'id', p_proposal_id, 'status', 'REJECTED', 'posted_to_gl', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Company-scoped read
-- ---------------------------------------------------------------------------
create or replace function public.wp05_list_correction_proposals(
  p_status text default null,
  p_as_of date default null
)
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
    'id', p.id,
    'company_id', p.company_id,
    'as_of', p.as_of,
    'reconciliation_class', p.reconciliation_class,
    'account_no', p.account_no,
    'reason_code', p.reason_code,
    'reason_detail', p.reason_detail,
    'proposal_type', p.proposal_type,
    'recommended_action', p.recommended_action,
    'status', p.status,
    'subledger_balance', p.subledger_balance,
    'gl_balance', p.gl_balance,
    'variance_amount', p.variance_amount,
    'evidence', p.evidence,
    'maker_user_id', p.maker_user_id,
    'checker_user_id', p.checker_user_id,
    'decided_at', p.decided_at,
    'decision_note', p.decision_note,
    's09_correction_id', p.s09_correction_id,
    'created_at', p.created_at
  ) order by p.created_at desc, p.reconciliation_class)
  into v_rows
  from public.wp05_correction_proposals p
  where p.company_id = v_company_id
    and (p_status is null or p.status = upper(p_status))
    and (p_as_of is null or p.as_of = p_as_of);

  return jsonb_build_object('company_id', v_company_id, 'proposals', coalesce(v_rows, '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Machine-checkable proof that no unapproved correction ever posted
--
-- Returns success=false (and the offending rows) if any GL batch was posted
-- from the correction lanes without a fully approved control chain.
-- ---------------------------------------------------------------------------
create or replace function public.wp05_assert_no_unapproved_correction_postings(
  p_company_id uuid default public.current_company_id()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_proposal_batches int;
  v_unapproved_s09 int;
  v_pending int;
  v_approved int;
  v_rejected int;
  v_offenders jsonb;
begin
  if p_company_id is null then
    raise exception 'WP05_PROOF_COMPANY_REQUIRED: company_id required' using errcode='22023';
  end if;

  if public.current_company_id() is not null
     and public.current_company_id() <> p_company_id
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'WP05_COMPANY_ISOLATION_VIOLATION' using errcode='42501';
  end if;

  -- (a) The proposal lane must never appear as a GL source.
  select count(*)::int into v_proposal_batches
  from public.journal_batches jb
  where jb.company_id = p_company_id
    and jb.source_type in ('wp05_correction_proposal', 'wp05_variance_correction');

  -- (b) Every posted S09 correction must trace to an APPROVED S08 review.
  select count(*)::int into v_unapproved_s09
  from public.s09_corrections c
  join public.s08_frozen_reviews r on r.id = c.review_id
  where c.company_id = p_company_id
    and c.status = 'APPLIED'
    and r.reviewer_decision is distinct from 'APPROVED';

  select
    count(*) filter (where status = 'PENDING_APPROVAL')::int,
    count(*) filter (where status = 'APPROVED')::int,
    count(*) filter (where status = 'REJECTED')::int
  into v_pending, v_approved, v_rejected
  from public.wp05_correction_proposals
  where company_id = p_company_id;

  select coalesce(jsonb_agg(jsonb_build_object('batch_id', jb.id, 'source_type', jb.source_type, 'source_id', jb.source_id)), '[]'::jsonb)
  into v_offenders
  from public.journal_batches jb
  where jb.company_id = p_company_id
    and jb.source_type in ('wp05_correction_proposal', 'wp05_variance_correction');

  return jsonb_build_object(
    'success', (v_proposal_batches = 0 and v_unapproved_s09 = 0),
    'company_id', p_company_id,
    'proposal_sourced_gl_batches', v_proposal_batches,
    'applied_s09_without_approved_s08', v_unapproved_s09,
    'proposals_pending_approval', v_pending,
    'proposals_approved', v_approved,
    'proposals_rejected', v_rejected,
    'offending_batches', v_offenders
  );
end;
$$;

comment on function public.wp05_assert_no_unapproved_correction_postings(uuid) is
  'WP-05 GAP-018: proof function. success=true means no GL batch originated from the proposal lane and every APPLIED S09 correction traces to an APPROVED S08 review.';

-- ---------------------------------------------------------------------------
-- 9. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.wp05_gl_side_totals(uuid, text, date) from public, anon;
grant execute on function public.wp05_gl_side_totals(uuid, text, date) to authenticated, service_role;

revoke all on function public.wp05_variance_diagnostics(uuid, date) from public, anon;
grant execute on function public.wp05_variance_diagnostics(uuid, date) to authenticated, service_role;

revoke all on function public.guard_wp05_correction_proposal_writes() from public, anon;

revoke all on function public.wp05_generate_correction_proposals(date, text, uuid) from public, anon;
grant execute on function public.wp05_generate_correction_proposals(date, text, uuid) to authenticated, service_role;

revoke all on function public.wp05_approve_correction_proposal(uuid, text) from public, anon;
grant execute on function public.wp05_approve_correction_proposal(uuid, text) to authenticated, service_role;

revoke all on function public.wp05_reject_correction_proposal(uuid, text) from public, anon;
grant execute on function public.wp05_reject_correction_proposal(uuid, text) to authenticated, service_role;

revoke all on function public.wp05_list_correction_proposals(text, date) from public, anon;
grant execute on function public.wp05_list_correction_proposals(text, date) to authenticated, service_role;

revoke all on function public.wp05_assert_no_unapproved_correction_postings(uuid) from public, anon;
grant execute on function public.wp05_assert_no_unapproved_correction_postings(uuid) to authenticated, service_role;

commit;
