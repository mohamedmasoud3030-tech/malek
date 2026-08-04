-- =============================================================================
-- Manual rollback for: supabase/migrations/20260804030000_stage3_gl_core_chart_of_accounts_and_periods.sql
--
-- ⚠️ MANUAL / EMERGENCY ONLY — NOT auto-applied. Run by hand after explicit
-- approval, with a verified backup, only when the forward migration must be
-- reversed. Forward-only discipline: prefer a new corrective migration.
--
-- This script reverses ONLY the Stage 3 chart-of-accounts/periods changes.
-- It does NOT delete financial history: journal lines/batches created by
-- later Stage 3 migrations are not touched here (reverse those first with
-- 20260804_rollback_stage3_gl_core_journal_batches_and_lines.sql, then
-- 20260804_rollback_stage3_gl_core_posting_engine_and_rpcs.sql, in that
-- order — the tables dropped here are referenced by them).
-- =============================================================================

begin;

-- 1) drop company-scoped period management objects
drop table if exists public.accounting_periods cascade;
drop function if exists public.guard_accounting_period_no_overlap() cascade;
drop function if exists public.guard_accounting_period_writes() cascade;

-- 2) drop the friendly account-deletion guard (the ON DELETE RESTRICT FKs
--    remain the hard protection)
drop trigger if exists prevent_account_deletion_if_referenced on public.accounts;
drop function if exists public.prevent_account_deletion_if_referenced() cascade;

-- 3) restore the global account-number uniqueness after confirming that no
--    duplicate account numbers exist (they cannot exist while the composite
--    constraint is in place, so this is a straight swap)
alter table public.accounts drop constraint if exists accounts_company_no_key;
alter table public.accounts add constraint accounts_no_key unique (no);

-- 4) drop the composite (id, company_id) key used by ledger line FKs
drop index if exists accounts_id_company_uidx;

-- 5) drop the Stage 3 account columns (additive upgrade rolled back)
alter table public.accounts
  drop column if exists account_type,
  drop column if exists normal_balance,
  drop column if exists currency_code,
  drop column if exists precision,
  drop column if exists is_active,
  drop column if exists updated_at;

-- 6) restore the previous provisioning helper semantics: the global
--    uniqueness guard is restored by re-applying the Phase 3A-1A definition.
--    (See the original file 20260727091000_phase3a1a_canonical_accounts_expenses_deposits.sql.)

-- 7) the is_admin() EXECUTE grant for authenticated was a narrow Stage 3
--    repair; reverting it restores the pre-Stage-3 ACL.
revoke execute on function public.is_admin() from authenticated;
grant execute on function public.is_admin() to service_role;

commit;

-- Post-conditions to verify before declaring the rollback complete:
--   select conname from pg_constraint where conname = 'accounts_no_key';
--   select count(*) from pg_tables where tablename = 'accounting_periods';  -- 0
--   select count(*) from pg_proc where proname like 'provision_company_chart_of_accounts%'; -- 0
