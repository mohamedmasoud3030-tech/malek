-- ============================================================================
-- PHASE 3 of 5 — Verification: Zero NULL company_id check
-- ============================================================================
--
-- ⚠️ يتطلب: Phase 2 مكتمل بنجاح
--
-- هذا الـmigration:
--   - يستعلم عن عدد الصفوف بـ company_id IS NULL في كل جدول
--   - يرفع exception لو أي جدول فيه صفوف NULL
--   - لو نجح (كل الأرقام صفر) → آمن نكمل لـ Phase 4
--
-- بعد تشغيل هذا، انسخ النتيجة ووريني إياها في المحادثة.
--
-- ============================================================================

-- ── استعلام التحقق (SELECT فقط — لا يغير بيانات) ────────────────────────

-- لو بتشغّل من Supabase SQL Editor، نفّذ الاستعلام ده:

select 'properties' as table_name, count(*) as null_count from public.properties where company_id is null
union all select 'property_owners', count(*) from public.property_owners where company_id is null
union all select 'owners', count(*) from public.owners where company_id is null
union all select 'units', count(*) from public.units where company_id is null
union all select 'people', count(*) from public.people where company_id is null
union all select 'tenants', count(*) from public.tenants where company_id is null
union all select 'contracts', count(*) from public.contracts where company_id is null
union all select 'invoices', count(*) from public.invoices where company_id is null
union all select 'payments', count(*) from public.payments where company_id is null
union all select 'receipts', count(*) from public.receipts where company_id is null
union all select 'receipt_allocations', count(*) from public.receipt_allocations where company_id is null
union all select 'expenses', count(*) from public.expenses where company_id is null
union all select 'maintenance_records', count(*) from public.maintenance_records where company_id is null
union all select 'contract_balances', count(*) from public.contract_balances where company_id is null
union all select 'owner_balances', count(*) from public.owner_balances where company_id is null
union all select 'accounts', count(*) from public.accounts where company_id is null
union all select 'journal_entries', count(*) from public.journal_entries where company_id is null
union all select 'lands', count(*) from public.lands where company_id is null
union all select 'leads', count(*) from public.leads where company_id is null
union all select 'commissions', count(*) from public.commissions where company_id is null
union all select 'utility_bills', count(*) from public.utility_bills where company_id is null
union all select 'utility_meters', count(*) from public.utility_meters where company_id is null
union all select 'vault_documents', count(*) from public.vault_documents where company_id is null
union all select 'contract_documents', count(*) from public.contract_documents where company_id is null
union all select 'owner_settlements', count(*) from public.owner_settlements where company_id is null
union all select 'deposit_txs', count(*) from public.deposit_txs where company_id is null
union all select 'deposit_transactions', count(*) from public.deposit_transactions where company_id is null
union all select 'tenant_deposits', count(*) from public.tenant_deposits where company_id is null
union all select 'bank_accounts', count(*) from public.bank_accounts where company_id is null
union all select 'bank_statement_imports', count(*) from public.bank_statement_imports where company_id is null
union all select 'bank_statement_lines', count(*) from public.bank_statement_lines where company_id is null
union all select 'bank_reconciliation_matches', count(*) from public.bank_reconciliation_matches where company_id is null
union all select 'budgets', count(*) from public.budgets where company_id is null
union all select 'company-assets', count(*) from public."company-assets" where company_id is null
union all select 'account_balances', count(*) from public.account_balances where company_id is null
union all select 'tenant_balances', count(*) from public.tenant_balances where company_id is null
union all select 'serials', count(*) from public.serials where company_id is null
union all select 'status_history', count(*) from public.status_history where company_id is null
union all select 'status_transition_rules', count(*) from public.status_transition_rules where company_id is null
union all select 'kpi_snapshots', count(*) from public.kpi_snapshots where company_id is null
union all select 'snapshots', count(*) from public.snapshots where company_id is null
union all select 'company_settings', count(*) from public.company_settings where company_id is null
union all select 'automation_rules', count(*) from public.automation_rules where company_id is null
union all select 'automation_runs', count(*) from public.automation_runs where company_id is null
union all select 'automation_run_logs', count(*) from public.automation_run_logs where company_id is null
union all select 'automation_notifications', count(*) from public.automation_notifications where company_id is null
union all select 'notifications', count(*) from public.notifications where company_id is null
union all select 'app_notifications', count(*) from public.app_notifications where company_id is null
union all select 'notification_templates', count(*) from public.notification_templates where company_id is null
union all select 'outgoing_notifications', count(*) from public.outgoing_notifications where company_id is null
union all select 'communication_records', count(*) from public.communication_records where company_id is null
union all select 'missions', count(*) from public.missions where company_id is null
union all select 'attachments', count(*) from public.attachments where company_id is null
order by table_name;

-- ── Guard: لو فيه أي NULL → exception تمنع التقدم ───────────────────────

do $$
declare
  tbl text;
  null_count bigint;
  total_nulls bigint := 0;
  failing_tables text[] := '{}';
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
    execute format('select count(*) from public.%I where company_id is null', tbl) into null_count;
    if null_count > 0 then
      failing_tables := failing_tables || tbl;
      total_nulls := total_nulls + null_count;
    end if;
  end loop;

  -- company-assets
  select count(*) into null_count from public."company-assets" where company_id is null;
  if null_count > 0 then
    failing_tables := failing_tables || '"company-assets"';
    total_nulls := total_nulls + null_count;
  end if;

  raise notice '=== PHASE 3 VERIFICATION ===';
  raise notice 'Total NULL company_id rows: %', total_nulls;

  if total_nulls > 0 then
    raise exception
      'PHASE 3 FAILED: % rows with NULL company_id in tables: % — DO NOT PROCEED',
      total_nulls, array_to_string(failing_tables, ', ')
      using hint = 'Investigate why these rows were not backfilled in Phase 2.';
  else
    raise notice 'ALL CLEAR: Every row has a valid company_id. Safe to proceed to Phase 4.';
  end if;
end;
$$;
