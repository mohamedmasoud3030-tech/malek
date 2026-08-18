-- Rollback for 20260831000000_hot_path_fk_covering_indexes.sql
-- Drops indexes only. No table/data changes.

drop index if exists public.deposit_transactions_reversal_of_id_idx;
drop index if exists public.maintenance_records_invoice_id_idx;
drop index if exists public.maintenance_records_expense_id_idx;
drop index if exists public.owner_settlement_expense_links_settlement_company_idx;
drop index if exists public.owner_settlement_payment_links_settlement_company_idx;
drop index if exists public.receipt_allocations_company_id_idx;
drop index if exists public.receipt_allocations_receipt_id_idx;
drop index if exists public.bank_reconciliation_matches_company_id_idx;
drop index if exists public.deposit_transactions_company_id_idx;
drop index if exists public.utility_bills_company_id_idx;
drop index if exists public.utility_meters_company_id_idx;
drop index if exists public.vault_documents_company_id_idx;
drop index if exists public.leads_company_id_idx;
drop index if exists public.communication_records_company_id_idx;
drop index if exists public.maintenance_records_company_id_idx;
drop index if exists public.expenses_company_id_idx;
drop index if exists public.payments_company_id_idx;
drop index if exists public.invoices_company_id_idx;
drop index if exists public.contracts_company_id_idx;
drop index if exists public.property_owners_company_id_idx;
drop index if exists public.owners_company_id_idx;
drop index if exists public.people_company_id_idx;
drop index if exists public.units_company_id_idx;
drop index if exists public.properties_company_id_idx;
