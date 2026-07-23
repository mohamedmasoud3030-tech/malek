-- ============================================================================
-- PHASE 4 of 5 — NOT NULL + Foreign Key constraints
-- ============================================================================
--
-- ⚠️ يتطلب: Phase 3 نجحت (كل الـ null_count = 0)
--
-- هذا الـmigration:
--   1. يغير company_id لـ NOT NULL
--   2. يضيف FK → companies(id)
--
-- ============================================================================

begin;

do $$
declare
  tbl text;
begin
  -- Tier 1 + Tier 2
  foreach tbl in array array[
    'properties', 'property_owners', 'owners', 'units', 'people',
    'tenants', 'contracts', 'invoices', 'payments', 'receipts',
    'receipt_allocations', 'expenses', 'maintenance_records',
    'contract_balances', 'owner_balances', 'accounts', 'journal_entries',
    'lands', 'leads', 'commissions', 'utility_bills', 'utility_meters',
    'vault_documents', 'contract_documents', 'owner_settlements',
    'deposit_txs', 'deposit_transactions', 'tenant_deposits',
    'bank_accounts', 'bank_statement_imports', 'bank_statement_lines',
    'bank_reconciliation_matches', 'budgets', 'account_balances',
    'tenant_balances', 'serials', 'status_history',
    'status_transition_rules', 'kpi_snapshots', 'snapshots',
    'company_settings',
    'automation_rules', 'automation_runs', 'automation_run_logs',
    'automation_notifications', 'notifications', 'app_notifications',
    'notification_templates', 'outgoing_notifications',
    'communication_records', 'missions', 'attachments'
  ] loop
    execute format('alter table public.%I alter column company_id set not null', tbl);
    execute format(
      'alter table public.%I add constraint %I_company_id_fkey foreign key (company_id) references public.companies(id) on delete restrict',
      tbl, tbl
    );
  end loop;
end;
$$;

-- company-assets (special name with hyphen)
alter table public."company-assets" alter column company_id set not null;
alter table public."company-assets"
  add constraint "company-assets_company_id_fkey"
  foreign key (company_id) references public.companies(id) on delete restrict;

commit;
