-- ============================================================================
-- PHASE 2 of 5 — Add company_id (nullable) + Backfill
-- ============================================================================
--
-- ⚠️ يتطلب: Phase 1 مكتمل بنجاح
--
-- هذا الـmigration:
--   1. يضيف company_id nullable لكل جدول عملياتي
--   2. Backfill: يربط كل الصفوف الموجودة بالشركة الافتراضية
--   3. لا يعمل NOT NULL ولا FK ولا RLS
--
-- ============================================================================

begin;

-- ── Tier 1 Core ──────────────────────────────────────────────────────────

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

-- ── Tier 1 Extended ──────────────────────────────────────────────────────

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

-- ── Tier 2 Scoped ────────────────────────────────────────────────────────

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

-- ── Backfill ─────────────────────────────────────────────────────────────

do $$
declare
  default_company uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  tbl text;
begin
  -- Tier 1 Core + Extended
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
    'company_settings'
  ] loop
    execute format(
      'update public.%I set company_id = $1 where company_id is null',
      tbl
    ) using default_company;
  end loop;

  -- company-assets (hyphenated name)
  update public."company-assets" set company_id = default_company
    where company_id is null;

  -- Tier 2
  for tbl in array[
    'automation_rules', 'automation_runs', 'automation_run_logs',
    'automation_notifications', 'notifications', 'app_notifications',
    'notification_templates', 'outgoing_notifications',
    'communication_records', 'missions', 'attachments'
  ] loop
    execute format(
      'update public.%I set company_id = $1 where company_id is null',
      tbl
    ) using default_company;
  end loop;
end;
$$;

commit;
