-- =============================================================================
-- Stage 3 — General Ledger Core (2/3): canonical journal batches and lines.
--
-- Consolidates the legacy single-table ledger (public.journal_entries) into ONE
-- canonical GL model:
--
--   journal_batches  — controlled, company-scoped batches with DRAFT / POSTED /
--                      REVERSED lifecycle, business-event traceability and a
--                      database-enforced idempotency key
--                      (company_id, source_type, source_id, event_id).
--   journal_lines    — immutable lines with exact numeric(18,3) debit/credit
--                      (OMR precision 3), company-consistency composite FKs.
--   journal_entries  — becomes a read-only compatibility VIEW over the
--                      canonical tables (security_invoker = true) so every
--                      existing report RPC, legacy business RPC and release
--                      rehearsal keeps working unchanged. Legacy INSERTs that
--                      still flow through the view are routed by an INSTEAD OF
--                      trigger into canonical batches/lines, but ONLY when the
--                      caller is a trusted server context (postgres/service
--                      role); browser writes remain impossible.
--   journal_entries_archive — the historical table, renamed and frozen. No
--                      posted history is deleted or rewritten anywhere.
--
-- Balance is enforced by DEFERRABLE constraint triggers (checked at COMMIT):
-- any batch that ends a transaction in POSTED/REVERSED state whose rounded
-- debits do not exactly equal rounded credits aborts the whole transaction —
-- application validation cannot be bypassed.
--
-- Backfill is deterministic and idempotent: legacy lines are grouped by
-- (company, batch_id) when present, otherwise by the business-event identity
-- (company, source_id, entity_type, entity_id, date, status). Groups that
-- balance are POSTED; groups that do not (pre-existing data anomalies) are
-- marked DRAFT so they are visible but never represented as posted, and the
-- migration never fails on pre-existing data.
--
-- Forward-only. Manual rollback:
--   supabase/rollback/20260804_rollback_stage3_gl_core_journal_batches_and_lines.sql
-- =============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. journal_batches
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.journal_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  status text not null default 'DRAFT',
  source_type text not null,
  source_id text not null default '',
  event_id text not null,
  reversal_of_batch_id uuid references public.journal_batches(id) on delete restrict,
  -- True for batches created by the legacy journal_entries compatibility path
  -- or the Stage 3 backfill. Such batches predate accounting periods and are
  -- exempt from the resolved-period clause only; every engine-created batch
  -- (is_legacy_compat = false) must carry a resolved accounting period.
  is_legacy_compat boolean not null default false,
  effective_date date not null,
  accounting_period_id uuid references public.accounting_periods(id) on delete restrict,
  period_resolution_reason text,
  posted_at timestamptz,
  posted_by uuid,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  constraint journal_batches_status_chk
    check (status in ('DRAFT', 'POSTED', 'REVERSED')),
  -- A batch may only be marked REVERSED when it points at the reversal batch
  -- that replaced it (traceability both ways).
  constraint journal_batches_reversed_requires_reversal_chk
    check (status <> 'REVERSED' or reversal_of_batch_id is not null),
  -- A batch cannot reverse itself.
  constraint journal_batches_no_self_reversal_chk
    check (reversal_of_batch_id is null or reversal_of_batch_id <> id),
  -- POSTED/REVERSED batches require full business-event traceability, a
  -- resolved accounting period and a posting timestamp. Legacy backfilled
  -- batches (source_type = 'legacy') predate accounting periods and keep a
  -- NULL period — they are exempt from the period clause only.
  constraint journal_batches_posted_traceability_chk
    check (
      status not in ('POSTED', 'REVERSED')
      or (
        btrim(source_type) <> ''
        and btrim(event_id) <> ''
        and posted_at is not null
        and (
          is_legacy_compat
          or (
            btrim(source_id) <> ''
            and accounting_period_id is not null
          )
        )
      )
    ),
  -- Idempotency: the same business event can never be posted twice for the
  -- same company, and different companies never collide on the same event id.
  constraint journal_batches_event_uidx unique (company_id, source_type, source_id, event_id)
);

comment on table public.journal_batches is
  'Stage 3 canonical journal batch. Posted batches are immutable; corrections use reversal batches.';

comment on column public.journal_batches.event_id is
  'Deterministic business-event identifier (never a timestamp or random value). The unique (company_id, source_type, source_id, event_id) key makes posting idempotent at the database level.';

comment on column public.journal_batches.period_resolution_reason is
  'Why the resolved accounting period differs from the effective date: open_period_contains_date, or redirected_earliest_open_period.';

-- Composite key so journal_lines can enforce company consistency in the FK.
create unique index if not exists journal_batches_id_company_uidx
  on public.journal_batches (id, company_id);

create index if not exists journal_batches_company_status_idx
  on public.journal_batches (company_id, status);
create index if not exists journal_batches_period_idx
  on public.journal_batches (accounting_period_id);
create index if not exists journal_batches_reversal_of_idx
  on public.journal_batches (reversal_of_batch_id)
  where reversal_of_batch_id is not null;

-- Lifecycle trigger: DRAFT -> POSTED -> REVERSED only; posted data is never
-- editable, deletable, or re-draftable; company_id is immutable.
create or replace function public.guard_journal_batch_lifecycle()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'DRAFT' then
      raise exception 'JOURNAL_BATCH_IMMUTABLE: posted or reversed batches cannot be deleted. Corrections use reversal batches.' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.company_id is distinct from new.company_id then
      raise exception 'JOURNAL_BATCH_COMPANY_IMMUTABLE: a batch cannot be moved to another company.' using errcode = '42501';
    end if;

    if old.status = 'REVERSED' and new.status is distinct from 'REVERSED' then
      raise exception 'JOURNAL_BATCH_LIFECYCLE: a REVERSED batch cannot change status.' using errcode = '42501';
    end if;

    if old.status = 'POSTED' and new.status <> 'REVERSED' then
      raise exception 'JOURNAL_BATCH_LIFECYCLE: a POSTED batch can only transition to REVERSED.' using errcode = '42501';
    end if;

    if old.status = 'DRAFT' and new.status = 'REVERSED' then
      raise exception 'JOURNAL_BATCH_LIFECYCLE: a DRAFT batch must be posted before it can be reversed.' using errcode = '42501';
    end if;

    -- Defense in depth: marking a batch REVERSED requires a real, valid
    -- reversal batch that references this batch. The engine creates one; a
    -- privileged direct writer cannot fabricate the transition.
    if new.status = 'REVERSED' and not exists (
      select 1 from public.journal_batches r
       where r.id = new.reversal_of_batch_id
         and r.source_type = 'journal_reversal'
         and r.source_id = old.id::text
    ) then
      raise exception 'JOURNAL_BATCH_REVERSAL_REQUIRED: a batch can only be marked REVERSED with a valid reversal batch referencing it (reverse_journal_batch).' using errcode = '42501';
    end if;

    if old.status = 'POSTED' and (
      new.effective_date is distinct from old.effective_date
      or new.source_type is distinct from old.source_type
      or new.source_id is distinct from old.source_id
      or new.event_id is distinct from old.event_id
      or new.accounting_period_id is distinct from old.accounting_period_id
    ) then
      raise exception 'JOURNAL_BATCH_IMMUTABLE: posted batch identity and period cannot change.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists guard_journal_batch_lifecycle on public.journal_batches;
create trigger guard_journal_batch_lifecycle
  before update or delete on public.journal_batches
  for each row execute function public.guard_journal_batch_lifecycle();

alter function public.guard_journal_batch_lifecycle() owner to postgres;
revoke all on function public.guard_journal_batch_lifecycle() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. journal_lines
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.journal_lines (
  id text primary key,
  no text,
  date text,
  batch_id uuid not null,
  company_id uuid not null references public.companies(id) on delete restrict,
  account_id text not null,
  debit numeric(18,3) not null default 0,
  credit numeric(18,3) not null default 0,
  line_description text,
  ref_source_id text,
  ref_entity_type text,
  ref_entity_id text,
  request_id text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  -- A line is exactly one side: a positive debit XOR a positive credit.
  constraint journal_lines_debit_credit_chk
    check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0)),
  -- Exact three-decimal monetary contract (OMR precision 3, C7).
  constraint journal_lines_precision_chk
    check (debit = round(debit, 3) and credit = round(credit, 3)),
  -- Company consistency is enforced by composite FKs (FA-003 pattern): the
  -- batch and the account must belong to the SAME company as the line.
  constraint journal_lines_batch_company_fkey
    foreign key (batch_id, company_id)
    references public.journal_batches (id, company_id)
    on delete restrict,
  constraint journal_lines_account_company_fkey
    foreign key (account_id, company_id)
    references public.accounts (id, company_id)
    on delete restrict
);

comment on table public.journal_lines is
  'Stage 3 canonical journal line. Posted lines are immutable; corrections use reversal batches.';

create index if not exists journal_lines_batch_idx
  on public.journal_lines (batch_id);
create index if not exists journal_lines_company_account_idx
  on public.journal_lines (company_id, account_id);
create index if not exists journal_lines_source_idx
  on public.journal_lines (ref_source_id, ref_entity_type);

-- Immutability: once the owning batch is POSTED/REVERSED, lines cannot be
-- updated, deleted, or moved; company_id is immutable; batch_id is immutable
-- once posted.
create or replace function public.guard_journal_line_immutability()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_status text;
  v_company uuid;
begin
  select b.status, b.company_id into v_status, v_company
    from public.journal_batches b
   where b.id = coalesce(new.batch_id, old.batch_id);

  if v_status is null then
    raise exception 'JOURNAL_LINE_ORPHAN: journal line has no batch.' using errcode = '23503';
  end if;

  if tg_op = 'DELETE' then
    if v_status <> 'DRAFT' then
      raise exception 'JOURNAL_LINE_IMMUTABLE: lines of posted or reversed batches cannot be deleted.' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if v_status <> 'DRAFT' then
      raise exception 'JOURNAL_LINE_IMMUTABLE: lines of posted or reversed batches cannot be changed. Corrections use reversal batches.' using errcode = '42501';
    end if;
    if old.company_id is distinct from new.company_id then
      raise exception 'JOURNAL_LINE_COMPANY_IMMUTABLE: a line cannot be moved to another company.' using errcode = '42501';
    end if;
    if old.batch_id is distinct from new.batch_id then
      raise exception 'JOURNAL_LINE_BATCH_IMMUTABLE: a line cannot be moved to another batch after creation.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists guard_journal_line_immutability on public.journal_lines;
create trigger guard_journal_line_immutability
  before update or delete on public.journal_lines
  for each row execute function public.guard_journal_line_immutability();

alter function public.guard_journal_line_immutability() owner to postgres;
revoke all on function public.guard_journal_line_immutability() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Balance enforcement — DEFERRABLE constraint triggers (checked at COMMIT)
-- ─────────────────────────────────────────────────────────────────────────────
-- Validates every batch whose lines or status changed in the transaction.
-- POSTED/REVERSED batches must have exact three-decimal balance:
--   total(debit) = total(credit)  after canonical rounding (round(x, 3)).
create or replace function public.gl_assert_batch_balance()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_batch_id uuid;
  v_status text;
  v_debit_total numeric;
  v_credit_total numeric;
begin
  -- The function backs two constraint triggers: on journal_lines (row carries
  -- batch_id) and on journal_batches (row carries id).
  if tg_op in ('INSERT', 'UPDATE') then
    if tg_table_name = 'journal_batches' then
      v_batch_id := new.id;
    else
      v_batch_id := new.batch_id;
    end if;
  else
    if tg_table_name = 'journal_batches' then
      v_batch_id := old.id;
    else
      v_batch_id := old.batch_id;
    end if;
  end if;

  select b.status into v_status
    from public.journal_batches b
   where b.id = v_batch_id;

  if v_status is null or v_status = 'DRAFT' then
    return null;
  end if;

  select round(coalesce(sum(debit), 0), 3), round(coalesce(sum(credit), 0), 3)
    into v_debit_total, v_credit_total
    from public.journal_lines
   where batch_id = v_batch_id
     and deleted_at is null;

  if v_debit_total <> v_credit_total then
    raise exception 'JOURNAL_BATCH_UNBALANCED: batch % has debits % and credits % after three-decimal rounding. A posted batch must balance exactly.', v_batch_id, v_debit_total, v_credit_total
      using errcode = 'P0001';
  end if;

  return null;
end;
$function$;

alter function public.gl_assert_batch_balance() owner to postgres;
revoke all on function public.gl_assert_batch_balance() from public, anon, authenticated;

drop trigger if exists gl_assert_batch_balance_on_lines on public.journal_lines;
create constraint trigger gl_assert_batch_balance_on_lines
  after insert or update or delete on public.journal_lines
  deferrable initially deferred
  for each row execute function public.gl_assert_batch_balance();

drop trigger if exists gl_assert_batch_balance_on_batches on public.journal_batches;
create constraint trigger gl_assert_batch_balance_on_batches
  after insert or update of status on public.journal_batches
  deferrable initially deferred
  for each row execute function public.gl_assert_batch_balance();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS on the canonical ledger tables (before the backfill so no DDL runs on tables with pending deferred-trigger events)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.journal_batches enable row level security;
alter table public.journal_batches alter column company_id set default public.current_company_id();
alter table public.journal_lines enable row level security;
alter table public.journal_lines alter column company_id set default public.current_company_id();

-- Restrictive tenant isolation (same policy shape as every P0 table).
drop policy if exists p0_tenant_isolation on public.journal_batches;
create policy p0_tenant_isolation on public.journal_batches as restrictive
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists p0_tenant_isolation on public.journal_lines;
create policy p0_tenant_isolation on public.journal_lines as restrictive
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- Read-only for authenticated ADMIN/MANAGER (mirrors the historical
-- admin_read_journal_entries policy; the compatibility view inherits this).
drop policy if exists gl_read_journal_batches on public.journal_batches;
create policy gl_read_journal_batches on public.journal_batches
  for select to authenticated using (public.is_admin_or_manager());

drop policy if exists gl_read_journal_lines on public.journal_lines;
create policy gl_read_journal_lines on public.journal_lines
  for select to authenticated using (public.is_admin_or_manager());

-- No browser writes: the only write path is the server-side posting engine.
drop policy if exists no_browser_write_journal_batches on public.journal_batches;
create policy no_browser_write_journal_batches on public.journal_batches
  for all to authenticated using (false) with check (false);

drop policy if exists no_browser_write_journal_lines on public.journal_lines;
create policy no_browser_write_journal_lines on public.journal_lines
  for all to authenticated using (false) with check (false);

revoke all on public.journal_batches from public, anon;
revoke all on public.journal_lines from public, anon;
grant select on public.journal_batches to authenticated;
grant select on public.journal_lines to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Backfill: migrate every legacy journal_entries row into canonical
--    batches/lines. Deterministic grouping; never fails on pre-existing data.
-- ─────────────────────────────────────────────────────────────────────────────
do $backfill$
declare
  v_group record;
  v_batch_id uuid;
  v_check_id uuid;
  v_status text;
  v_rows integer;
  v_batches_created integer := 0;
  v_lines_created bigint := 0;
  v_bad_rows integer := 0;
begin
  for v_group in
    select
      g.company_id,
      g.batch_id,
      g.source_type,
      g.source_id,
      g.event_id,
      g.effective_date,
      g.posted_at,
      g.all_draft,
      g.bad_rows,
      g.debit_total,
      g.credit_total
    from (
      select
        je.company_id,
        je.batch_id,
        coalesce(nullif(je.entity_type, ''), 'legacy') as source_type,
        coalesce(je.source_id, '') as source_id,
        coalesce(
          je.batch_id::text,
          'legacy-auto:' || md5(concat_ws(
            '|', je.company_id::text,
            coalesce(je.source_id, ''),
            coalesce(je.entity_type, ''),
            coalesce(je.entity_id, ''),
            coalesce(je.date, ''),
            coalesce(je.status, '')
          ))
        ) as event_id,
        coalesce(public._safe_date(je.date), je.created_at::date) as effective_date,
        max(je.created_at) as posted_at,
        bool_and(lower(coalesce(je.status, 'posted')) = 'draft') as all_draft,
        count(*) filter (
          where je.amount is null or je.amount <= 0
             or upper(je.type) not in ('DEBIT', 'CREDIT')
        ) as bad_rows,
        -- Balance totals deliberately exclude soft-deleted lines, matching the
        -- deferred constraint trigger exactly (consistent POSTED classification).
        round(coalesce(sum(je.amount) filter (
          where upper(je.type) = 'DEBIT' and je.deleted_at is null
        ), 0), 3) as debit_total,
        round(coalesce(sum(je.amount) filter (
          where upper(je.type) = 'CREDIT' and je.deleted_at is null
        ), 0), 3) as credit_total
      from public.journal_entries je
      group by
        je.company_id, je.batch_id,
        coalesce(nullif(je.entity_type, ''), 'legacy'),
        coalesce(je.source_id, ''),
        coalesce(je.batch_id::text, 'legacy-auto:' || md5(concat_ws(
          '|', je.company_id::text,
          coalesce(je.source_id, ''),
          coalesce(je.entity_type, ''),
          coalesce(je.entity_id, ''),
          coalesce(je.date, ''),
          coalesce(je.status, '')
        ))),
        coalesce(public._safe_date(je.date), je.created_at::date)
    ) g
    order by g.company_id, g.effective_date, g.event_id
  loop
    if v_group.bad_rows > 0 then
      v_bad_rows := v_bad_rows + v_group.bad_rows::integer;
      raise warning 'STAGE3_BACKFILL: skipping group % (% lines) because it contains non-positive or non-DEBIT/CREDIT legacy rows; those rows stay unbatched in journal_entries_archive.', v_group.event_id, v_group.bad_rows;
      continue;
    end if;

    v_status := case
      when v_group.all_draft then 'DRAFT'
      when v_group.debit_total = v_group.credit_total then 'POSTED'
      else 'DRAFT'
    end;

    if v_group.batch_id is not null then
      v_batch_id := v_group.batch_id;
      insert into public.journal_batches (
        id, company_id, status, source_type, source_id, event_id,
        is_legacy_compat, effective_date, accounting_period_id, period_resolution_reason,
        posted_at, posted_by, description, created_at, updated_at
      ) values (
        v_batch_id, v_group.company_id, v_status, v_group.source_type, v_group.source_id,
        v_group.event_id, true, v_group.effective_date, null, null,
        case when v_status = 'POSTED' then v_group.posted_at else null end, null,
        'Legacy journal batch backfilled from journal_entries (Stage 3).',
        v_group.posted_at, now()
      )
      on conflict (id) do nothing;

      -- The id must be OURS: same company and same event key.
      select b.id into v_check_id
        from public.journal_batches b
       where b.id = v_batch_id
         and b.company_id = v_group.company_id
         and b.event_id = v_group.event_id;
      if v_check_id is null then
        raise exception 'STAGE3_BACKFILL_CONFLICT: legacy batch id % was already used for a different event; cannot backfill safely.', v_batch_id;
      end if;
      v_batches_created := v_batches_created + 1;
    else
      insert into public.journal_batches (
        id, company_id, status, source_type, source_id, event_id,
        is_legacy_compat, effective_date, accounting_period_id, period_resolution_reason,
        posted_at, posted_by, description, created_at, updated_at
      ) values (
        gen_random_uuid(), v_group.company_id, v_status, v_group.source_type, v_group.source_id,
        v_group.event_id, true, v_group.effective_date, null, null,
        case when v_status = 'POSTED' then v_group.posted_at else null end, null,
        'Legacy journal batch backfilled from journal_entries (Stage 3).',
        v_group.posted_at, now()
      )
      on conflict (company_id, source_type, source_id, event_id) do nothing;

      select b.id into v_batch_id
        from public.journal_batches b
       where b.company_id = v_group.company_id
         and b.source_type = v_group.source_type
         and b.source_id = v_group.source_id
         and b.event_id = v_group.event_id;
      if v_batch_id is null then
        raise exception 'STAGE3_BACKFILL_CONFLICT: could not resolve batch for event %.', v_group.event_id;
      end if;
      v_batches_created := v_batches_created + 1;
    end if;

    insert into public.journal_lines (
      id, no, date, batch_id, company_id, account_id, debit, credit,
      line_description, ref_source_id, ref_entity_type, ref_entity_id,
      request_id, deleted_at, created_at
    )
    select
      je.id, je.no, je.date, v_batch_id, je.company_id, je.account_id,
      case when upper(je.type) = 'DEBIT' then round(je.amount, 3) else 0 end,
      case when upper(je.type) = 'CREDIT' then round(je.amount, 3) else 0 end,
      null, je.source_id, je.entity_type, je.entity_id,
      je.request_id, je.deleted_at, je.created_at
    from public.journal_entries je
    where je.company_id = v_group.company_id
      and coalesce(
        je.batch_id::text,
        'legacy-auto:' || md5(concat_ws(
          '|', je.company_id::text,
          coalesce(je.source_id, ''),
          coalesce(je.entity_type, ''),
          coalesce(je.entity_id, ''),
          coalesce(je.date, ''),
          coalesce(je.status, '')
        ))
      ) = v_group.event_id
    on conflict (id) do nothing;

    get diagnostics v_rows = row_count;
    v_lines_created := v_lines_created + v_rows;
  end loop;

  raise notice 'STAGE3_BACKFILL: created % batches and % lines; skipped % legacy rows with invalid amounts/types.', v_batches_created, v_lines_created, v_bad_rows;
end;
$backfill$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Archive the historical table (frozen) and install the compatibility view
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.journal_entries rename to journal_entries_archive;

comment on table public.journal_entries_archive is
  'Frozen copy of the pre-Stage-3 journal_entries table. Every row was backfilled into public.journal_lines (Stage 3). No writes are accepted; kept for auditability.';

-- Freeze the archive: no INSERT/UPDATE/DELETE ever.
create or replace function public.freeze_journal_entries_archive()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  raise exception 'JOURNAL_ENTRIES_ARCHIVE_FROZEN: the pre-Stage-3 journal_entries archive is read-only. The live ledger is public.journal_lines / public.journal_batches.' using errcode = '42501';
end;
$function$;

drop trigger if exists freeze_journal_entries_archive on public.journal_entries_archive;
create trigger freeze_journal_entries_archive
  before insert or update or delete on public.journal_entries_archive
  for each row execute function public.freeze_journal_entries_archive();

alter function public.freeze_journal_entries_archive() owner to postgres;
revoke all on function public.freeze_journal_entries_archive() from public, anon, authenticated;

-- Compatibility view: identical column shape to the historical table so every
-- existing report RPC (rpt_trial_balance, rpt_balance_sheet, ...), legacy
-- business RPC (record_invoice_payment_atomic, void_receipt_atomic,
-- pay_owner_settlement_atomic, ...) and release rehearsal keeps working.
-- security_invoker = true keeps the base-table RLS active for browser readers.
create or replace view public.journal_entries
with (security_invoker = true) as
select
  l.id,
  l.no,
  l.date,
  l.account_id,
  case when l.debit > 0 then l.debit else l.credit end as amount,
  case when l.debit > 0 then 'DEBIT' else 'CREDIT' end as type,
  l.ref_source_id as source_id,
  l.ref_entity_type as entity_type,
  l.ref_entity_id as entity_id,
  l.created_at,
  b.company_id,
  b.id as batch_id,
  l.request_id,
  case b.status when 'DRAFT' then 'draft' else 'posted' end as status,
  l.deleted_at
from public.journal_lines l
join public.journal_batches b on b.id = l.batch_id;

alter view public.journal_entries owner to postgres;
alter view public.journal_entries alter column company_id set default public.current_company_id();
alter view public.journal_entries alter column created_at set default now();

grant select on public.journal_entries to authenticated;

-- INSTEAD OF INSERT: legacy business RPCs still write through the view. This
-- trigger converts (amount, type) lines into canonical debit/credit lines and
-- attaches them to a deterministic batch:
--   * lines carrying a legacy batch_id reuse that batch (created on demand);
--   * lines without one are grouped by the same business-event identity the
--     backfill used, so an RPC inserting a DEBIT/CREDIT pair in one statement
--     lands in one balanced batch.
-- Only trusted server contexts may write: browsers (authenticated/anon) are
-- always rejected — the posting engine is the only browser-reachable path,
-- and Stage 3 does not expose one for arbitrary lines.
create or replace function public.journal_entries_view_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company uuid;
  v_batch_id uuid;
  v_source_type text;
  v_source_id text;
  v_event_id text;
  v_effective date;
  v_amount numeric;
  v_debit numeric;
  v_credit numeric;
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'JOURNAL_ENTRIES_BROWSER_WRITE_BLOCKED: direct journal writes are not allowed. Posting runs through the server-side posting engine only.' using errcode = '42501';
  end if;

  if new.account_id is null then
    raise exception 'account_id is required on the journal_entries compatibility path.' using errcode = '22023';
  end if;

  v_amount := coalesce(new.amount, 0);
  if v_amount <= 0 then
    raise exception 'JOURNAL_LINE_AMOUNT_INVALID: amount must be a positive value on the journal_entries compatibility path.' using errcode = '22023';
  end if;
  if upper(new.type) not in ('DEBIT', 'CREDIT') then
    raise exception 'JOURNAL_LINE_TYPE_INVALID: type must be DEBIT or CREDIT.' using errcode = '22023';
  end if;

  v_company := coalesce(new.company_id, public.current_company_id());
  if v_company is null then
    raise exception 'JOURNAL_LINE_COMPANY_REQUIRED: company context is required.' using errcode = '42501';
  end if;

  if new.batch_id is not null then
    v_batch_id := new.batch_id;
    v_source_type := 'legacy';
    v_source_id := coalesce(new.source_id, '');
    v_event_id := 'legacy-batch:' || new.batch_id::text;
  else
    v_source_type := coalesce(nullif(new.entity_type, ''), 'legacy');
    v_source_id := coalesce(new.source_id, '');
    v_event_id := 'legacy-auto:' || md5(concat_ws(
      '|', v_company::text,
      v_source_type,
      v_source_id,
      coalesce(new.entity_id, ''),
      coalesce(new.date, ''),
      coalesce(new.status, '')
    ));
  end if;

  v_effective := coalesce(public._safe_date(new.date), current_date);

  perform pg_advisory_xact_lock(hashtextextended('legacy_batch:' || v_company::text || ':' || v_event_id, 0));

  select b.id into v_batch_id
    from public.journal_batches b
   where b.company_id = v_company
     and b.source_type = v_source_type
     and b.source_id = v_source_id
     and b.event_id = v_event_id
   limit 1;

  if v_batch_id is null then
    insert into public.journal_batches (
      id, company_id, status, source_type, source_id, event_id,
      is_legacy_compat, effective_date, posted_at, description, created_at, updated_at
    ) values (
      coalesce(new.batch_id, gen_random_uuid()), v_company, 'POSTED',
      v_source_type, v_source_id, v_event_id, true, v_effective, now(),
      'Auto-created by the journal_entries compatibility path (legacy business RPC).',
      now(), now()
    )
    on conflict (company_id, source_type, source_id, event_id) do nothing;

    select b.id into v_batch_id
      from public.journal_batches b
     where b.company_id = v_company
       and b.source_type = v_source_type
       and b.source_id = v_source_id
       and b.event_id = v_event_id
     limit 1;
  end if;

  if v_batch_id is null then
    raise exception 'JOURNAL_BATCH_CREATE_FAILED: could not resolve a batch for the compatibility insert.' using errcode = 'P0001';
  end if;

  v_debit := case when upper(new.type) = 'DEBIT' then round(v_amount, 3) else 0 end;
  v_credit := case when upper(new.type) = 'CREDIT' then round(v_amount, 3) else 0 end;

  insert into public.journal_lines (
    id, no, date, batch_id, company_id, account_id, debit, credit,
    line_description, ref_source_id, ref_entity_type, ref_entity_id,
    request_id, deleted_at, created_at
  ) values (
    coalesce(new.id::text, gen_random_uuid()::text), new.no, new.date,
    v_batch_id, v_company, new.account_id, v_debit, v_credit, null,
    new.source_id, new.entity_type, new.entity_id, new.request_id,
    new.deleted_at, coalesce(new.created_at, now())
  );

  return new;
end;
$function$;

-- INSTEAD OF UPDATE/DELETE: corrections must use reversal batches; the legacy
-- table never supported in-place correction of posted rows either.
create or replace function public.journal_entries_view_reject_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  raise exception 'JOURNAL_ENTRIES_MUTATION_BLOCKED: posted journal entries are immutable. Corrections must use reversal batches (reverse_journal_batch / business reversal RPCs).' using errcode = '42501';
end;
$function$;

drop trigger if exists journal_entries_view_insert_trigger on public.journal_entries;
create trigger journal_entries_view_insert_trigger
  instead of insert on public.journal_entries
  for each row execute function public.journal_entries_view_insert();

drop trigger if exists journal_entries_view_update_trigger on public.journal_entries;
create trigger journal_entries_view_update_trigger
  instead of update on public.journal_entries
  for each row execute function public.journal_entries_view_reject_mutation();

drop trigger if exists journal_entries_view_delete_trigger on public.journal_entries;
create trigger journal_entries_view_delete_trigger
  instead of delete on public.journal_entries
  for each row execute function public.journal_entries_view_reject_mutation();

alter function public.journal_entries_view_insert() owner to postgres;
alter function public.journal_entries_view_reject_mutation() owner to postgres;
revoke all on function public.journal_entries_view_insert() from public, anon, authenticated;
revoke all on function public.journal_entries_view_reject_mutation() from public, anon, authenticated;

commit;
