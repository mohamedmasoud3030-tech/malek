import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MoneyPage } from '@/features/finance-hub/money-page';
import { FinancialsRouteComponent } from '@/routes/_protected.financials';

const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');

describe('financials route wiring (IA 2026-08: hub-canonical, legacy redirects)', () => {
  it('FinancialsRouteComponent → MoneyPage while the existing FinancialsPage remains the overview renderer', () => {
    expect(FinancialsRouteComponent).toBe(MoneyPage);
  });

  it('legacy finance routes are REDIRECT-ONLY to canonical finance hubs (one implementation)', () => {
    expect(routeTreeSource).toContain("path: '/invoices'");
    expect(routeTreeSource).toContain("to: '/financials'");
    expect(routeTreeSource).toContain("section: 'collections'");
    expect(routeTreeSource).toContain("view: 'invoices'");
    expect(routeTreeSource).toContain("path: '/receipts'");
    expect(routeTreeSource).toContain("view: 'receipts'");
    expect(routeTreeSource).toContain("path: '/expenses'");
    expect(routeTreeSource).toContain("view: 'expenses'");
    expect(routeTreeSource).toContain("path: '/arrears'");
    expect(routeTreeSource).toContain("view: 'arrears'");
    expect(routeTreeSource).toContain("path: '/deposits'");
    expect(routeTreeSource).toContain("view: 'deposits'");
    expect(routeTreeSource).toContain("path: '/owner-settlements'");
    expect(routeTreeSource).toContain("view: 'owner_settlements'");
    expect(routeTreeSource).toContain("path: '/bank-reconciliation'");
    expect(routeTreeSource).toContain("section: 'banking'");
    expect(routeTreeSource).toContain("path: '/commissions'");
  });

  it('canonical finance implementations remain in features (one per hub tab), not duplicate route files', () => {
    expect(routeTreeSource).toContain("path: '/finance/collections'");
    expect(routeTreeSource).toContain("path: '/finance/expenses'");
    expect(routeTreeSource).toContain("path: '/finance/deposits'");
    expect(routeTreeSource).toContain("path: '/finance/banking'");
  });

  it('receipts printable route keeps its own shell (receiptId), list redirects', () => {
    expect(routeTreeSource).toContain("receiptId");
    expect(routeTreeSource).toContain("/financials");
  });

  it('preserves the meaningful old hub section parameter deep links based on the preservation contract (Point 7)', () => {
    expect(routeTreeSource).toContain("const view = section === 'receipts' ? 'receipts' : 'invoices';");
    expect(routeTreeSource).toContain("if (section === 'arrears') {");
    expect(routeTreeSource).toContain("section: 'collections', view: 'arrears'");
    expect(routeTreeSource).toContain("const view = section === 'owner_settlements' ? 'owner_settlements' : 'deposits';");
    expect(routeTreeSource).toContain("if (section === 'commissions') {");
    expect(routeTreeSource).toContain("throw redirect({ to: '/commissions' })");
  });
});
