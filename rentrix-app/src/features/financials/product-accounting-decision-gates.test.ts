import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const readRepoFile = (path: string) => readFileSync(`${repoRoot}${path}`, 'utf8');

const requiredDecisionGates = [
  'Office fee rules',
  'Master lease accounting',
  'Daily/open-ended contract behavior',
  'Utility bill posting',
  'Maintenance charge allocation',
  'Tenant deposits',
  'Deferred revenue / accounting basis',
] as const;

const relatedFeatureGaps = ['FGR-008', 'FGR-009', 'FGR-010', 'FGR-011', 'FGR-012', 'FGR-013'] as const;

describe('product accounting decision gates', () => {
  it('documents every decided Phase 5 accounting/product gate and required implementation proof', () => {
    const gates = readRepoFile('docs/PRODUCT_ACCOUNTING_DECISION_GATES.md');

    for (const gate of requiredDecisionGates) {
      expect(gates).toContain(gate);
    }

    expect(gates).toContain('Product decided; implementation required');
    expect(gates).toContain('docs/decisions/0001-product-accounting-policies.md');
    expect(gates).toContain('VOID, reversal, soft-delete, cancellation, backdated adjustment, rounding, and permission behavior');
  });

  it('keeps decided-but-unimplemented accounting blockers visible in the feature gap register', () => {
    const register = readRepoFile('docs/FEATURE_GAP_REGISTER.md');

    for (const id of relatedFeatureGaps) {
      expect(register).toContain(`| ${id} |`);
    }

    expect(register).toContain('Product decided; implementation required');
    expect(register).toContain('docs/decisions/0001-product-accounting-policies.md');
    expect(register).not.toMatch(/\| FGR-00[89] \|[^\n]+\| Closed \|/);
    expect(register).not.toMatch(/\| FGR-01[0-3] \|[^\n]+\| Closed \|/);
  });
});
