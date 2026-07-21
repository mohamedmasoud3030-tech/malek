-- ============================================================================
-- PHASE 2 — إضافة company_id (nullable) + Backfill
-- ============================================================================
-- ⚠️ نفّذ ده في Supabase SQL Editor
-- ⚠️ default company ID = 00000000-0000-4000-8000-000000000001
-- ⚠️ NO NOT NULL, NO FK, NO RLS — بس add column + UPDATE
-- ============================================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- الخطوة 1: إضافة company_id nullable لكل جدول
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

alter table public.properties add column if not exists company_id uuid;
alter table public.property_owners add column if not exists company_id uuid;
alter table public.owners add column if not exists company_id uuid;
alter table public.units add column if not exists company_id uuid;
alter table public.people add column if not exists company_id uuid;
alter table public.tenants add column if not exists company_id uuid;
alter table public.contracts add column if not exists company_id uuid;
alter table public.invoices add column if not exists company_id uuid;
alter table public.payments add column if not exists company_id uuid;
alter table public.receipts add column if not exists company_id uuid;
alter table public.receipt_allocations add column if not exists company_id uuid;
alter table public.expenses add column if not exists company_id uuid;
alter table public.maintenance_records add column if not exists company_id uuid;
alter table public.contract_balances add column if not exists company_id uuid;
alter table public.owner_balances add column if not exists company_id uuid;
alter table public.accounts add column if not exists company_id uuid;
alter table public.journal_entries add column if not exists company_id uuid;
alter table public.lands add column if not exists company_id uuid;
alter table public.leads add column if not exists company_id uuid;
alter table public.commissions add column if not exists company_id uuid;
alter table public.utility_bills add column if not exists company_id uuid;
alter table public.utility_meters add column if not exists company_id uuid;
alter table public.vault_documents add column if not exists company_id uuid;
alter table public.contract_documents add column if not exists company_id uuid;
alter table public.owner_settlements add column if not exists company_id uuid;
alter table public.deposit_txs add column if not exists company_id uuid;
alter table public.deposit_transactions add column if not exists company_id uuid;
alter table public.tenant_deposits add column if not exists company_id uuid;
alter table public.bank_accounts add column if not exists company_id uuid;
alter table public.bank_statement_imports add column if not exists company_id uuid;
alter table public.bank_statement_lines add column if not exists company_id uuid;
alter table public.bank_reconciliation_matches add column if not exists company_id uuid;
alter table public.budgets add column if not exists company_id uuid;
alter table public."company-assets" add column if not exists company_id uuid;
alter table public.account_balances add column if not exists company_id uuid;
alter table public.tenant_balances add column if not exists company_id uuid;
alter table public.serials add column if not exists company_id uuid;
alter table public.status_history add column if not exists company_id uuid;
alter table public.status_transition_rules add column if not exists company_id uuid;
alter table public.kpi_snapshots add column if not exists company_id uuid;
alter table public.snapshots add column if not exists company_id uuid;
alter table public.company_settings add column if not exists company_id uuid;
alter table public.automation_rules add column if not exists company_id uuid;
alter table public.automation_runs add column if not exists company_id uuid;
alter table public.automation_run_logs add column if not exists company_id uuid;
alter table public.automation_notifications add column if not exists company_id uuid;
alter table public.notifications add column if not exists company_id uuid;
alter table public.app_notifications add column if not exists company_id uuid;
alter table public.notification_templates add column if not exists company_id uuid;
alter table public.outgoing_notifications add column if not exists company_id uuid;
alter table public.communication_records add column if not exists company_id uuid;
alter table public.missions add column if not exists company_id uuid;
alter table public.attachments add column if not exists company_id uuid;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- الخطوة 2: Backfill — ربط كل الصفوف بالشركة الافتراضية
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

do $$
declare
  default_company uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  tbl text;
  updated bigint;
  total_updated bigint := 0;
begin
  for tbl in array[
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
    execute format(
      'update public.%I set company_id = $1 where company_id is null',
      tbl
    ) using default_company;

    get diagnostics updated = row_count;
    total_updated := total_updated + updated;
    raise notice '  % → % rows backfilled', tbl, updated;
  end loop;

  -- company-assets (اسم فيه hyphen)
  update public."company-assets" set company_id = default_company
    where company_id is null;
  get diagnostics updated = row_count;
  total_updated := total_updated + updated;
  raise notice '  "company-assets" → % rows backfilled', updated;

  raise notice '';
  raise notice '╔══════════════════════════════════════╗';
  raise notice '║ TOTAL ROWS BACKFILLED: %', total_updated;
  raise notice '╚══════════════════════════════════════╝';
end;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- الخطوة 3: تحقق شامل — لازم كل NULL = 0
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select 'properties' as table_name, count(*) as total_rows, count(*) filter (where company_id is null) as null_count from public.properties
union all select 'property_owners', count(*), count(*) filter (where company_id is null) from public.property_owners
union all select 'owners', count(*), count(*) filter (where company_id is null) from public.owners
union all select 'units', count(*), count(*) filter (where company_id is null) from public.units
union all select 'people', count(*), count(*) filter (where company_id is null) from public.people
union all select 'tenants', count(*), count(*) filter (where company_id is null) from public.tenants
union all select 'contracts', count(*), count(*) filter (where company_id is null) from public.contracts
union all select 'invoices', count(*), count(*) filter (where company_id is null) from public.invoices
union all select 'payments', count(*), count(*) filter (where company_id is null) from public.payments
union all select 'receipts', count(*), count(*) filter (where company_id is null) from public.receipts
union all select 'receipt_allocations', count(*), count(*) filter (where company_id is null) from public.receipt_allocations
union all select 'expenses', count(*), count(*) filter (where company_id is null) from public.expenses
union all select 'maintenance_records', count(*), count(*) filter (where company_id is null) from public.maintenance_records
union all select 'contract_balances', count(*), count(*) filter (where company_id is null) from public.contract_balances
union all select 'owner_balances', count(*), count(*) filter (where company_id is null) from public.owner_balances
union all select 'accounts', count(*), count(*) filter (where company_id is null) from public.accounts
union all select 'journal_entries', count(*), count(*) filter (where company_id is null) from public.journal_entries
union all select 'lands', count(*), count(*) filter (where company_id is null) from public.lands
union all select 'leads', count(*), count(*) filter (where company_id is null) from public.leads
union all select 'commissions', count(*), count(*) filter (where company_id is null) from public.commissions
union all select 'utility_bills', count(*), count(*) filter (where company_id is null) from public.utility_bills
union all select 'utility_meters', count(*), count(*) filter (where company_id is null) from public.utility_meters
union all select 'vault_documents', count(*), count(*) filter (where company_id is null) from public.vault_documents
union all select 'contract_documents', count(*), count(*) filter (where company_id is null) from public.contract_documents
union all select 'owner_settlements', count(*), count(*) filter (where company_id is null) from public.owner_settlements
union all select 'deposit_txs', count(*), count(*) filter (where company_id is null) from public.deposit_txs
union all select 'deposit_transactions', count(*), count(*) filter (where company_id is null) from public.deposit_transactions
union all select 'tenant_deposits', count(*), count(*) filter (where company_id is null) from public.tenant_deposits
union all select 'bank_accounts', count(*), count(*) filter (where company_id is null) from public.bank_accounts
union all select 'bank_statement_imports', count(*), count(*) filter (where company_id is null) from public.bank_statement_imports
union all select 'bank_statement_lines', count(*), count(*) filter (where company_id is null) from public.bank_statement_lines
union all select 'bank_reconciliation_matches', count(*), count(*) filter (where company_id is null) from public.bank_reconciliation_matches
union all select 'budgets', count(*), count(*) filter (where company_id is null) from public.budgets
union all select 'company-assets', count(*), count(*) filter (where company_id is null) from public."company-assets"
union all select 'account_balances', count(*), count(*) filter (where company_id is null) from public.account_balances
union all select 'tenant_balances', count(*), count(*) filter (where company_id is null) from public.tenant_balances
union all select 'serials', count(*), count(*) filter (where company_id is null) from public.serials
union all select 'status_history', count(*), count(*) filter (where company_id is null) from public.status_history
union all select 'status_transition_rules', count(*), count(*) filter (where company_id is null) from public.status_transition_rules
union all select 'kpi_snapshots', count(*), count(*) filter (where company_id is null) from public.kpi_snapshots
union all select 'snapshots', count(*), count(*) filter (where company_id is null) from public.snapshots
union all select 'company_settings', count(*), count(*) filter (where company_id is null) from public.company_settings
union all select 'automation_rules', count(*), count(*) filter (where company_id is null) from public.automation_rules
union all select 'automation_runs', count(*), count(*) filter (where company_id is null) from public.automation_runs
union all select 'automation_run_logs', count(*), count(*) filter (where company_id is null) from public.automation_run_logs
union all select 'automation_notifications', count(*), count(*) filter (where company_id is null) from public.automation_notifications
union all select 'notifications', count(*), count(*) filter (where company_id is null) from public.notifications
union all select 'app_notifications', count(*), count(*) filter (where company_id is null) from public.app_notifications
union all select 'notification_templates', count(*), count(*) filter (where company_id is null) from public.notification_templates
union all select 'outgoing_notifications', count(*), count(*) filter (where company_id is null) from public.outgoing_notifications
union all select 'communication_records', count(*), count(*) filter (where company_id is null) from public.communication_records
union all select 'missions', count(*), count(*) filter (where company_id is null) from public.missions
union all select 'attachments', count(*), count(*) filter (where company_id is null) from public.attachments
order by table_name;
