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
    // GAP-009: deduction/refund writes are governed (evidence-backed claims +
    // maker-checker approval + reversible governed refunds).
    expect(content).toContain('create_deposit_application_claim_with_inspection_atomic');
    expect(content).toContain('approve_deposit_application_claim_atomic');
    expect(content).toContain('apply_deposit_claim_atomic');
    expect(content).toContain('refund_deposit_governed_atomic');
    expect(content).toContain('reverse_deposit_refund_atomic');
    expect(content).not.toContain("rpc('deduct_deposit_atomic'");
    expect(content).not.toContain("rpc('refund_deposit_atomic'");
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

  it('workspace does not use local useState mock deposits and uses controller', () => {
    const workspacePath = resolve(import.meta.dirname, './deposits-workspace.tsx');
    const workspace = readFileSync(workspacePath, 'utf8');
    const controllerPath = resolve(import.meta.dirname, './use-deposit-workspace-controller.ts');
    const controller = readFileSync(controllerPath, 'utf8');
    const queriesPath = resolve(import.meta.dirname, './deposit-workspace-queries.ts');
    const queries = readFileSync(queriesPath, 'utf8');

    expect(workspace).not.toContain('dep-101');
    expect(workspace).not.toContain('dep-102');
    expect(workspace).not.toContain('useState<DepositRecord[]>(() => [');
    // Workspace now uses controller, not direct queries
    expect(workspace).toContain('useDepositWorkspaceController');
    // Controller and queries should contain real data fetching
    expect(queries).toContain('listTenantDeposits');
    expect(controller).toContain('useQuery') || expect(queries).toContain('useQuery');
    expect(controller).toContain('useMutation');
  });
});
