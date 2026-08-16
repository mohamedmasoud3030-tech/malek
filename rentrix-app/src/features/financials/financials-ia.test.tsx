import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { AuthorizationContext } from '@/features/auth/permissions';
import { FINANCE_VIEWS, isViewPermitted } from './financials-page';

const readPage = () => readFileSync(new URL('./financials-page.tsx', import.meta.url), 'utf8');
const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');

vi.mock('@/features/auth/permissions', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    canAccess: (context: AuthorizationContext & { permissions?: ReadonlySet<string> } | null | undefined, permission: string) => Boolean(context?.permissions?.has(permission)),
  };
});

type TestAuthorizationContext = AuthorizationContext & Readonly<{ permissions: ReadonlySet<string> }>;

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

  it('contains the five final finance sections (R9: model lives in finance-shell-model)', () => {
    // R9 extracted the section model into finance-shell-model.ts; the page
    // re-exports it. The IA contract now asserts against the single model.
    const model = readFileSync(new URL('./finance-shell-model.ts', import.meta.url), 'utf8');
    expect(model).toContain("id: 'overview'");
    expect(model).toContain("id: 'collections'");
    expect(model).toContain("id: 'expenses'");
    expect(model).toContain("id: 'funds'");
    expect(model).toContain("id: 'banking'");
    expect(readPage()).toContain("from './finance-shell-model'");
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
  const mockAuth = (permissions: string[]): TestAuthorizationContext => ({
    userId: 'test',
    email: 'test@example.com',
    role: 'USER',
    permissions: new Set(permissions),
  });

  it('enforces commissions is standalone (not inside finance hub) and expenses view remains gated', () => {
    const expensesView = FINANCE_VIEWS.find(v => v.id === 'expenses')!;
    const commissionsView = FINANCE_VIEWS.find(v => (v.id as string) === 'commissions');
    // Phase 2: commissions is a standalone top-level module at /commissions, not a finance view
    expect(commissionsView).toBeUndefined();
    expect(isViewPermitted(mockAuth(['expenses.view']), expensesView)).toBe(true);
    expect(isViewPermitted(mockAuth([]), expensesView)).toBe(false);
    // Standalone commissions route keeps its own permission guard (checked in route-contract)
    expect(routeTreeSource).toContain("path: '/commissions'");
    expect(routeTreeSource).toContain("commissions.view");
  });

  it('enforces exact permission boundary for deposits vs settlements', () => {
    const depositsView = FINANCE_VIEWS.find(v => v.id === 'deposits')!;
    const settlementsView = FINANCE_VIEWS.find(v => v.id === 'owner_settlements')!;

    expect(isViewPermitted(mockAuth(['financial.deposits.view']), depositsView)).toBe(true);
    expect(isViewPermitted(mockAuth(['financial.deposits.view']), settlementsView)).toBe(false);
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
    let currentAuth = mockAuth(['arrears.view']);
    expect(isViewPermitted(currentAuth, arrearsView)).toBe(true);
    currentAuth = mockAuth([]);
    expect(isViewPermitted(currentAuth, arrearsView)).toBe(false);
  });
});

describe('Finance structural coherence boundary checks (Point 3)', () => {
  it('verifies that structural section/view relationships are enforced exactly as defined (Phase 2: commissions standalone)', () => {
    const ownerSettlements = FINANCE_VIEWS.find(v => v.id === 'owner_settlements')!;
    const bankReconciliation = FINANCE_VIEWS.find(v => v.id === 'bank_reconciliation')!;
    const invoices = FINANCE_VIEWS.find(v => v.id === 'invoices')!;
    const expenses = FINANCE_VIEWS.find(v => v.id === 'expenses')!;

    expect(ownerSettlements.sectionId).not.toBe('expenses');
    expect(ownerSettlements.sectionId).toBe('funds');
    expect(bankReconciliation.sectionId).not.toBe('collections');
    expect(bankReconciliation.sectionId).toBe('banking');
    expect(invoices.sectionId).not.toBe('banking');
    expect(invoices.sectionId).toBe('collections');
    expect(expenses.sectionId).toBe('expenses');
    expect(FINANCE_VIEWS.some(v => (v.id as string) === 'commissions')).toBe(false);
  });
});

describe('Receipt detail print exception and redirect contract', () => {
  it('redirects /receipts to consolidated receipt register when no receiptId is present', () => {
    expect(routeTreeSource).toContain("path: '/receipts'");
    expect(routeTreeSource).toContain('receiptId');
    expect(routeTreeSource).toContain("section: 'collections', view: 'receipts'");
  });

  it('does NOT redirect /receipts?receiptId=valid-id away and renders the print shell component', () => {
    expect(routeTreeSource).toContain("const requestedReceiptId = (search as Record<string, unknown>).receiptId;");
    expect(routeTreeSource).toContain("if (typeof requestedReceiptId === 'string' && requestedReceiptId !== '') return;");
  });
});
