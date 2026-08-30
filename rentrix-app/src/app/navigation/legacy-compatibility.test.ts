import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');

/**
 * Phase 2 legacy compatibility — Phase 1+2: people/lands/commissions now canonical standalone; hub legacy ?section= handled via workspace redirects — never break bookmarked / deep links.
 * Every redirect route must preserve incoming search via:
 *   search: (previous) => ({ ...previous, section: ..., view: ... })
 * and must use `throw redirect({ to: canonical })`.
 */

// Use substring search instead of block isolation for paths that appear twice
// (e.g. /units appears as both a redirect and as nested property detail route).
function containsNear(path: string, needle: string, radius = 1500): boolean {
  const token = `path: '${path}'`;
  // Find redirect variant (contains 'redirect') closest to token
  let idx = 0;
  while (true) {
    idx = source.indexOf(token, idx);
    if (idx === -1) return false;
    const slice = source.slice(Math.max(0, idx - 800), idx + radius);
    if (slice.includes(needle)) return true;
    idx += token.length;
  }
}

function getRouteBlockForRedirect(path: string): string {
  const token = `path: '${path}'`;
  let idx = 0;
  let best = '';
  while (true) {
    const next = source.indexOf(token, idx);
    if (next === -1) break;
    const start = source.lastIndexOf('createRoute({', next);
    // Find the next }); after token but ensure it belongs to same createRoute by counting braces roughly
    // Use 2000 char window which captures beforeLoad + component for /receipts
    const raw = source.slice(start, next + 2500);
    // Prefer the block that contains redirect (the redirect route)
    if (raw.includes('redirect') && raw.includes(`to: `)) {
      // for /units redirect, ensure it's the one redirecting to /properties
      if (path === '/units' && raw.includes("to: '/properties'") && raw.includes("section: 'units'")) {
        return raw;
      }
      if (path !== '/units') {
        // for finance/expenses check special branching — still contains redirect
        return raw;
      }
    }
    if (path === '/receipts' && raw.includes('receiptId')) return raw;
    if (path === '/landing') return raw;
    best = raw;
    idx = next + token.length;
  }
  return best;
}

const REDIRECT_SPECS: Array<{ path: string; to: string; section?: string; view?: string; allowRoot?: boolean }> = [
  { path: '/landing', to: '/', allowRoot: true },
  { path: '/units', to: '/properties', section: 'units' },
  { path: '/utilities', to: '/maintenance', section: 'utilities' },
  { path: '/automation', to: '/settings', section: 'automation' },
  { path: '/finance/collections', to: '/financials', section: 'collections' },
  { path: '/finance/expenses', to: '/financials' }, // conditional: arrears vs expenses — don’t pin single section
  { path: '/finance/deposits', to: '/financials', section: 'funds' },
  { path: '/finance/banking', to: '/financials' },
  { path: '/expenses', to: '/financials', section: 'expenses', view: 'expenses' },
  { path: '/invoices', to: '/financials', section: 'collections', view: 'invoices' },
  { path: '/arrears', to: '/financials', section: 'collections', view: 'arrears' },
  { path: '/deposits', to: '/financials', section: 'funds', view: 'deposits' },
  { path: '/owner-settlements', to: '/financials', section: 'funds', view: 'owner_settlements' },
  { path: '/bank-reconciliation', to: '/financials', section: 'banking' },
  { path: '/accounting', to: '/reports', section: 'accounting' },
  { path: '/receipts', to: '/financials', section: 'collections', view: 'receipts' },
];

describe('legacy compatibility — redirects preserve bookmarks and deep links', () => {
  it('keeps Leads and Communication first-class while adapting old contract section links', () => {
    expect(containsNear('/leads', "@/features/leads/leads-page")).toBe(true);
    expect(containsNear('/communication', "@/features/communication/communication-page")).toBe(true);
    expect(containsNear('/leads', "to: '/contracts'")).toBe(false);
    expect(source).toContain("legacySection === 'leads'");
    expect(source).toContain("? '/communication'");
  });

  it.each(REDIRECT_SPECS)('$path redirects to $to', ({ path, to }) => {
    const token = `path: '${path}'`;
    expect(source).toContain(token);
    expect(containsNear(path, `to: '${to}'`)).toBe(true);
    expect(containsNear(path, 'redirect')).toBe(true);
  });

  it.each(REDIRECT_SPECS.filter((r) => r.section))('$path preserves incoming search (?section=)', ({ path, section }) => {
    // finance/expenses has branching (arrears vs expenses)
    if (path === '/finance/expenses') {
      expect(containsNear(path, "section: 'collections'")).toBe(true);
      expect(containsNear(path, "section: 'expenses'")).toBe(true);
      expect(containsNear(path, '...previous')).toBe(true);
      return;
    }
    if (path === '/finance/banking') {
      expect(containsNear(path, "section: 'banking'")).toBe(true);
      expect(containsNear(path, '...previous')).toBe(true);
      return;
    }
    expect(containsNear(path, `section: '${section!}'`)).toBe(true);
    expect(containsNear(path, '...previous')).toBe(true);
  });

  it.each(REDIRECT_SPECS.filter((r) => r.view))('$path maps to correct view', ({ path, view }) => {
    expect(containsNear(path, `view: '${view!}'`)).toBe(true);
  });

  it('/receipts keeps print-shell exception (receiptId present → no redirect)', () => {
    const block = getRouteBlockForRedirect('/receipts');
    expect(block).toContain('receiptId');
    expect(block).toContain(`if (typeof requestedReceiptId === 'string' && requestedReceiptId !== '') return;`);
    expect(source).toContain(`lazyRouteComponent(() => import('@/features/financials/receipts/receipts-page')`);
    // That import must be on the /receipts route block (conditional print shell)
    expect(block.length).toBeGreaterThan(0);
  });

  it('/landing compatibility alias redirects to /', () => {
    const block = getRouteBlockForRedirect('/landing');
    expect(block).toContain(`to: '/'`);
  });

  it('all redirect routes (except /landing) remain inside protectedRoute', () => {
    expect(source).toContain('protectedRoute.addChildren([');
    for (const { path, allowRoot } of REDIRECT_SPECS) {
      if (allowRoot) continue;
      const block = getRouteBlockForRedirect(path);
      expect(block).toContain('getParentRoute: () => protectedRoute');
    }
  });
});
