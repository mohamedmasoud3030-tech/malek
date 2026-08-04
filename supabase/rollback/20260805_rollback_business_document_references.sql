-- =============================================================================
-- Manual rollback for: supabase/migrations/20260805000000_business_document_references.sql
--
-- ⚠️ MANUAL / EMERGENCY ONLY — NOT auto-applied. Run by hand after explicit
-- approval, with a verified backup, only when the forward migration must be
-- reversed. Forward-only discipline: prefer a new corrective migration.
--
-- Reverses the business-document-reference infrastructure. It DROPS the
-- reference triggers, reference columns, the sequence table, and the helper
-- functions. The `reference` column data is dropped with the columns; internal
-- UUID primary keys and all accounting/GL behavior are unaffected.
-- =============================================================================

begin;

-- Drop BEFORE INSERT triggers first so future inserts stop consuming sequences.
drop trigger if exists trg_contracts_reference on public.contracts;
drop trigger if exists trg_invoices_reference on public.invoices;
drop trigger if exists trg_receipts_reference on public.receipts;
drop trigger if exists trg_expenses_reference on public.expenses;
drop trigger if exists trg_maintenance_records_reference on public.maintenance_records;
drop trigger if exists trg_owner_agreements_reference on public.owner_agreements;
drop trigger if exists trg_owner_settlements_reference on public.owner_settlements;
drop trigger if exists trg_tenant_deposits_reference on public.tenant_deposits;
drop trigger if exists trg_utility_bills_reference on public.utility_bills;
drop trigger if exists trg_bank_statement_imports_reference on public.bank_statement_imports;

drop function if exists public.assign_document_reference() cascade;
drop function if exists public.next_document_reference(uuid, text, text, integer) cascade;
drop function if exists public.backfill_business_document_references() cascade;
drop function if exists public.format_document_reference(uuid, text, text, integer, bigint) cascade;

-- Drop the per-table reference columns.
alter table public.contracts drop column if exists reference;
alter table public.invoices drop column if exists reference;
alter table public.receipts drop column if exists reference;
alter table public.expenses drop column if exists reference;
alter table public.maintenance_records drop column if exists reference;
alter table public.owner_agreements drop column if exists reference;
alter table public.owner_settlements drop column if exists reference;
alter table public.tenant_deposits drop column if exists reference;
alter table public.utility_bills drop column if exists reference;
alter table public.bank_statement_imports drop column if exists reference;

-- The sequence table is fully managed by this migration; drop it entirely.
drop table if exists public.document_reference_sequences;

commit;
