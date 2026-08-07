-- Manual rollback for 20260807020000_s08_read_only_historical_analysis.sql
-- NOT auto-applied. Emergency use only with product-owner approval.
-- Drops all S08 read-only objects created by the forward migration.
begin;
drop view if exists public.s08_subledger_gl_reconciliation;
drop view if exists public.s08_master_lease_readiness;
drop view if exists public.s08_retroactive_version_differences;
drop function if exists public.s08_orphan_postings(uuid);
drop function if exists public.s08_analyze_deposit_exceptions(uuid);
drop function if exists public.s08_analyze_expense_misclassification(uuid);
drop view if exists public.s08_liability_balances_by_period;
drop function if exists public.s08_analyze_settlement_duplicates(uuid, uuid);
drop view if exists public.s08_analysis_scope;
drop function if exists public.s08_round_omr(numeric);
commit;
