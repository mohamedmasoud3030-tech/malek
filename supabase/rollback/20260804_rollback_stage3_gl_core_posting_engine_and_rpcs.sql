-- =============================================================================
-- Manual rollback for: supabase/migrations/20260804030200_stage3_gl_core_posting_engine_and_rpcs.sql
--
-- ⚠️ MANUAL / EMERGENCY ONLY — NOT auto-applied. Run by hand after explicit
-- approval, with a verified backup, only when the forward migration must be
-- reversed. Forward-only discipline: prefer a new corrective migration.
--
-- Drops the Stage 3 posting engine, period-administration and read RPCs, and
-- the internal GL helpers. Journal data is NOT deleted here — run the ledger
-- rollback first (20260804_rollback_stage3_gl_core_journal_batches_and_lines.sql)
-- when the whole Stage 3 ledger stack is being reversed.
-- =============================================================================

begin;

drop function if exists public.gl_resolve_accounting_period(uuid, date) cascade;
drop function if exists public.gl_validate_and_normalize_lines(uuid, jsonb) cascade;
drop function if exists public.gl_lines_fingerprint(jsonb) cascade;
drop function if exists public.gl_create_journal_batch(jsonb) cascade;
drop function if exists public.gl_post_journal_batch(uuid) cascade;
drop function if exists public.post_journal_event(jsonb) cascade;
drop function if exists public.reverse_journal_batch(uuid) cascade;
drop function if exists public.create_accounting_period(jsonb) cascade;
drop function if exists public.update_accounting_period_status(jsonb) cascade;
drop function if exists public.list_chart_of_accounts() cascade;
drop function if exists public.list_accounting_periods() cascade;
drop function if exists public.list_journal_batches(jsonb) cascade;
drop function if exists public.list_journal_lines(uuid) cascade;

commit;

-- Post-conditions to verify before declaring the rollback complete:
--   select count(*) from pg_proc
--    where pronamespace = 'public'::regnamespace
--      and proname in ('post_journal_event','reverse_journal_batch',
--                      'gl_post_journal_batch','create_accounting_period',
--                      'update_accounting_period_status','list_journal_batches'); -- 0
