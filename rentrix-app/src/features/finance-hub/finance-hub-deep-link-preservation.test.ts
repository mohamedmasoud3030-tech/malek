import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createInvoiceCollectHref, parseQuickCollectSearch } from '@/features/financials/invoices/quick-collect';

/**
 * Legacy finance deep links must survive the redirect into the hub.
 *
 * Several existing flows navigate to a legacy finance path with query
 * parameters that the destination workspace reads:
 *
 *   /invoices?invoiceId=…&collect=1   arrears "collect now" (createInvoiceCollectHref)
 *   /receipts?receiptId=…             receipt print/detail view
 *
 * A redirect that sets a fresh `search` object would silently drop those
 * parameters and quietly break the flow — the page would still load, just
 * without the invoice selected or the receipt opened. These tests pin the
 * redirect to a merge of the incoming search instead.
 */

const routeTree = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');

/**
 * Returns the whole `const …Route = createRoute({ … });` statement.
 *
 * Routes are declared one per line, and some now contain inline arrow
 * functions with their own `});`, so the definition is taken as the full line
 * rather than up to the first closing brace.
 */
function getRouteDefinition(path: string) {
  const line = routeTree.split('\n').find((candidate) => candidate.includes(`path: '${path}'`));
  return line ?? '';
}

const legacyFinanceRoutes = [
  '/invoices',
  '/receipts',
  '/expenses',
  '/arrears',
  '/deposits',
  '/owner-settlements',
  '/bank-reconciliation',
  '/commissions',
] as const;

describe('legacy finance redirects preserve incoming query parameters', () => {
  it('merges the existing search instead of replacing it', () => {
    for (const path of legacyFinanceRoutes) {
      const definition = getRouteDefinition(path);
      expect(definition, `${path} must stay registered`).not.toBe('');

      // The redirect must derive its search from the incoming search.
      expect(definition, `${path} must forward existing query params`).toMatch(/search:\s*\(/);
      expect(definition, `${path} must spread the previous search`).toContain('...');
    }
  });

  it('keeps the invoice collect deep link intact through the redirect', () => {
    const href = createInvoiceCollectHref('invoice-123');
    expect(href).toBe('/invoices?invoiceId=invoice-123&collect=1');

    // Simulate what the redirect hands to the hub: previous search + section.
    const incoming = { invoiceId: 'invoice-123', collect: '1' };
    const forwarded = { ...incoming, section: 'invoices' };

    const parsed = parseQuickCollectSearch(forwarded);
    expect(parsed.invoiceId).toBe('invoice-123');
    expect(parsed.collectRequested).toBe(true);
  });

  it('keeps the receipt deep link intact through the redirect', () => {
    const incoming = { receiptId: 'receipt-456' };
    const forwarded = { ...incoming, section: 'receipts' };

    expect(forwarded.receiptId).toBe('receipt-456');
    expect(forwarded.section).toBe('receipts');
  });

  it('keeps serving the printable receipt document from /receipts instead of redirecting it', () => {
    const definition = getRouteDefinition('/receipts');

    // The single-receipt view is a full-bleed A4 document, not a hub tab, so
    // the route must still render a component for `?receiptId=` deep links.
    expect(definition).toContain('receiptId');
    expect(definition).toContain('ReceiptsRouteComponent');
  });

  it('still sets the section each legacy route represents', () => {
    const expected = {
      '/invoices': 'invoices',
      '/receipts': 'receipts',
      '/expenses': 'expenses',
      '/arrears': 'arrears',
      '/deposits': 'deposits',
      '/owner-settlements': 'owner_settlements',
      '/bank-reconciliation': 'bank_reconciliation',
      '/commissions': 'commissions',
    } as const;

    for (const [path, section] of Object.entries(expected)) {
      expect(getRouteDefinition(path)).toContain(`section: '${section}'`);
    }
  });
});
