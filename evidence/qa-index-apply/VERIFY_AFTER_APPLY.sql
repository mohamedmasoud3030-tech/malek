-- Read-only verification after applying hot-path FK indexes.
-- Safe to run in Supabase SQL Editor. No writes.

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'properties_company_id_idx',
    'units_company_id_idx',
    'people_company_id_idx',
    'owners_company_id_idx',
    'property_owners_company_id_idx',
    'contracts_company_id_idx',
    'invoices_company_id_idx',
    'payments_company_id_idx',
    'expenses_company_id_idx',
    'maintenance_records_company_id_idx',
    'communication_records_company_id_idx',
    'leads_company_id_idx',
    'vault_documents_company_id_idx',
    'utility_meters_company_id_idx',
    'utility_bills_company_id_idx',
    'deposit_transactions_company_id_idx',
    'bank_reconciliation_matches_company_id_idx',
    'receipt_allocations_receipt_id_idx',
    'receipt_allocations_company_id_idx',
    'owner_settlement_payment_links_settlement_company_idx',
    'owner_settlement_expense_links_settlement_company_idx',
    'maintenance_records_expense_id_idx',
    'maintenance_records_invoice_id_idx',
    'deposit_transactions_reversal_of_id_idx'
  )
order by indexname;

-- Expect 24 rows. Missing names mean that index was not created.
select count(*) as hot_path_indexes_present
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'properties_company_id_idx',
    'units_company_id_idx',
    'people_company_id_idx',
    'owners_company_id_idx',
    'property_owners_company_id_idx',
    'contracts_company_id_idx',
    'invoices_company_id_idx',
    'payments_company_id_idx',
    'expenses_company_id_idx',
    'maintenance_records_company_id_idx',
    'communication_records_company_id_idx',
    'leads_company_id_idx',
    'vault_documents_company_id_idx',
    'utility_meters_company_id_idx',
    'utility_bills_company_id_idx',
    'deposit_transactions_company_id_idx',
    'bank_reconciliation_matches_company_id_idx',
    'receipt_allocations_receipt_id_idx',
    'receipt_allocations_company_id_idx',
    'owner_settlement_payment_links_settlement_company_idx',
    'owner_settlement_expense_links_settlement_company_idx',
    'maintenance_records_expense_id_idx',
    'maintenance_records_invoice_id_idx',
    'deposit_transactions_reversal_of_id_idx'
  );
