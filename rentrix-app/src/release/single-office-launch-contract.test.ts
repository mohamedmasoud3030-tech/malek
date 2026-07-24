import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { receiptStatusLabels } from '@/features/financials/components/receipt-formatters';

const repoRoot = resolve(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(resolve(repoRoot, path), 'utf8');

describe('single-office launch gate contract', () => {
  it('keeps the financial mutation smoke local-only and refuses Production', () => {
    const script = read('rentrix-app/scripts/single-office-isolated-smoke.mjs');
    expect(script).toContain("E2E_ENVIRONMENT_KIND.trim().toLowerCase() !== 'local'");
    expect(script).toContain('Refusing to run the single-office mutation smoke against Production.');
    expect(script).toContain('productionMutation: false');
    expect(script).toContain('must exist exactly once for the launch company');
    expect(script).toContain("select('id,amount,type,entity_type,entity_id')");
    expect(script).toContain("String(entry.type).toUpperCase() === 'DEBIT'");
    expect(script).toContain("String(entry.type).toUpperCase() === 'CREDIT'");
  });

  it('binds the release gate to the real authenticated payment and VOID browser path', () => {
    const workflow = read('.github/workflows/release-blocker-gate.yml');
    const databaseGate = read('scripts/ci/run-supabase-database-gate.sh');
    const spec = read('rentrix-app/e2e/single-office-isolated.spec.ts');
    expect(workflow).toContain('bash scripts/ci/run-supabase-database-gate.sh');
    expect(databaseGate).toContain('single-office-isolated-smoke.mjs seed');
    expect(databaseGate).toContain('single-office-isolated.spec.ts');
    expect(databaseGate).toContain('single-office-isolated-smoke.mjs verify');
    expect(spec).toContain('/rest/v1/rpc/record_invoice_payment_atomic');
    expect(spec).toContain('/rest/v1/rpc/void_receipt_atomic');
    expect(spec).toContain('تأكيد الإلغاء');
    expect(spec).toContain('test.describe.configure({ retries: 0 })');
  });

  it('shows VOID receipt history in Arabic', () => {
    expect(receiptStatusLabels.void).toBe('ملغي');
    expect(receiptStatusLabels.VOID).toBe('ملغي');
  });
});
