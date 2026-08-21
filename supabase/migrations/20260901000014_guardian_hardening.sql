-- Database Guardian V1 — hardening migration.
--
-- Closes real findings reported by `pnpm db:guardian` against the canonical
-- schema. All changes are forward-only, additive, and safe to apply on top of
-- existing data. This migration is numbered 014 because PR #1541 (security
-- hardening) occupies 012/013.
--
--   DG-FIN-002  revoke browser write access to protected financial subledger
--               tables. Writes must go through governed SECURITY DEFINER RPCs.
--   DG-FIN-003  add unique partial index on (company_id, no) for invoices and
--               receipts to prevent duplicate document numbers.
--   DG-INT-001  explicitly anchor company_id with a direct foreign key.
--   DG-FIN-004  make every append-only table in the Guardian contract reject
--               hard DELETE. The contract declares 19 tables; pre-existing
--               immutable triggers already cover 9, this migration installs a
--               shared guard on the remaining 10.
--
-- The entire migration is one atomic transaction.

begin;

-- ---------------------------------------------------------------------------
-- DG-FIN-002: protected subledger tables are not browser-writable.
-- SECURITY DEFINER RPCs run with definer privileges and keep working.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate
  on table public.receipt_allocations
  from anon, authenticated;

revoke insert, update, delete, truncate
  on table public.deposit_transactions
  from anon, authenticated;

revoke insert, update, delete, truncate
  on table public.bank_reconciliation_matches
  from anon, authenticated;

drop policy if exists manager_write_receipt_allocations on public.receipt_allocations;
drop policy if exists manager_write_deposit_transactions on public.deposit_transactions;
drop policy if exists app_user_bank_reconciliation_matches on public.bank_reconciliation_matches;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'receipt_allocations'
       and policyname = 'app_read_receipt_allocations'
  ) then
    create policy app_read_receipt_allocations on public.receipt_allocations
      for select to authenticated using (public.is_app_user());
  end if;
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'deposit_transactions'
       and policyname = 'app_read_deposit_transactions'
  ) then
    create policy app_read_deposit_transactions on public.deposit_transactions
      for select to authenticated using (public.is_app_user());
  end if;
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'bank_reconciliation_matches'
       and policyname = 'app_read_bank_reconciliation_matches'
  ) then
    create policy app_read_bank_reconciliation_matches on public.bank_reconciliation_matches
      for select to authenticated using (app_private.is_app_user());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- DG-FIN-003: document numbers are unique per company for live documents.
-- Partial index lets drafts / voided / null-number rows coexist.
-- ---------------------------------------------------------------------------
create unique index if not exists ux_invoices_company_no
  on public.invoices (company_id, no)
  where no is not null and deleted_at is null;

create unique index if not exists ux_receipts_company_no
  on public.receipts (company_id, no)
  where no is not null and deleted_at is null;

-- ---------------------------------------------------------------------------
-- DG-INT-001: explicit company_id anchors.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'owner_settlement_expense_links_company_fk'
       and conrelid = 'public.owner_settlement_expense_links'::regclass
  ) then
    alter table public.owner_settlement_expense_links
      add constraint owner_settlement_expense_links_company_fk
      foreign key (company_id) references public.companies(id);
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'owner_settlement_payment_links_company_fk'
       and conrelid = 'public.owner_settlement_payment_links'::regclass
  ) then
    alter table public.owner_settlement_payment_links
      add constraint owner_settlement_payment_links_company_fk
      foreign key (company_id) references public.companies(id);
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'master_lease_schedule_rows_company_fk'
       and conrelid = 'public.master_lease_schedule_rows'::regclass
  ) then
    alter table public.master_lease_schedule_rows
      add constraint master_lease_schedule_rows_company_fk
      foreign key (company_id) references public.companies(id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- DG-FIN-004: every append-only table in the Guardian contract rejects hard
-- DELETE. 9 tables already have their own immutable-lineage triggers; this
-- migration installs the shared guard on the remaining 10. The guard is a
-- defense-in-depth guarantee that even service-role / direct SQL cannot
-- hard-delete posted history.
-- ---------------------------------------------------------------------------
create or replace function public.guard_append_only_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'APPEND_ONLY_TABLE: hard DELETE is forbidden on %', tg_table_name
    using errcode = '23001',
          hint = 'Use a governed reversal/compensating record instead.';
end;
$$;

alter function public.guard_append_only_row() owner to postgres;
-- Internal helper: not executable from any browser/API role.
revoke all on function public.guard_append_only_row() from public, anon, authenticated;

do $$
declare
  t text;
  -- Tables in the Guardian append-only contract that do NOT already ship a
  -- BEFORE DELETE immutability trigger in the canonical baseline.
  -- journal_batches already has guard_journal_batch_lifecycle, but that
  -- trigger allows hard DELETE of DRAFT batches; the append-only contract
  -- forbids hard DELETE in any status, so the shared guard is added too.
  targets text[] := array[
    'receipt_allocations',
    'deposit_application_claims',
    'deposit_refund_events',
    'status_history',
    'audit_log',
    'contract_evidence_events',
    'owner_settlement_payment_links',
    'owner_settlement_expense_links',
    'bank_reconciliation_matches',
    'financial_operation_idempotency',
    'journal_batches'
  ];
begin
  foreach t in array targets loop
    if not exists (
      select 1 from pg_trigger
       where tgrelid = format('public.%I', t)::regclass
         and tgname = 'guard_append_only_delete'
         and not tgisinternal
    ) then
      execute format(
        'create trigger guard_append_only_delete before delete on public.%I
           for each row execute function public.guard_append_only_row()',
        t
      );
    end if;
  end loop;
end $$;

commit;
