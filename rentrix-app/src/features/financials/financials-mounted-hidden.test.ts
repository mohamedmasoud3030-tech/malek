import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Financials active-view architecture verification.
 * Only the active Money view is mounted; inactive workspaces are not kept hidden.
 */
const source = readFileSync(new URL('../finance/FinancePage.tsx', import.meta.url), 'utf8');

describe('canonical FinancePage active-view architecture', () => {
  it('does not retain the retired mounted-but-hidden pattern', () => {
    expect(source).not.toContain('mountedViews');
    expect(source).not.toContain('mountedViews.current.add');
    expect(source).not.toContain('shouldRenderView');
    expect(source).not.toMatch(/hidden=\{activeSection !== .* \|\| activeView !==/);
  });

  it('renders each active panel conditionally', () => {
    // The legacy overview section redirects to the primary collections job
    // (see shell/financeShellModel.ts), so it has no dedicated panel here.
    expect(source).toContain("activeSection === 'collections' && activeView === 'invoices'");
    expect(source).toContain("activeSection === 'collections' && activeView === 'receipts'");
    expect(source).toContain("activeSection === 'collections' && activeView === 'arrears'");
    expect(source).toContain("activeSection === 'fees' && activeView === 'fixed_monthly_accruals'");
    expect(source).toContain("activeSection === 'fees' && activeView === 'commissions'");
    expect(source).toContain("activeSection === 'expenses' && activeView === 'expenses'");
    expect(source).toContain("activeSection === 'funds' && activeView === 'deposits'");
    expect(source).toContain("activeSection === 'funds' && activeView === 'owner_settlements'");
    expect(source).toContain("activeSection === 'banking' && activeView === 'bank_reconciliation'");
  });

  it('keeps business workspaces lazy-loaded via Suspense', () => {
    for (const workspace of ['InvoicesWorkspace', 'ReceiptsWorkspace', 'ExpensesWorkspace', 'CommissionsWorkspace']) {
      expect(source).toContain(`${workspace} = lazy(`);
    }
    expect(source).toContain('<Suspense');
  });

  it('keeps accessible tabpanel semantics on active panels', () => {
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain('id="finance-view-panel-');
  });
});
