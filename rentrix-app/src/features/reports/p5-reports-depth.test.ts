import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { navGroups } from '../../app/navigation/app-nav-items';
import { getNavRoot } from '../../app/navigation/route-nav-map';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('P5 — reports depth contract', () => {
  it('keeps Reports independent and makes arrears a row-level analytical report', () => {
    const workspace = read('./components/ReportsWorkspace.tsx');
    const arrears = read('./components/overdue/overdue-invoices-panel.tsx');
    const globalItems = navGroups.flatMap(([, items]) => items);
    const reportsEntry = globalItems.find(([to]) => to === '/reports');
    const financialsEntry = globalItems.find(([to]) => to === '/financials');

    expect(reportsEntry).toBeDefined();
    expect(financialsEntry).toBeDefined();
    expect(getNavRoot('/reports')).toBe('/reports');
    expect(getNavRoot('/accounting')).toBe('/reports');
    expect(getNavRoot('/reports')).not.toBe('/financials');
    expect(workspace).toContain("onSectionViewChange('analytics', 'overdue')");
    for (const field of ['المتأخر', 'العقار', 'الوحدة', 'العقد', 'الفاتورة', 'الاستحقاق', 'أيام التأخير', 'المبلغ الأصلي', 'المدفوع', 'المتبقي', 'Aging', 'الإجراء التالي']) expect(arrears).toContain(field);
    expect(arrears).toContain('EntityPreviewDialog');
  });

  it('keeps accounting statements and regulatory reports in Reports with row/list foundations', () => {
    const accounting = read('./components/AccountingReportsSection.tsx');
    const statements = read('./components/statements/statement-summary-panels.tsx');
    expect(accounting).toContain('IncomeStatementPanel');
    expect(accounting).toContain('BalanceSheetPanel');
    expect(accounting).toContain('TrialBalancePanel');
    expect(statements).toContain('CashFlowStatementReport');
    expect(statements).toContain('VatReturnReport');
  });
});
