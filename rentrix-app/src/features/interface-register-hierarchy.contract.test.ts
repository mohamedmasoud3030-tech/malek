import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

function read(rel: string) {
  return readFileSync(resolve(root, 'src', rel), 'utf8');
}

/**
 * Cross-register mobile hierarchy lock (interface architecture M2/M3).
 * Every high-traffic operational register must declare EntityTable/DataTable
 * column priorities so phone cards show the right operational datum.
 */
describe('interface register mobile hierarchy', () => {
  const cases: Array<{ file: string; datum: string; identityHint: string }> = [
    { file: 'features/properties/properties-list-page.tsx', datum: 'status', identityHint: "priority: \"identity\"" },
    { file: 'features/units/units-page.tsx', datum: 'status', identityHint: 'priority: "identity"' },
    { file: 'features/tenants/TenantsPage.tsx', datum: 'arrears', identityHint: "priority: 'identity'" },
    { file: 'features/financials/components/invoice-list-section.tsx', datum: 'remaining', identityHint: "priority: 'identity'" },
    { file: 'features/financials/receipts/receipts-page.tsx', datum: 'amount', identityHint: "priority: 'identity'" },
    { file: 'features/financials/deposits/deposits-workspace.tsx', datum: 'remaining', identityHint: "priority: 'identity'" },
    { file: 'features/service-providers/service-providers-page.tsx', datum: 'status', identityHint: "priority: 'identity'" },
    { file: 'features/owners/components/owner-workspace-table.tsx', datum: 'contracts', identityHint: "priority: 'identity'" },
    { file: 'features/contracts/components/ContractTable.tsx', datum: 'tenant', identityHint: 'priority: "identity"' },
    { file: 'features/maintenance/components/maintenance-list.tsx', datum: 'status', identityHint: 'priority: "identity"' },
    { file: 'features/financials/components/expenses-section.tsx', datum: 'amount', identityHint: "priority: 'identity'" },
    { file: 'features/financials/reconciliation/bank-reconciliation-page.tsx', datum: 'amount', identityHint: "priority: 'identity'" },
  ];

  it.each(cases)('$file exposes $datum as mobile datum with identity/actions priorities', ({ file, datum, identityHint }) => {
    const source = read(file);
    expect(source, file).toContain(`mobileVisibleSecondaryKey="${datum}"`);
    expect(source, file).toContain(identityHint);
    expect(source, file).toMatch(/priority:\s*['"]actions['"]/);
    expect(source, file).toMatch(/priority:\s*['"]primary['"]/);
  });
});

describe('dashboard queue error honesty', () => {
  it('does not paint successful empty queues while snapshot load failed', () => {
    const overdue = read('features/dashboard/components/overdue-section.tsx');
    const expiring = read('features/dashboard/components/expiring-contracts-section.tsx');
    const page = read('features/dashboard/dashboard-page.tsx');
    expect(overdue).toContain('isError');
    expect(expiring).toContain('isError');
    expect(overdue).toContain('تعذر تحميل المتأخرات');
    expect(expiring).toContain('تعذر تحميل العقود المنتهية قريباً');
    expect(page).toContain('isError={hasDashboardError}');
  });
});
