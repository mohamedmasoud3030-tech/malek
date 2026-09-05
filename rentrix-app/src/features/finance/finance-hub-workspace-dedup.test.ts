import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The Money hub must stay one workspace, not a stack of pages.
 *
 * Every operational view renders embedded: the hub owns the page header and
 * the tab rail, so the embedded view must not re-add a page shell, a second
 * title block, or navigation buttons that duplicate the hub itself. These
 * source contracts keep that invariant visible next to the existing
 * task-first contracts.
 */
const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const financePage = read('./FinancePage.tsx');
const depositsPage = read('../financials/deposits/deposits-page.tsx');
const depositsBody = read('../financials/deposits/deposits-workspace.tsx');
const accrualWorkspace = read(
  '../financials/fixed-monthly-accruals/fixed-monthly-accrual-workspace.tsx',
);
const receiptsPage = read('../financials/receipts/receipts-page.tsx');
const expensesPage = read('../financials/expenses/expenses-page.tsx');
const arrearsPage = read('../financials/arrears/arrears-page.tsx');
const arrearsWorkflow = read(
  '../financials/components/arrears-workflow-section.tsx',
);

describe('money hub embedded workspaces', () => {
  it('embeds deposits and fixed accruals so no nested page shell appears', () => {
    expect(financePage).toContain('<DepositsWorkspace embedded />');
    expect(financePage).toContain('<FixedMonthlyAccrualWorkspace embedded />');
  });

  it('keeps the deposits register free of a duplicated title strip', () => {
    // The create action lives in the canonical workspace header (hub actions
    // row / standalone PageHeader), not in a second h2 row inside the body.
    expect(depositsPage).toContain('openCreateForm');
    expect(depositsPage).toContain('primaryAction');
    expect(depositsPage).toContain('تأمينات المستأجرين');
    expect(depositsBody).not.toContain('<h2');
    expect(depositsBody).not.toContain('تسجيل وديعة جديدة');
  });

  it('presents fixed accruals through the shared embeddable workspace, without a legacy card header', () => {
    expect(accrualWorkspace).toContain('EmbeddableWorkspace');
    expect(accrualWorkspace).toContain('embedded = false');
    // Removed legacy chrome: the panel title block (CardTitle) and the second
    // register heading. The accessible table aria-label stays.
    expect(accrualWorkspace).not.toContain(
      '<CardTitle className="flex items-center gap-2 text-base">',
    );
    expect(accrualWorkspace).not.toContain('سجل الاستحقاقات</h3>');
    expect(accrualWorkspace).toContain(
      'aria-label="سجل استحقاقات أتعاب الإدارة الشهرية"',
    );
    expect(accrualWorkspace).toContain('احتساب الاستحقاقات');
    expect(accrualWorkspace).toContain('RegisterMetricStrip');
  });

  it('drops hub-duplicating navigation buttons when views render embedded', () => {
    // Receipts: the «return to /financials» shortcut only makes sense outside
    // the finance hub.
    expect(receiptsPage).toMatch(
      /embedded \? undefined : <Button[^>]*asChild><Link to="\/financials"/,
    );
    // Expenses: CSV export stays; the hub/reports jumps are standalone-only.
    expect(expensesPage).toContain('تصدير CSV');
    expect(expensesPage).toMatch(/\{embedded \? null : \(\n\s*<>/);
    // Arrears: invoice/receipt tabs are the hub subview strip itself.
    expect(arrearsPage).toMatch(
      /secondaryActions=\{\s*embedded \? undefined : \(/,
    );
  });

  it('renders the arrears investigation flow as register content, not a titled card', () => {
    expect(arrearsWorkflow).not.toContain(
      '<CardTitle>متابعة تحصيل المتأخرات</CardTitle>',
    );
    expect(arrearsWorkflow).not.toContain("from '@/components/ui/card'");
    expect(arrearsWorkflow).toContain('ArrearsFilters');
    expect(arrearsWorkflow).toContain('ArrearsSummaryCards');
    expect(arrearsWorkflow).toContain('OverdueInvoicesTable');
  });

  it('keeps the receipts register as one flat stack without a redundant wrapper', () => {
    expect(receiptsPage).toContain('<section data-receipts-register');
    expect(receiptsPage).not.toMatch(
      /<section data-receipts-register[^>]*>\s*<div className="min-w-0 space-y-2\.5">/,
    );
  });
});
