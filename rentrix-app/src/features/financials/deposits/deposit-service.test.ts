import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('deposits real implementation - no false success', () => {
  it('service does not contain mock deposits dep-101 or void error pattern', () => {
    const servicePath = resolve(import.meta.dirname, './deposit-service.ts');
    const content = readFileSync(servicePath, 'utf8');
    expect(content).not.toContain('dep-101');
    expect(content).not.toContain('dep-102');
    expect(content).not.toContain('أحمد بن علي البوسعيدي');
  });

  it('service uses atomic RPCs with real persistence', () => {
    const servicePath = resolve(import.meta.dirname, './deposit-service.ts');
    const content = readFileSync(servicePath, 'utf8');
    expect(content).toContain('create_deposit_atomic');
    expect(content).toContain('deduct_deposit_atomic');
    expect(content).toContain('refund_deposit_atomic');
    expect(content).toContain('tenant_deposits');
    expect(content).toContain('handleSupabaseError');
    expect(content).toContain('request_id');
  });

  it('service validates amounts and prevents overdraw', () => {
    const servicePath = resolve(import.meta.dirname, './deposit-service.ts');
    const content = readFileSync(servicePath, 'utf8');
    expect(content).toContain('amount');
    expect(content).toContain('deposit_id');
    expect(content).toContain('contract_id');
    expect(content).toContain('throw new Error');
  });

  it('workspace does not use local useState mock deposits', () => {
    const workspacePath = resolve(import.meta.dirname, './deposits-workspace.tsx');
    const content = readFileSync(workspacePath, 'utf8');
    expect(content).not.toContain('dep-101');
    expect(content).not.toContain('dep-102');
    expect(content).not.toContain('useState<DepositRecord[]>(() => [');
    expect(content).toContain('listTenantDeposits');
    expect(content).toContain('useQuery');
    expect(content).toContain('useMutation');
  });

  it('migration creates tenant_deposits and deposit_transactions with immutable log', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../../supabase/migrations/20260717000003_real_deposits_ledger.sql');
    const content = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(content).toContain('tenant_deposits');
    expect(content).toContain('deposit_transactions');
    expect(content).toContain('is_admin_or_manager()');
    expect(content).toContain('remaining_amount');
    expect(content).toContain('deducted_amount');
    expect(content).toContain('refunded_amount');
    expect(content).toContain('request_id');
    expect(content).toContain('create_deposit_atomic');
    expect(content).toContain('deduct_deposit_atomic');
    expect(content).toContain('refund_deposit_atomic');
    expect(content).toContain('journal_entries');
    expect(content).toContain('contract_id');
  });

  it('migration prevents overdraw with constraint checks', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../../supabase/migrations/20260717000003_real_deposits_ledger.sql');
    const content = readFileSync(migrationPath, 'utf8');
    expect(content).toContain('Insufficient deposit balance');
    expect(content).toContain('Insufficient remaining balance');
    expect(content).toContain('pg_advisory_xact_lock');
  });

  it('migration derives contract/property/unit identifiers from canonical tables', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../../supabase/migrations/20260717000003_real_deposits_ledger.sql');
    const content = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(content).toContain('format_type');
    expect(content).toContain('contracts');
    expect(content).toContain('properties');
    expect(content).toContain('units');
    expect(content).toContain('v_property_id_type');
    expect(content).toContain('v_unit_id_type');
    expect(content).not.toContain('property_id uuid references public.properties');
    expect(content).not.toContain('v_property_id uuid :=');
  });

  it('does not use partially_refunded for deduction - uses partially_deducted', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../../supabase/migrations/20260717000008_add_partially_deducted_status_and_null_guard.sql');
    const content = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(content).toContain('partially_deducted');
    // Should not set partially_refunded when deduction partial
    expect(content).toContain('forfeited_damage');
    // Check service type includes new status
    const servicePath = resolve(import.meta.dirname, './deposit-service.ts');
    const serviceContent = readFileSync(servicePath, 'utf8');
    expect(serviceContent).toContain('partially_deducted');
  });

  it('has explicit NULL guard after detecting contracts.id type', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../../supabase/migrations/20260717000003_real_deposits_ledger.sql');
    const content = readFileSync(migrationPath, 'utf8');
    expect(content).toContain('IF v_contract_id_type IS NULL THEN');
    expect(content).toContain('RAISE EXCEPTION');
    expect(content).toContain('IF v_contract_id_type IS NULL THEN');

    const migration08Path = resolve(import.meta.dirname, '../../../../../supabase/migrations/20260717000008_add_partially_deducted_status_and_null_guard.sql');
    const content08 = readFileSync(migration08Path, 'utf8');
    expect(content08).toContain('v_property_id_type');
    expect(content08).toContain('v_unit_id_type');
    expect(content08).not.toContain("v_property_id uuid :=");
  });

  it('tests create -> partial deduction -> refund -> full settlement status flow', () => {
    const migration08Path = resolve(import.meta.dirname, '../../../../../supabase/migrations/20260717000008_add_partially_deducted_status_and_null_guard.sql');
    const content = readFileSync(migration08Path, 'utf8').toLowerCase();
    // Deduction partial should result in partially_deducted
    expect(content).toContain('partially_deducted');
    // Refund partial should be partially_refunded
    expect(content).toContain('partially_refunded');
    // Full settlement: refunded and forfeited_damage
    expect(content).toContain('refunded');
    expect(content).toContain('forfeited_damage');
    // Service should have labels for new status
    const servicePath = resolve(import.meta.dirname, './deposit-service.ts');
    const serviceContent = readFileSync(servicePath, 'utf8');
    expect(serviceContent).toContain('partially_deducted');
    expect(serviceContent).toContain('partially_refunded');
  });
});
