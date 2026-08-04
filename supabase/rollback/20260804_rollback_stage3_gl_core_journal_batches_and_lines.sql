-- =============================================================================
-- Manual rollback for: supabase/migrations/20260804030100_stage3_gl_core_journal_batches_and_lines.sql
--
-- ⚠️ MANUAL / EMERGENCY ONLY — NOT auto-applied. Run by hand after explicit
-- approval, with a verified backup, only when the forward migration must be
-- reversed. Forward-only discipline: prefer a new corrective migration.
--
-- Reverses the canonical ledger consolidation. No financial history is
-- deleted: the frozen archive table (journal_entries_archive) still holds the
-- complete pre-Stage-3 dataset, and this script restores the live table from
-- it, so every legacy row returns to its original table with original ids.
-- Canonical batches/lines created by Stage 3 postings or by legacy RPCs after
-- the migration ran are DROPPED by this script — review
--   select count(*) from public.journal_batches where is_legacy_compat = false;
--   select count(*) from public.journal_lines  where id not in (select id::text from public.journal_entries_archive);
-- first and confirm those rows are accounted for before running.
-- =============================================================================

begin;

-- 1) drop the compatibility view and its INSTEAD OF triggers
drop view if exists public.journal_entries cascade;

-- 2) drop canonical ledger tables (and their triggers/constraints)
drop table if exists public.journal_lines cascade;
drop table if exists public.journal_batches cascade;

-- 3) restore the original table from the frozen archive (ids preserved)
drop table if exists public.journal_entries;
alter table public.journal_entries_archive rename to journal_entries;

-- 4) re-create the index that existed on the original table
create index if not exists journal_entries_source_idx on public.journal_entries (source_id, entity_type);

-- 5) the pre-Stage-3 journal triggers/policies moved with the rename and are
--    still attached; drop the freeze trigger that Stage 3 added.
drop trigger if exists freeze_journal_entries_archive on public.journal_entries;
drop function if exists public.freeze_journal_entries_archive() cascade;

commit;

-- Post-conditions to verify before declaring the rollback complete:
--   select count(*) from public.journal_entries; -- equals the pre-migration count
--   select count(*) from pg_views where viewname = 'journal_entries'; -- 0
--   select count(*) from pg_tables where tablename = 'journal_batches'; -- 0
