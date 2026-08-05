-- Manual rollback for: supabase/migrations/20260805010001_bank_csv_import_integrity_followup.sql
--
-- Emergency only. This rollback disables bank CSV import rather than restoring
-- the known partial-success implementation. OMR 3-decimal columns and additive
-- metadata are retained to avoid destructive rounding or data loss. Re-enable
-- import only through a new reviewed forward migration.

begin;

drop function if exists public.import_bank_statement_batch_atomic(jsonb);
drop function if exists public.bank_statement_line_fingerprint(uuid, uuid, date, numeric, text, text, text);
drop index if exists public.ux_bank_imports_company_account_payload;

-- Retained intentionally:
--   bank_statement_imports.normalized_payload_fingerprint
--   numeric(18,3) bank amounts/balances
--   bank_statement_imports_count_integrity_check
-- These additions are backward-compatible and protect persisted precision.

commit;
