-- =============================================================================
-- Stage 3 — General Ledger Core (1/3): company-scoped chart of accounts and
-- accounting periods.
--
-- Product decision record: docs/decisions/0009-malek-canonical-accounting-model.md
--   * property_management = AGENT (presentation NET)
--   * master_lease = PRINCIPAL
--   * OWNER_IS_CREDITOR / OFFICE_IS_CREDITOR collection roles
--   * OMR precision = 3 decimal places (C7 APPROVED, rounding unit 0.001)
--
-- This migration upgrades the existing single-table chart of accounts
-- (public.accounts) in place — it does NOT create a parallel chart — and adds
-- the company-scoped accounting_periods table that the Stage 3 posting engine
-- resolves against.
--
-- What changes:
--   1. accounts gains account_type / normal_balance / currency_code /
--      precision / is_active / updated_at with strongly controlled CHECK
--      constraints (OMR must use precision 3).
--   2. Global UNIQUE(no) is replaced by UNIQUE(company_id, no) after a
--      duplicate inspection (fail-closed on unexpected duplicates).
--      Account numbers may repeat across companies but never within one.
--   3. A unique (id, company_id) key is added so journal_lines can enforce
--      company consistency through composite foreign keys (FA-003 pattern).
--   4. Legacy rows are classified deterministically from the account-number
--      prefix; admin-set classifications are never overwritten.
--   5. Deletion of an account referenced by any ledger line is blocked by a
--      friendly trigger in addition to the existing ON DELETE RESTRICT FKs.
--   6. accounting_periods (OPEN / SOFT_CLOSED / HARD_CLOSED) with non-overlap
--      enforcement, unique period names per company, a write guard trigger
--      (status changes only through the authorized RPC, HARD_CLOSED is
--      immutable), and RLS mirroring the project tenant-isolation posture.
--   7. provision_company_chart_of_accounts() creates the 17 required Stage 3
--      accounts per company idempotently and deterministically without ever
--      overwriting customized names; ensure_company_account() drops the now
--      obsolete global-uniqueness guard (the composite constraint is the
--      protection).
--
-- Forward-only. No financial data is deleted or rewritten.
-- Manual rollback: supabase/rollback/20260804_rollback_stage3_gl_core_chart_of_accounts_and_periods.sql
-- =============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. accounts — additive column upgrade with strongly controlled values
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.accounts
  add column if not exists account_type text not null default 'other',
  add column if not exists normal_balance text not null default 'debit',
  add column if not exists currency_code text not null default 'OMR',
  add column if not exists precision smallint not null default 3,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_account_type_chk' and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_account_type_chk
      check (account_type in ('asset', 'liability', 'equity', 'revenue', 'expense', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_normal_balance_chk' and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_normal_balance_chk
      check (normal_balance in ('debit', 'credit'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_currency_code_chk' and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_currency_code_chk
      check (btrim(currency_code) <> '');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_precision_chk' and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_precision_chk
      check (precision between 0 and 9);
  end if;

  -- OMR accounts must use three-decimal precision (C7). Non-OMR currencies are
  -- free to declare their own precision, but this product stage only ships OMR.
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_omr_precision_chk' and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_omr_precision_chk
      check (currency_code <> 'OMR' or precision = 3);
  end if;
end
$constraints$;

-- Deterministic classification of legacy rows (never overwrites a value that
-- an administrator has already set). Prefix rule mirrors the report RPCs
-- (1 = asset, 2 = liability, 3 = equity, 4 = revenue, 5/6 = expense).
update public.accounts
   set account_type = case
         when no ~ '^1' then 'asset'
         when no ~ '^2' then 'liability'
         when no ~ '^3' then 'equity'
         when no ~ '^4' then 'revenue'
         when no ~ '^5' or no ~ '^6' then 'expense'
         else account_type
       end,
       normal_balance = case
         when no ~ '^1' or no ~ '^5' or no ~ '^6' then 'debit'
         when no ~ '^2' or no ~ '^3' or no ~ '^4' then 'credit'
         else normal_balance
       end,
       updated_at = now()
 where account_type = 'other'
   and no ~ '^[1-6]';

-- Composite (id, company_id) key so ledger lines can reference an account and
-- its company in one foreign key (the FA-003 company-consistency pattern).
create unique index if not exists accounts_id_company_uidx
  on public.accounts (id, company_id);

-- Friendly deletion guard: an account that any ledger line (canonical or
-- archived legacy) references must never be deleted; deactivation is the
-- supported path. The ON DELETE RESTRICT foreign keys remain the hard
-- backstop; this trigger only turns the raw FK error into a clear message.
create or replace function public.prevent_account_deletion_if_referenced()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_lines bigint;
begin
  if to_regclass('public.journal_lines') is not null then
    select count(*) into v_lines
      from public.journal_lines l
     where l.account_id = old.id;
    if v_lines > 0 then
      raise exception 'ACCOUNT_REFERENCED_BY_JOURNAL: account % (%) cannot be deleted because it is referenced by journal lines. Deactivate it instead.', old.no, old.id
        using errcode = '23503';
    end if;
  end if;
  if to_regclass('public.journal_entries_archive') is not null then
    select count(*) into v_lines
      from public.journal_entries_archive a
     where a.account_id = old.id;
    if v_lines > 0 then
      raise exception 'ACCOUNT_REFERENCED_BY_LEGACY_JOURNAL: account % (%) cannot be deleted because it is referenced by archived journal entries. Deactivate it instead.', old.no, old.id
        using errcode = '23503';
    end if;
  end if;
  return old;
end;
$function$;

drop trigger if exists prevent_account_deletion_if_referenced on public.accounts;
create trigger prevent_account_deletion_if_referenced
  before delete on public.accounts
  for each row execute function public.prevent_account_deletion_if_referenced();

alter function public.prevent_account_deletion_if_referenced() owner to postgres;
revoke all on function public.prevent_account_deletion_if_referenced() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Replace global account-number uniqueness with (company_id, no)
-- ─────────────────────────────────────────────────────────────────────────────
do $uniqueness$
declare
  v_dup integer;
begin
  select count(*) into v_dup
    from (
      select company_id, no
        from public.accounts
       group by company_id, no
      having count(*) > 1
    ) d;

  if v_dup > 0 then
    raise exception 'STAGE3_UNIQUENESS_ABORT: % (company_id, no) duplicate groups exist in public.accounts. Resolve duplicates before switching to the composite unique constraint.', v_dup;
  end if;
end
$uniqueness$;

alter table public.accounts drop constraint if exists accounts_no_key;
alter table public.accounts
  add constraint accounts_company_no_key unique (company_id, no);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. accounting_periods
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'OPEN',
  closed_at timestamptz,
  closed_by uuid,
  reopen_reason text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  constraint accounting_periods_name_company_key unique (company_id, name),
  constraint accounting_periods_range_chk check (start_date <= end_date),
  constraint accounting_periods_status_chk
    check (status in ('OPEN', 'SOFT_CLOSED', 'HARD_CLOSED'))
);

comment on table public.accounting_periods is
  'Stage 3: company-scoped accounting periods. OPEN permits normal posting; SOFT_CLOSED rejects normal business posting; HARD_CLOSED is immutable and accepts no posting through any normal application flow.';

comment on column public.accounting_periods.reopen_reason is
  'Audited reason recorded when a SOFT_CLOSED period is reopened. HARD_CLOSED periods can never be reopened.';

create index if not exists accounting_periods_company_start_idx
  on public.accounting_periods (company_id, start_date);
create index if not exists accounting_periods_company_status_idx
  on public.accounting_periods (company_id, status);

-- Non-overlap guard: date ranges of periods of the SAME company must never
-- share a date. The advisory lock serializes concurrent period creation per
-- company (the project concurrency convention) so the check cannot race.
create or replace function public.guard_accounting_period_no_overlap()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_conflict uuid;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('accounting_period:' || new.company_id::text, 0)
  );

  select p.id into v_conflict
    from public.accounting_periods p
   where p.company_id = new.company_id
     and p.id is distinct from new.id
     and p.start_date <= new.end_date
     and p.end_date >= new.start_date
   limit 1;

  if v_conflict is not null then
    raise exception 'ACCOUNTING_PERIOD_OVERLAP: period % overlaps existing period % for the same company.', new.name, v_conflict
      using errcode = '23P01';
  end if;

  return new;
end;
$function$;

drop trigger if exists guard_accounting_period_no_overlap on public.accounting_periods;
create trigger guard_accounting_period_no_overlap
  before insert or update of start_date, end_date, company_id on public.accounting_periods
  for each row execute function public.guard_accounting_period_no_overlap();

alter function public.guard_accounting_period_no_overlap() owner to postgres;
revoke all on function public.guard_accounting_period_no_overlap() from public, anon, authenticated;

-- Write guard:
--   * periods are append-only: DELETE is always rejected;
--   * every UPDATE must be authorized by the explicit RPC
--     (update_accounting_period_status), which sets the session marker
--     malik.accounting_period_change_authorized — direct SQL/UIs can never
--     flip a status;
--   * HARD_CLOSED is immutable (no reopening, no range/name edits);
--   * once a period is SOFT_CLOSED or HARD_CLOSED its range and name are
--     frozen (only status transitions and audit metadata may change).
create or replace function public.guard_accounting_period_writes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'ACCOUNTING_PERIOD_IMMUTABLE: accounting periods cannot be deleted.' using errcode = '42501';
  end if;

  if coalesce(current_setting('malik.accounting_period_change_authorized', true), '') <> 'true' then
    raise exception 'ACCOUNTING_PERIOD_WRITE_UNAUTHORIZED: period status changes are only allowed through update_accounting_period_status().' using errcode = '42501';
  end if;

  if old.status = 'HARD_CLOSED' and new.status is distinct from 'HARD_CLOSED' then
    raise exception 'ACCOUNTING_PERIOD_HARD_CLOSED_IMMUTABLE: a HARD_CLOSED period cannot be reopened or changed.' using errcode = '42501';
  end if;

  if old.status in ('SOFT_CLOSED', 'HARD_CLOSED') and (
    new.start_date is distinct from old.start_date
    or new.end_date is distinct from old.end_date
    or new.name is distinct from old.name
    or new.company_id is distinct from old.company_id
  ) then
    raise exception 'ACCOUNTING_PERIOD_RANGE_FROZEN: period name/range/company cannot change once the period is closed.' using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists guard_accounting_period_writes on public.accounting_periods;
create trigger guard_accounting_period_writes
  before update or delete on public.accounting_periods
  for each row execute function public.guard_accounting_period_writes();

alter function public.guard_accounting_period_writes() owner to postgres;
revoke all on function public.guard_accounting_period_writes() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Narrow prerequisite repair (documented in the Stage 3 PR):
-- public.accounts carries the legacy permissive policy admin_write_accounts
-- (FOR ALL ... USING (public.is_admin())). Because FOR ALL policies are also
-- evaluated for SELECT, every authenticated read of public.accounts failed
-- with "permission denied for function is_admin" — is_admin() was never
-- granted EXECUTE to authenticated. The Stage 3 chart-of-accounts read path
-- depends on authenticated account reads, so the helper is granted here.
-- is_admin() is SECURITY DEFINER and only reports the caller's own role; it
-- cannot elevate privileges.
-- ─────────────────────────────────────────────────────────────────────────────
grant execute on function public.is_admin() to authenticated, service_role;

-- RLS: restrictive tenant isolation + read-only for authenticated app users.
alter table public.accounting_periods enable row level security;
alter table public.accounting_periods alter column company_id set default public.current_company_id();

drop policy if exists p0_tenant_isolation on public.accounting_periods;
create policy p0_tenant_isolation on public.accounting_periods as restrictive
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists app_read_accounting_periods on public.accounting_periods;
create policy app_read_accounting_periods on public.accounting_periods
  for select to authenticated using (public.is_app_user());

drop policy if exists no_browser_write_accounting_periods on public.accounting_periods;
create policy no_browser_write_accounting_periods on public.accounting_periods
  for all to authenticated using (false) with check (false);

revoke all on public.accounting_periods from public, anon;
grant select on public.accounting_periods to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Required chart-of-accounts provisioning (idempotent, company-scoped)
-- ─────────────────────────────────────────────────────────────────────────────
-- The 17 required Stage 3 accounts. Order is deterministic (account number).
-- Classification/normal balance follow the approved model; the master-lease
-- accounts (1600/2500/6200/6300/4000) are provisioned but are NOT wired into
-- any posting flow in this stage (IFRS 16 schedules are Stage 6).
create or replace function public.provision_company_chart_of_accounts(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_accounts jsonb[] := array[
    jsonb_build_object('no', '1111', 'name', 'Cash', 'type', 'asset', 'balance', 'debit'),
    jsonb_build_object('no', '1120', 'name', 'Bank', 'type', 'asset', 'balance', 'debit'),
    jsonb_build_object('no', '1201', 'name', 'Tenant Receivable', 'type', 'asset', 'balance', 'debit'),
    jsonb_build_object('no', '1300', 'name', 'Due from Owners', 'type', 'asset', 'balance', 'debit'),
    jsonb_build_object('no', '1600', 'name', 'Right-of-Use Asset', 'type', 'asset', 'balance', 'debit'),
    jsonb_build_object('no', '2000', 'name', 'Owner Funds Payable', 'type', 'liability', 'balance', 'credit'),
    jsonb_build_object('no', '2100', 'name', 'VAT Payable', 'type', 'liability', 'balance', 'credit'),
    jsonb_build_object('no', '2200', 'name', 'Tenant Deposits Payable', 'type', 'liability', 'balance', 'credit'),
    jsonb_build_object('no', '2300', 'name', 'Broker Commissions Payable', 'type', 'liability', 'balance', 'credit'),
    jsonb_build_object('no', '2500', 'name', 'Lease Liability', 'type', 'liability', 'balance', 'credit'),
    jsonb_build_object('no', '4000', 'name', 'Sublease Rental Revenue', 'type', 'revenue', 'balance', 'credit'),
    jsonb_build_object('no', '4100', 'name', 'Management Fee Revenue', 'type', 'revenue', 'balance', 'credit'),
    jsonb_build_object('no', '4200', 'name', 'Brokerage Revenue', 'type', 'revenue', 'balance', 'credit'),
    jsonb_build_object('no', '4300', 'name', 'Damage Compensation Revenue', 'type', 'revenue', 'balance', 'credit'),
    jsonb_build_object('no', '6100', 'name', 'Company Operating Expense', 'type', 'expense', 'balance', 'debit'),
    jsonb_build_object('no', '6110', 'name', 'Broker Commission Expense', 'type', 'expense', 'balance', 'debit'),
    jsonb_build_object('no', '6200', 'name', 'ROU Depreciation', 'type', 'expense', 'balance', 'debit'),
    jsonb_build_object('no', '6300', 'name', 'Lease Interest Expense', 'type', 'expense', 'balance', 'debit')
  ];
  v_acc jsonb;
  v_id text;
  v_created integer := 0;
  v_existing integer := 0;
  v_results jsonb := '[]'::jsonb;
begin
  if p_company_id is null then
    raise exception 'company_id is required.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'Company % does not exist.', p_company_id using errcode = 'P0002';
  end if;

  -- Serialize provisioning per company; the composite unique constraint is the
  -- authoritative concurrency backstop.
  perform pg_advisory_xact_lock(
    hashtextextended('chart_of_accounts:' || p_company_id::text, 0)
  );

  foreach v_acc in array v_accounts loop
    v_id := 'coa:' || p_company_id::text || ':' || (v_acc->>'no');

    insert into public.accounts (
      id, no, name, company_id, account_type, normal_balance,
      currency_code, precision, is_active, created_at, updated_at
    ) values (
      v_id, v_acc->>'no', v_acc->>'name', p_company_id, v_acc->>'type', v_acc->>'balance',
      'OMR', 3, true, now(), now()
    )
    on conflict (company_id, no) do nothing;

    if found then
      v_created := v_created + 1;
    else
      v_existing := v_existing + 1;
    end if;

    v_results := v_results || jsonb_build_object(
      'account_no', v_acc->>'no',
      'name', v_acc->>'name',
      'account_type', v_acc->>'type',
      'normal_balance', v_acc->>'balance',
      'currency_code', 'OMR',
      'precision', 3
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'created_count', v_created,
    'existing_count', v_existing,
    'accounts', v_results
  );
end;
$function$;

alter function public.provision_company_chart_of_accounts(uuid) owner to postgres;
revoke all on function public.provision_company_chart_of_accounts(uuid) from public, anon, authenticated;
grant execute on function public.provision_company_chart_of_accounts(uuid) to service_role;

-- Browser-facing boundary: derives the company from the authenticated JWT,
-- never from client input, and requires ADMIN/MANAGER.
create or replace function public.ensure_company_chart_of_accounts()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to provision the chart of accounts.' using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  return public.provision_company_chart_of_accounts(v_company_id);
end;
$function$;

alter function public.ensure_company_chart_of_accounts() owner to postgres;
revoke all on function public.ensure_company_chart_of_accounts() from public, anon;
grant execute on function public.ensure_company_chart_of_accounts() to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ensure_company_account — drop the obsolete global-uniqueness guard.
-- The composite UNIQUE(company_id, no) is now the database-level protection,
-- so the Phase 3A-1A guard that refused to create an account owned by another
-- company is removed: every company may now have its own 1111/2000/...
-- New rows are classified deterministically from the number prefix and always
-- use OMR precision 3.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.ensure_company_account(p_company_id uuid, p_account_no text, p_account_name text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_id text;
  v_count integer;
  v_account_type text;
  v_normal_balance text;
begin
  if p_company_id is null or nullif(btrim(p_account_no), '') is null or nullif(btrim(p_account_name), '') is null then
    raise exception 'company_id, account number and account name are required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('coa:' || p_company_id::text || ':' || btrim(p_account_no), 0));

  select count(*), min(id) into v_count, v_id
    from public.accounts
   where company_id = p_company_id and no = btrim(p_account_no);

  if v_count > 1 then
    raise exception 'Account % is ambiguous for company %', p_account_no, p_company_id using errcode = '23505';
  end if;
  if v_count = 1 then
    return v_id;
  end if;

  v_account_type := case
    when btrim(p_account_no) ~ '^1' then 'asset'
    when btrim(p_account_no) ~ '^2' then 'liability'
    when btrim(p_account_no) ~ '^3' then 'equity'
    when btrim(p_account_no) ~ '^4' then 'revenue'
    when btrim(p_account_no) ~ '^5' or btrim(p_account_no) ~ '^6' then 'expense'
    else 'other'
  end;
  v_normal_balance := case
    when v_account_type in ('asset', 'expense') then 'debit'
    else 'credit'
  end;

  v_id := 'coa:' || p_company_id::text || ':' || btrim(p_account_no);
  insert into public.accounts (
    id, no, name, company_id, account_type, normal_balance,
    currency_code, precision, is_active, created_at, updated_at
  ) values (
    v_id, btrim(p_account_no), p_account_name, p_company_id,
    v_account_type, v_normal_balance, 'OMR', 3, true, now(), now()
  )
  on conflict (id) do nothing;

  select count(*), min(id) into v_count, v_id
    from public.accounts
   where company_id = p_company_id and no = btrim(p_account_no);

  if v_count <> 1 then
    raise exception 'Cannot safely ensure account % for company %', p_account_no, p_company_id using errcode = '23505';
  end if;

  return v_id;
end;
$function$;

alter function public.ensure_company_account(uuid, text, text) owner to postgres;
revoke all on function public.ensure_company_account(uuid, text, text) from public, anon, authenticated;
grant execute on function public.ensure_company_account(uuid, text, text) to service_role;

commit;
