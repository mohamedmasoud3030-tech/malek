import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { AuthorizationContext } from '@/features/auth/permissions';
import { FINANCE_VIEWS, isViewPermitted } from './financials-page';
import { resolveFinanceLocation } from './finance-shell-model';

const readFinancialsPage = () => readFileSync(new URL('./financials-page.tsx', import.meta.url), 'utf8');
const readMoneyPage = () => readFileSync(new URL('../finance-hub/money-page.tsx', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../../routes/_protected.financials.tsx', import.meta.url), 'utf8');
const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');
const invoiceControllerSource = readFileSync(new URL('./invoices/useInvoiceWorkspaceController.ts', import.meta.url), 'utf8');
const invoiceWorkspaceSource = readFileSync(new URL('./components/invoice-workspace-section.tsx', import.meta.url), 'utf8');
const invoiceDetailSource = readFileSync(new URL('./components/invoice-detail-section.tsx', import.meta.url), 'utf8');

vi.mock('@/features/auth/permissions', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    canAccess: (context: AuthorizationContext & { permissions?: ReadonlySet<string> } | null | undefined, permission: string) => Boolean(context?.permissions?.has(permission)),
  };
});

type TestAuthorizationContext = AuthorizationContext & Readonly<{ permissions: ReadonlySet<string> }>;
const mockAuth = (permissions: string[]): TestAuthorizationContext => ({
  userId: 'test', email: 'test@example.com', role: 'USER', permissions: new Set(permissions),
});

describe('/financials Money workspace IA', () => {
  it('routes the primary financial entry through the unified FinancePage', () => {
    // WP-B finance hub unification: /financials serves FinancePage from the
    // unified finance feature (was the finance-hub MoneyPage wrapper).
    expect(routeSource).toContain('FinancePage as FinancialsRouteComponent');
    expect(routeSource).toContain('@/features/finance/FinancePage');
  });

  it('keeps commissions in the same Money route without duplicating its business logic', () => {
    const source = readMoneyPage();
    expect(source).toContain('<CommissionsWorkspace embedded />');
    expect(source).toContain("to: '/financials'");
    expect(source).toContain('data-money-view="commissions"');
    expect(source).not.toContain("to: '/commissions'");
  });

  it('keeps the existing operational Finance renderer and its lazy workspaces intact', () => {
    const source = readFinancialsPage();
    expect(source).toContain('InvoicesWorkspace = lazy(');
    expect(source).toContain('ReceiptsWorkspace = lazy(');
    expect(source).toContain('ExpensesWorkspace = lazy(');
    expect(source).toContain('SectionTabs');
  });

  it('contains six Money sections and separates management-fee accrual from custody funds', () => {
    const model = readFileSync(new URL('./finance-shell-model.ts', import.meta.url), 'utf8');
    for (const id of ['overview', 'collections', 'expenses', 'fees', 'funds', 'banking']) expect(model).toContain(`id: '${id}'`);
    expect(model).toContain("id: 'commissions'");
    expect(FINANCE_VIEWS.find((view) => view.id === 'fixed_monthly_accruals')?.sectionId).toBe('fees');
  });

  it('preserves legacy funds deep-links for fixed monthly accruals while resolving to the truthful fees section', () => {
    const auth = mockAuth(['financial.fixed_monthly_accruals.view']);
    expect(resolveFinanceLocation('funds', 'fixed_monthly_accruals', auth)).toMatchObject({
      resolvedSectionId: 'fees',
      resolvedViewId: 'fixed_monthly_accruals',
    });
  });

  it('keeps a posted receipt confirmation inside the invoice collection journey without opening the receipt-register dialog', () => {
    expect(invoiceControllerSource).toContain("const collectionReceiptQuery = useReceipt(collectionSuccess?.receiptId ?? '')");
    expect(invoiceControllerSource).toContain('receiptNumber: result.receipt_no ?? null');
    expect(invoiceControllerSource).not.toContain('setSelectedReceiptId(result.receipt_id)');
    expect(invoiceWorkspaceSource).toContain('collectionReceiptDetail={ctrl.collectionReceiptQuery.data}');
    expect(invoiceDetailSource).toContain('data-collection-receipt-confirmation');
    expect(invoiceDetailSource).toContain('collectionReceiptDetail?.receipt_number ?? collectionSuccess?.receiptNumber ?? null');
    expect(invoiceDetailSource).toContain('رقم الإيصال المعتمد');
    expect(invoiceDetailSource).toContain('تحصيل الفاتورة التالية');
  });
});

describe('Money view-level permissions', () => {
  it('enforces independent expenses and commissions permissions', () => {
    const expenses = FINANCE_VIEWS.find((view) => view.id === 'expenses')!;
    const commissions = FINANCE_VIEWS.find((view) => view.id === 'commissions')!;
    expect(isViewPermitted(mockAuth(['expenses.view']), expenses)).toBe(true);
    expect(isViewPermitted(mockAuth(['expenses.view']), commissions)).toBe(false);
    expect(isViewPermitted(mockAuth(['commissions.view']), expenses)).toBe(false);
    expect(isViewPermitted(mockAuth(['commissions.view']), commissions)).toBe(true);
  });

  it('enforces exact deposits versus settlements boundaries', () => {
    const deposits = FINANCE_VIEWS.find((view) => view.id === 'deposits')!;
    const settlements = FINANCE_VIEWS.find((view) => view.id === 'owner_settlements')!;
    expect(isViewPermitted(mockAuth(['financial.deposits.view']), deposits)).toBe(true);
    expect(isViewPermitted(mockAuth(['financial.deposits.view']), settlements)).toBe(false);
    expect(isViewPermitted(mockAuth(['financial.owner_settlements.view']), deposits)).toBe(false);
    expect(isViewPermitted(mockAuth(['financial.owner_settlements.view']), settlements)).toBe(true);
  });

  it('keeps invoices/receipts authenticated-only and arrears permissioned', () => {
    const invoices = FINANCE_VIEWS.find((view) => view.id === 'invoices')!;
    const receipts = FINANCE_VIEWS.find((view) => view.id === 'receipts')!;
    const arrears = FINANCE_VIEWS.find((view) => view.id === 'arrears')!;
    expect(isViewPermitted(mockAuth([]), invoices)).toBe(true);
    expect(isViewPermitted(mockAuth([]), receipts)).toBe(true);
    expect(isViewPermitted(mockAuth([]), arrears)).toBe(false);
    expect(isViewPermitted(mockAuth(['arrears.view']), arrears)).toBe(true);
  });

  it('keeps standalone /commissions as a permissioned compatibility deep link', () => {
    expect(routeTreeSource).toContain("path: '/commissions'");
    expect(routeTreeSource).toContain("requirePermission('commissions.view')");
  });
});
