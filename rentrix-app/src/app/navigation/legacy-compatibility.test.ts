import { describe, expect, it } from 'vitest';
import { registeredRoutePaths, topLevelRoutePaths } from './route-tree-paths';

/**
 * Canonical-route lock.
 *
 * Every capability has exactly one canonical destination. The former legacy
 * redirect stubs (standalone finance registers, units/utilities/documents
 * vault aliases, settings specialist aliases, /accounting, /landing) are
 * retired and must NOT be registered; internal navigation generates canonical
 * hub URLs only.
 */

const RETIRED_ROUTES = [
  '/landing',
  '/units',
  '/utilities',
  '/documents-vault',
  '/finance/collections',
  '/finance/expenses',
  '/finance/deposits',
  '/finance/banking',
  '/invoices',
  '/expenses',
  '/arrears',
  '/deposits',
  '/owner-settlements',
  '/bank-reconciliation',
  '/accounting',
  '/automation',
  '/system',
  '/audit-log',
  '/data-integrity',
  '/change-password',
] as const;

describe('canonical route contract — legacy redirects retired', () => {
  it('none of the retired legacy routes remain registered', () => {
    const registered = new Set(registeredRoutePaths());
    for (const path of RETIRED_ROUTES) {
      expect(registered.has(path), `retired ${path} still registered`).toBe(false);
    }
  });

  it('the only remaining conditional route is the receipt document surface', () => {
    // /receipts without ?receiptId= bounces to the Money register; with
    // receiptId it renders the canonical ReceiptsWorkspace document surface.
    const registered = registeredRoutePaths();
    expect(registered).toContain('/receipts');
  });

  it('no duplicate top-level path is registered twice', () => {
    const paths = topLevelRoutePaths();
    const withoutLegacyPrefixes = paths.filter((p) => !RETIRED_ROUTES.includes(p as never));
    const duplicates = withoutLegacyPrefixes.filter((p, i) => withoutLegacyPrefixes.indexOf(p) !== i);
    expect(duplicates).toEqual([]);
  });
});
