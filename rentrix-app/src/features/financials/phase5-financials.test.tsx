import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeTreeSource = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');

describe('financials route wiring (IA 2026-08: hub-canonical, legacy redirects)', () => {
  it('binds /financials directly to the unified FinancePage (WP-B finance hub unification)', () => {
    expect(routeTreeSource).toContain("import('@/features/finance/FinancePage')");
    expect(routeTreeSource).toContain("'FinancePage'");
  });

  it('legacy finance routes are retired; the Money hub is the single canonical route', () => {
    for (const retired of ['/invoices', '/expenses', '/arrears', '/deposits', '/owner-settlements', '/bank-reconciliation', '/finance/collections', '/finance/expenses', '/finance/deposits', '/finance/banking']) {
      expect(routeTreeSource, `retired ${retired} must not be registered`).not.toContain(`path: '${retired}'`);
    }
  });

  it('canonical finance implementations remain in features (one per hub tab), not duplicate route files', () => {
    expect(routeTreeSource).toContain("import('@/features/finance/FinancePage')");
    expect(routeTreeSource).toContain("import('@/features/financials/receipts/receipts-page')");
  });

  it('receipts printable route keeps its own shell (receiptId), register routes via the hub', () => {
    expect(routeTreeSource).toContain("receiptId");
    expect(routeTreeSource).toContain("ReceiptsWorkspace");
    expect(routeTreeSource).toContain("path: '/receipts'");
  });
});
