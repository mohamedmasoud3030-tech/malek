import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('P5 — reports depth contract', () => {
  it('keeps Reports independent and makes arrears a row-level analytical report', () => {
    const nav = read('../../app/navigation/app-nav-items.ts');
    const workspace = read('./components/ReportsWorkspace.tsx');
    const arrears = read('./components/overdue/overdue-invoices-panel.tsx');
    expect(nav).toContain("['التقارير'");
    expect(nav).not.toContain("['المالية', ['/reports'");
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
