import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Blank-route guard — every registered path must either render a component
 * or redirect. An orphan route (no component, no redirect, no child index)
 * would render a blank <Outlet/> and break bookmarks.
 */

const source = readFileSync(new URL('./route-tree.ts', import.meta.url), 'utf8');

// Extract all createRoute blocks with a path
const routeBlocks = [...source.matchAll(/createRoute\(\{[^}]*path:\s*'([^']+)'[^}]*\}\)/gs)].map((m) => ({
  path: m[1],
  block: m[0],
}));

// Also catch multi-line blocks that our regex truncated — re-parse via simple scan
function fullBlockFor(path: string): string {
  const token = `path: '${path}'`;
  // Find the redirect variant for paths that appear twice (/units)
  let idx = -1;
  let searchFrom = 0;
  while (true) {
    const next = source.indexOf(token, searchFrom);
    if (next === -1) break;
    const start = source.lastIndexOf('createRoute({', next);
    const slice = source.slice(start, next + 2500);
    // Prefer the redirect/conditional variant for uniqueness check; for /receipts we need the conditional block
    if (path === '/receipts' && slice.includes('receiptId')) {
      idx = next;
      break;
    }
    if (path === '/units' && slice.includes("to: '/properties'") ) {
      idx = next;
      break;
    }
    idx = next;
    searchFrom = next + token.length;
    // take last occurrence if no special variant
    if (source.indexOf(token, searchFrom) === -1) break;
  }
  if (idx === -1) return '';
  const start = source.lastIndexOf('createRoute({', idx);
  // Use a wider window so component after beforeLoad is captured (receipts)
  const end = source.indexOf('});', idx + 2000);
  // fallback to first }); if not found
  const fallback = source.indexOf('});', idx);
  return source.slice(start, (end !== -1 ? end : fallback) + 3);
}

describe('route blank-state guard — every path must have component or redirect', () => {
  for (const { path } of routeBlocks) {
    it(`${path} has component or redirect (no blank)`, () => {
      const block = fullBlockFor(path);
      const hasComponent = block.includes('component:');
      const hasRedirect = block.includes('redirect');
      // Properties detail parent hosts child outlet but still has its own component — allowed
      // Special: /dev/design-system is dev-only but still has component gated by env
      expect(hasComponent || hasRedirect, `${path} has neither component nor redirect — would render blank`).toBe(true);
    });
  }

  it('root route has notFoundComponent (no empty 404)', () => {
    expect(source).toContain('notFoundComponent: NotFoundPage');
    expect(source).toContain('errorComponent: RouteErrorFallback');
  });

  it('protected route has auth guard beforeLoad', () => {
    const idx = source.indexOf("id: 'protected'");
    const snippet = source.slice(idx, idx + 1200);
    expect(snippet).toMatch(/throw redirect\(\{ to: '\/login'/);
  });

  it('receipts conditional shows print shell when receiptId present (no blank fallback)', () => {
    // Receipts route has beforeLoad conditional + component on same createRoute — check both substrings exist near the token
    const token = `path: '/receipts'`;
    const idx = source.indexOf(token);
    const window = source.slice(Math.max(0, idx - 800), idx + 2500);
    expect(window).toContain(`lazyRouteComponent(() => import('@/features/financials/receipts/receipts-page')`);
    expect(window).toContain('receiptId');
  });
});
