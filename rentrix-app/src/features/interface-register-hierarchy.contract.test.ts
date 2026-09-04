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
    if (requireActions) expect(source, file).toMatch(/priority:\s*['"]actions['"]/);
    expect(source, file).not.toMatch(/key:\s*['"][^'"]+['"]\s*,\s*priority:\s*['"][^'"]+['"]\s*,\s*label:/);
  });
});

describe('owners canonical list contract', () => {
  it('uses the shared list runtime and keeps relationship management out of the directory', () => {
    const page = read('features/owners/OwnersPage.tsx');
    const table = read('features/owners/components/owner-workspace-table.tsx');
    const detail = read('features/owners/components/owner-detail-view.tsx');

    expect(page).toContain('<ListPage');
    expect(page).toContain('workspaceName="owners"');
    expect(page).toContain('viewModeStorageKey="malek:list-page:owners"');
    expect(page).not.toContain('OwnerMobileRelationships');
    expect(page).not.toContain('data-owner-relationships');
    expect(page).not.toContain('OwnershipLinkForm');
    expect(table).not.toContain("id: 'relationships'");
    expect(table).not.toContain("key: 'ownership'");
    expect(table).not.toContain('<DataTableColumnsMenu');
    expect(detail).toContain('<OwnerRelationshipManager');
    expect(detail).toContain("id=\"portfolio\"");
  });

  it('keeps header action then canonical toolbar then summary then one register', () => {
    const page = read('features/owners/OwnersPage.tsx');
    const primaryActionIndex = page.indexOf('primaryAction={');
    const searchIndex = page.indexOf('search={{');
    const toolbarIndex = page.indexOf('toolbarActions={');
    const summaryIndex = page.indexOf('<RegisterMetricStrip');
    const registerIndex = page.indexOf('data-owner-register');

    expect(primaryActionIndex).toBeGreaterThan(-1);
    expect(searchIndex).toBeGreaterThan(primaryActionIndex);
    expect(toolbarIndex).toBeGreaterThan(searchIndex);
    expect(summaryIndex).toBeGreaterThan(toolbarIndex);
    expect(registerIndex).toBeGreaterThan(summaryIndex);
    expect(page.match(/data-owner-register/g)).toHaveLength(1);
  });
});

describe('dashboard queue error honesty', () => {
  it('keeps authoritative errors honest without restoring removed duplicate detail sections', () => {
    const collections = read('features/dashboard/components/collections-section.tsx');
    const needsAttention = read('features/dashboard/components/needs-attention-section.tsx');
    const page = read('features/dashboard/dashboard-page.tsx');

    expect(collections).toContain('isError');
    expect(needsAttention).toContain('isError');
    expect(collections).toContain('تعذر تحميل المتأخرات');
    expect(needsAttention).toContain('تعذر تحميل الحالات التي تحتاج انتباهاً');
    expect(page).toContain('DataRefreshAlert');
    expect(page).not.toContain('<MaintenanceSection');
    expect(page).not.toContain('<UpcomingContractsSection');
    expect(page).not.toContain('<PropertyHealthSection');
    expect(page).not.toContain('<OwnerObligationsSection');
  });
});
