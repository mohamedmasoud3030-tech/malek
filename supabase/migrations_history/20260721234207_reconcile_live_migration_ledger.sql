-- Ledger reconciliation marker for the migration registered in Production as
-- 20260721234207. The schema change was already applied remotely; this file is
-- intentionally a no-op so clean replays and Supabase CLI history checks use
-- the same immutable migration version without repeating production DDL.
select 1;
