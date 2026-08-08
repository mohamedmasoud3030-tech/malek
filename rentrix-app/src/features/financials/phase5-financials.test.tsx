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
    expect(routeTreeSource).toContain("to: '/financials'");
    expect(routeTreeSource).toContain("section: 'collections'");
    expect(routeTreeSource).toContain("view: 'invoices'");
    expect(routeTreeSource).toContain("path: '/receipts'");
    expect(routeTreeSource).toContain("view: 'receipts'");

    // Expenses/arrears → expenses hub
    expect(routeTreeSource).toContain("path: '/expenses'");
    expect(routeTreeSource).toContain("view: 'expenses'");
    expect(routeTreeSource).toContain("path: '/arrears'");
    expect(routeTreeSource).toContain("view: 'arrears'");

    // Deposits/owner-settlements → deposits hub
    expect(routeTreeSource).toContain("path: '/deposits'");
    expect(routeTreeSource).toContain("view: 'deposits'");
    expect(routeTreeSource).toContain("path: '/owner-settlements'");
    expect(routeTreeSource).toContain("view: 'owner_settlements'");

    // Bank reconciliation/commissions → banking hub
    expect(routeTreeSource).toContain("path: '/bank-reconciliation'");
    expect(routeTreeSource).toContain("section: 'banking'");
    expect(routeTreeSource).toContain("path: '/commissions'");
    expect(routeTreeSource).toContain("view: 'commissions'");
  });

  it('canonical finance implementations remain in features (one per hub tab), not duplicate route files', () => {
    expect(routeTreeSource).toContain("path: '/finance/collections'");
    expect(routeTreeSource).toContain("path: '/finance/expenses'");
    expect(routeTreeSource).toContain("path: '/finance/deposits'");
    expect(routeTreeSource).toContain("path: '/finance/banking'");
  });

  it('receipts printable route keeps its own shell (receiptId), list redirects', () => {
    // /receipts?receiptId=… is printable A4, not hub tab — must not redirect
    expect(routeTreeSource).toContain("receiptId");
    expect(routeTreeSource).toContain("/financials");
  });

  it('preserves the meaningful old hub section parameter deep links based on the preservation contract (Point 7)', () => {
    // /finance/collections?section=receipts
    expect(routeTreeSource).toContain("const view = section === 'receipts' ? 'receipts' : 'invoices';");

    // /finance/expenses?section=arrears
    expect(routeTreeSource).toContain("if (section === 'arrears') {");
    expect(routeTreeSource).toContain("section: 'collections', view: 'arrears'");

    // /finance/deposits?section=owner_settlements
    expect(routeTreeSource).toContain("const view = section === 'owner_settlements' ? 'owner_settlements' : 'deposits';");

    // /finance/banking?section=commissions
    expect(routeTreeSource).toContain("if (section === 'commissions') {");
    expect(routeTreeSource).toContain("section: 'expenses', view: 'commissions'");
  });
});
