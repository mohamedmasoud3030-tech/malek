import { describe, expect, it } from 'vitest';
import { navGroups, mobileNavItems, workspaceChildNavItems, getAllNavItems, quickCreateItems } from './app-nav-items';
import { getNavRoot, routeNavRoot } from './route-nav-map';

describe('navigation active-state — no blank or unmapped routes', () => {
  it('every routeNavRoot key resolves to its own value via getNavRoot (no mismatch)', () => {
    for (const [path, expectedRoot] of routeNavRoot.entries()) {
      expect(getNavRoot(path)).toBe(expectedRoot);
    }
  });

  it('every top-level sidebar item resolves to itself as root (exact)', () => {
    const top = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    for (const to of top) {
      expect(getNavRoot(to)).toBe(to);
    }
  });

  it('every workspace child resolves to its parent root', () => {
    for (const [parent, children] of Object.entries(workspaceChildNavItems)) {
      for (const [to] of children) {
        expect(getNavRoot(to), `${to} should be under ${parent}`).toBe(parent);
      }
    }
  });

  it('quick-create deep links highlight their logical parent (not isolated)', () => {
    // Phase 2: people is now first-class at /people
    expect(getNavRoot('/contracts/new')).toBe('/contracts');
    expect(getNavRoot('/properties/new')).toBe('/properties');
    expect(getNavRoot('/people/new')).toBe('/people');
  });

  it('no protected route should resolve to /dashboard fallback unexpectedly', () => {
    // These would indicate a missing map entry and would blank the active state
    const protectedRoots = ['/people', '/properties', '/lands', '/owners', '/tenants', '/contracts', '/maintenance', '/financials', '/commissions', '/reports', '/settings'];
    for (const root of protectedRoots) {
      expect(getNavRoot(root)).not.toBe('/dashboard');
    }
  });

  it('every visible nav item has a routeNavRoot entry (no orphan highlight)', () => {
    for (const [to] of getAllNavItems()) {
      expect(routeNavRoot.has(to), `missing routeNavRoot for nav item ${to}`).toBe(true);
    }
  });

  it('every mobile nav item is also a primary sidebar item (consistency)', () => {
    const primarySet = new Set(navGroups.flatMap(([, items]) => items.map(([to]) => to)));
    for (const [to] of mobileNavItems) {
      expect(primarySet.has(to), `mobile ${to} not in primary nav`).toBe(true);
    }
  });

  it('quick-create items have valid labelKeys (no fallback to raw key)', async () => {
    const { navigationLabels } = await import('./terminology-registry');
    for (const [, labelKey] of quickCreateItems) {
      expect(navigationLabels[labelKey]).toBeDefined();
    }
  });
});
