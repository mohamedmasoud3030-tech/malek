import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('reports depth contract', () => {
  it('keeps arrears as a row-level analytical report with actionable context', () => {
    const arrears = read('./components/overdue/overdue-invoices-panel.tsx');

    for (const field of [
      'المتأخر',
      'العقار',
      'الوحدة',
      'العقد',
      'الفاتورة',
      'الاستحقاق',
      'أيام التأخير',
      'المبلغ الأصلي',
      'المدفوع',
      'المتبقي',
      'Aging',
      'الإجراء التالي',
    ]) {
      expect(arrears).toContain(field);
    }
    expect(arrears).toContain('EntityPreviewDialog');
  });

  it('keeps cash-flow UI on the current accounting authority', () => {
    const statements = read('./components/statements/statement-summary-panels.tsx');

    expect(statements).toContain("type { CashFlowReport } from '@/features/accounting/reports/accountingReportsFacade'");
    expect(statements).toContain('cashFlow: CashFlowReport | undefined');
    expect(statements).toContain('VatReturnReport');
    expect(statements).not.toContain('CashFlowStatementReport');
  });
});
