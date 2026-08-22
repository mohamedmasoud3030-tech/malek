import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

function read(rel: string) {
  return readFileSync(resolve(root, 'src', rel), 'utf8');
}

type RegisterCase = {
  file: string;
  datum: string;
  requireActions?: boolean;
};

/**
 * Cross-register mobile hierarchy lock (interface architecture).
 * Every high-traffic operational register must declare EntityTable/DataTable
 * column priorities so the horizontally scrollable table keeps a consistent identity/action contract.
 */
describe('interface register mobile hierarchy', () => {
  const cases: RegisterCase[] = [
    { file: 'features/properties/properties-list-page.tsx', datum: 'status' },
    { file: 'features/units/units-page.tsx', datum: 'status' },
    { file: 'features/tenants/TenantsPage.tsx', datum: 'arrears' },
    { file: 'features/financials/components/invoice-list-section.tsx', datum: 'remaining' },
    { file: 'features/financials/receipts/receipts-page.tsx', datum: 'amount' },
    { file: 'features/financials/deposits/deposit-table-columns.tsx', datum: 'remaining' },
    { file: 'features/service-providers/service-providers-page.tsx', datum: 'status' },
    { file: 'features/owners/components/owner-workspace-table.tsx', datum: 'contracts' },
    { file: 'features/contracts/components/ContractTable.tsx', datum: 'tenant' },
    { file: 'features/maintenance/components/maintenance-list.tsx', datum: 'status' },
    { file: 'features/financials/components/expenses-section.tsx', datum: 'amount' },
    { file: 'features/financials/reconciliation/bank-reconciliation-page.tsx', datum: 'amount' },
    { file: 'features/lands/components/lands-view.tsx', datum: 'status' },
    { file: 'features/leads/components/leads-view.tsx', datum: 'status' },
    { file: 'features/communication/components/communication-hub-view.tsx', datum: 'status' },
    { file: 'features/commissions/components/commissions-view.tsx', datum: 'amount' },
    { file: 'features/people/people-list-page.tsx', datum: 'type' },
    { file: 'features/financials/components/overdue-invoices-table.tsx', datum: 'remaining' },
    { file: 'features/financials/components/receipts-section.tsx', datum: 'amount' },
    { file: 'features/owners/components/OwnerSettlementWorkspace.tsx', datum: 'net' },
    { file: 'features/utilities/components/utilities-workspace.tsx', datum: 'amount' },
    { file: 'features/audit/components/audit-log-view.tsx', datum: 'action', requireActions: false },
    { file: 'features/automation/components/automation-center-view.tsx', datum: 'status' },
    { file: 'features/contracts/contractPaymentsTab.tsx', datum: 'remaining', requireActions: false },
    { file: 'features/reports/components/collections/daily-collections-panel.tsx', datum: 'total', requireActions: false },
    { file: 'features/reports/components/collections/rent-roll-panel.tsx', datum: 'status', requireActions: false },
    { file: 'features/reports/components/overdue/overdue-invoices-panel.tsx', datum: 'remaining' },
    { file: 'features/service-providers/service-provider-detail-page.tsx', datum: 'status', requireActions: false },
  ];

  it.each(cases)('$file keeps table priorities without a parallel mobile representation', ({ file, requireActions = true }) => {
    const source = read(file);
    expect(source, file).not.toContain('mobileVisibleSecondaryKey');
    expect(source, file).toMatch(/priority:\s*['"]identity['"]/);
    expect(source, file).toMatch(/priority:\s*['"]primary['"]/);
    if (requireActions) {
      expect(source, file).toMatch(/priority:\s*['"]actions['"]/);
    }
    // Active filter chips must not be polluted with column priorities.
    expect(source, file).not.toMatch(/key:\s*['"][^'"]+['"]\s*,\s*priority:\s*['"][^'"]+['"]\s*,\s*label:/);
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