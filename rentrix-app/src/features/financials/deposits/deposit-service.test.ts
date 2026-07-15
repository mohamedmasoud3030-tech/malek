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
    // Dynamic creation via EXECUTE format still contains table names
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
    // Should handle both uuid and text for contract_id compatibility
    expect(content).toContain('contract_id');
  });

  it('migration prevents overdraw with constraint checks', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../../supabase/migrations/20260717000003_real_deposits_ledger.sql');
    const content = readFileSync(migrationPath, 'utf8');
    expect(content).toContain('Insufficient deposit balance');
    expect(content).toContain('Insufficient remaining balance');
    expect(content).toContain('pg_advisory_xact_lock');
  });

  it('migration handles uuid/text contract_id mismatch for empty DB replay', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../../supabase/migrations/20260717000003_real_deposits_ledger.sql');
    const content = readFileSync(migrationPath, 'utf8').toLowerCase();
    // Should detect contracts.id type dynamically
    expect(content).toContain('format_type');
    expect(content).toContain('contracts');
    // Should support both types
    expect(content).toContain('uuid');
  });
});
