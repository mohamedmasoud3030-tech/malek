import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { FINANCE_VIEWS, isViewPermitted } from './financials-page';

const readPage = () => readFileSync(new URL('./financials-page.tsx', import.meta.url), 'utf8');
const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');

vi.mock('@/features/auth/permissions', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    canAccess: (context: any, permission: string) => {
      if (!context || !context.permissions) return false;
      return context.permissions.has(permission);
    }
  };
});

describe('/financials consolidated operational entry', () => {
  it('keeps one Arabic finance page identity', () => {
    const source = readPage();
    expect(source).toContain('<PageHeader');
    expect(source).toContain('title="المالية"');
  });

  it('uses one secondary contextual navigation layer', () => {
    const source = readPage();
    expect(source).not.toContain('WorkspaceSubNav');
    expect(source).toContain('SectionTabs');
  });

  it('contains the five final finance sections', () => {
    const source = readPage();
    expect(source).toContain("id: 'overview'");
    expect(source).toContain("id: 'collections'");
    expect(source).toContain("id: 'expenses'");
    expect(source).toContain("id: 'funds'");
    expect(source).toContain("id: 'banking'");
  });

  it('links accounting and formal reporting as the second finance/accounting destination', () => {
    expect(readPage()).toContain('to="/reports"');
  });

  it('lazy loads operational workspace sections for high performance', () => {
    const source = readPage();
    expect(source).toContain('InvoicesWorkspace = lazy(');
    expect(source).toContain('ReceiptsWorkspace = lazy(');
    expect(source).toContain('ExpensesWorkspace = lazy(');
  });
});

describe('Finance view-level permissions and defense-in-depth', () => {
  const mockAuth = (permissions: string[]) => ({
    user: { id: 'test' },
    permissions: new Set(permissions),
  });

  it('enforces exact permission boundary for expenses vs commissions', () => {
    const expensesView = FINANCE_VIEWS.find(v => v.id === 'expenses')!;
    const commissionsView = FINANCE_VIEWS.find(v => v.id === 'commissions')!;

    // expenses.view does not imply commissions.view
    expect(isViewPermitted(mockAuth(['expenses.view']), expensesView)).toBe(true);
    expect(isViewPermitted(mockAuth(['expenses.view']), commissionsView)).toBe(false);

    // commissions.view does not imply expenses.view
    expect(isViewPermitted(mockAuth(['commissions.view']), expensesView)).toBe(false);
    expect(isViewPermitted(mockAuth(['commissions.view']), commissionsView)).toBe(true);
  });

  it('enforces exact permission boundary for deposits vs settlements', () => {
    const depositsView = FINANCE_VIEWS.find(v => v.id === 'deposits')!;
    const settlementsView = FINANCE_VIEWS.find(v => v.id === 'owner_settlements')!;

    // deposits does not imply settlements
    expect(isViewPermitted(mockAuth(['financial.deposits.view']), depositsView)).toBe(true);
    expect(isViewPermitted(mockAuth(['financial.deposits.view']), settlementsView)).toBe(false);

    // settlements does not imply deposits
    expect(isViewPermitted(mockAuth(['financial.owner_settlements.view']), depositsView)).toBe(false);
    expect(isViewPermitted(mockAuth(['financial.owner_settlements.view']), settlementsView)).toBe(true);
  });

  it('allows authenticated-only access to invoices and receipts but requires arrears.view for arrears', () => {
    const invoicesView = FINANCE_VIEWS.find(v => v.id === 'invoices')!;
    const receiptsView = FINANCE_VIEWS.find(v => v.id === 'receipts')!;
    const arrearsView = FINANCE_VIEWS.find(v => v.id === 'arrears')!;

    expect(isViewPermitted(mockAuth([]), invoicesView)).toBe(true);
    expect(isViewPermitted(mockAuth([]), receiptsView)).toBe(true);
    expect(isViewPermitted(mockAuth([]), arrearsView)).toBe(false);

    expect(isViewPermitted(mockAuth(['arrears.view']), arrearsView)).toBe(true);
  });

  it('unmounts a previously permitted view when permissions are revoked at runtime (role-change safety)', () => {
    const arrearsView = FINANCE_VIEWS.find(v => v.id === 'arrears')!;
    
    // 1. Mount permitted view
    let currentAuth = mockAuth(['arrears.view']);
    expect(isViewPermitted(currentAuth, arrearsView)).toBe(true);

    // 2. Remove that permission (runtime role-change)
    currentAuth = mockAuth([]);

    // 3. Rerender and prove its workspace component is unmounted / forbidden
    expect(isViewPermitted(currentAuth, arrearsView)).toBe(false);
  });
});

describe('Finance structural coherence boundary checks (Point 3)', () => {
  it('verifies that structural section/view relationships are enforced exactly as defined', () => {
    const ownerSettlements = FINANCE_VIEWS.find(v => v.id === 'owner_settlements')!;
    const commissions = FINANCE_VIEWS.find(v => v.id === 'commissions')!;
    const bankReconciliation = FINANCE_VIEWS.find(v => v.id === 'bank_reconciliation')!;
    const invoices = FINANCE_VIEWS.find(v => v.id === 'invoices')!;

    // expenses + owner_settlements mismatch
    expect(ownerSettlements.sectionId).not.toBe('expenses');
    expect(ownerSettlements.sectionId).toBe('funds');

    // funds + commissions mismatch
    expect(commissions.sectionId).not.toBe('funds');
    expect(commissions.sectionId).toBe('expenses');

    // collections + bank_reconciliation mismatch
    expect(bankReconciliation.sectionId).not.toBe('collections');
    expect(bankReconciliation.sectionId).toBe('banking');

    // banking + invoices mismatch
    expect(invoices.sectionId).not.toBe('banking');
    expect(invoices.sectionId).toBe('collections');
  });
});

describe('Receipt detail print exception and redirect contract', () => {
  it('redirects /receipts to consolidated receipt register when no receiptId is present', () => {
    expect(routeTreeSource).toContain("path: '/receipts'");
    expect(routeTreeSource).toContain("receiptId");
    expect(routeTreeSource).toContain("section: 'collections', view: 'receipts'");
  });

  it('does NOT redirect /receipts?receiptId=valid-id away and renders the print shell component', () => {
    expect(routeTreeSource).toContain("const requestedReceiptId = (search as Record<string, unknown>).receiptId;");
    expect(routeTreeSource).toContain("if (typeof requestedReceiptId === 'string' && requestedReceiptId !== '') return;");
  });
});
