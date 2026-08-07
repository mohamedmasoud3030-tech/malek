import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FinancialsPage } from './financials-page';
import { FinancialsRouteComponent } from '@/routes/_protected.financials';

const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');

describe('financials route wiring (IA 2026-08: hub-canonical, legacy redirects)', () => {
  it('FinancialsRouteComponent → FinancialsPage (overview summary remains canonical)', () => {
    expect(FinancialsRouteComponent).toBe(FinancialsPage);
  });

  it('legacy finance routes are REDIRECT-ONLY to canonical finance hubs (one implementation)', () => {
    // Invoices/receipts → collections hub (2 tabs), not standalone pages
    expect(routeTreeSource).toContain("path: '/invoices'");
    expect(routeTreeSource).toContain("throw redirect({ to: '/finance/collections'");
    expect(routeTreeSource).toContain("path: '/receipts'");
    expect(routeTreeSource).toContain("throw redirect({ to: '/finance/collections'");

    // Expenses/arrears → expenses hub
    expect(routeTreeSource).toContain("path: '/expenses'");
    expect(routeTreeSource).toContain("throw redirect({ to: '/finance/expenses'");
    expect(routeTreeSource).toContain("path: '/arrears'");
    expect(routeTreeSource).toContain("throw redirect({ to: '/finance/expenses'");

    // Deposits/owner-settlements → deposits hub
    expect(routeTreeSource).toContain("path: '/deposits'");
    expect(routeTreeSource).toContain("throw redirect({ to: '/finance/deposits'");
    expect(routeTreeSource).toContain("path: '/owner-settlements'");
    expect(routeTreeSource).toContain("throw redirect({ to: '/finance/deposits'");

    // Bank reconciliation/commissions → banking hub
    expect(routeTreeSource).toContain("path: '/bank-reconciliation'");
    expect(routeTreeSource).toContain("throw redirect({ to: '/finance/banking'");
    expect(routeTreeSource).toContain("path: '/commissions'");
    expect(routeTreeSource).toContain("throw redirect({ to: '/finance/banking'");
  });

  it('canonical finance implementations remain in features (one per hub tab), not duplicate route files', () => {
    // InvoicesPage, ExpensesPage etc. are still the canonical workspace bodies
    // used via FinanceHubWorkspace embedded (InvoicesWorkspace etc.), not via
    // deleted orphan route files. This ensures ONE implementation per feature.
    expect(routeTreeSource).toContain("path: '/finance/collections'");
    expect(routeTreeSource).toContain("path: '/finance/expenses'");
    expect(routeTreeSource).toContain("path: '/finance/deposits'");
    expect(routeTreeSource).toContain("path: '/finance/banking'");
  });

  it('receipts printable route keeps its own shell (receiptId), list redirects', () => {
    // /receipts?receiptId=… is printable A4, not hub tab — must not redirect
    expect(routeTreeSource).toContain("receiptId");
    expect(routeTreeSource).toContain("/finance/collections");
  });
});
