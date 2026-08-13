-- ===========================================================================
-- Manual rollback — not auto-applied; run by hand only in an emergency.
-- Rollback for: 20260814030000_wp05_gap017_bank_csv_preview_and_content_reuse.sql
-- ===========================================================================
-- Restores import_bank_statement_batch_atomic from 20260807160000 and drops
-- the no-write preview RPC plus payload_digest.

begin;

drop function if exists public.preview_bank_statement_batch_atomic(jsonb);

alter table public.bank_statement_imports
  drop column if exists payload_digest;

-- Re-apply 20260807160000_s02_bank_csv_import_server_guards.sql to restore
-- import_bank_statement_batch_atomic(jsonb) after dropping the preview RPC.

commit;
