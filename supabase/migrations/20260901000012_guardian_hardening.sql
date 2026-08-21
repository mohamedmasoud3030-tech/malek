-- Database Guardian V1 — hardening migration.
--
-- Closes real findings reported by `pnpm db:guardian` against the canonical
-- schema. All changes are forward-only, additive, and safe to apply on top of
-- existing data:
--
--   DG-FIN-002  revoke browser write access to protected financial subledger
--               tables (receipt_allocations, deposit_transactions,
--               bank_reconciliation_matches). Writes must go through the
--               governed SECURITY DEFINER RPCs.
--   DG-FIN-003  add unique partial index on (company_id, no) for invoices and
--               receipts to prevent duplicate document numbers.
--   DG-INT-001  explicitly anchor company_id on owner settlement link tables
--               (a transitively-enforced invariant made explicit).
--
-- The migration is idempotent and never edits merged history.

begin;

-- ---------------------------------------------------------------------------
-- DG-FIN-002: protected subledger tables are not browser-writable.
-- The SECURITY DEFINER RPCs run with definer privileges and keep working.
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

-- The existing manager_write_* / app_user_* policies permissively authorize
-- browser DML. Drop them so RLS denies all direct writes; the restrictive
-- p0_tenant_isolation policy is not sufficient — it only scopes rows, it does
-- not block writes when a permissive policy allows them.
drop policy if exists manager_write_receipt_allocations on public.receipt_allocations;
drop policy if exists manager_write_deposit_transactions on public.deposit_transactions;
drop policy if exists app_user_bank_reconciliation_matches on public.bank_reconciliation_matches;

-- Leave a read policy for app users (these tables back read-only screens and
-- are company-scoped by p0_tenant_isolation).
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
-- DG-INT-001: explicit company_id anchors on settlement link tables and the
-- master lease schedule. company_id is already part of composite FKs for the
-- link tables (which transitively anchor it); add direct FKs so the invariant
-- is explicit and introspectable.
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

commit;

-- ---------------------------------------------------------------------------
-- DG-FIN-004: append-only financial event tables must reject hard DELETE.
-- Installs a single shared BEFORE DELETE trigger that raises an exception.
-- Browser roles already lack DELETE privilege on most of these tables after
-- the DG-FIN-002 revokes, but the trigger is a defense-in-depth guarantee
-- that even service-role / direct SQL cannot hard-delete posted history.
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
revoke all on function public.guard_append_only_row() from public, anon;

do $$
declare
  t text;
  targets text[] := array[
    'deposit_application_claims',
    'deposit_refund_events',
    'status_history',
    'audit_log',
    'contract_evidence_events',
    'owner_settlement_payment_links',
    'owner_settlement_expense_links',
    'bank_reconciliation_matches',
    'financial_operation_idempotency'
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
