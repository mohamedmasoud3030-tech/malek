import { describe, expect, it } from 'vitest';
import { navGroups, mobileNavItems, workspaceChildNavItems, getAllNavItems, quickCreateItems } from './app-nav-items';
import { getNavRoot, routeNavRoot } from './route-nav-map';

describe('navigation active-state — task-centric roots', () => {
  it('every routeNavRoot key resolves to its own declared value', () => {
    for (const [path, expectedRoot] of routeNavRoot.entries()) {
      expect(getNavRoot(path)).toBe(expectedRoot);
    }
  });

  it('every top-level sidebar item resolves to itself as root', () => {
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

  it('quick-create deep links keep the user inside their task context', () => {
    expect(getNavRoot('/contracts/new')).toBe('/contracts');
    expect(getNavRoot('/properties/new')).toBe('/properties');
    expect(getNavRoot('/people/new')).toBe('/contracts');
  });

  it('all operational secondary roots resolve away from dashboard fallback', () => {
    const protectedRoutes = [
      '/people', '/properties', '/lands', '/owners', '/tenants', '/contracts',
      '/maintenance', '/financials', '/commissions', '/reports', '/settings',
    ];
    for (const route of protectedRoutes) {
      expect(getNavRoot(route)).not.toBe('/dashboard');
    }
  });

  it('every visible nav item has a routeNavRoot entry', () => {
    for (const [to] of getAllNavItems()) {
      expect(routeNavRoot.has(to), `missing routeNavRoot for nav item ${to}`).toBe(true);
    }
  });

  it('every mobile nav item is also a primary sidebar item', () => {
    const primarySet = new Set(navGroups.flatMap(([, items]) => items.map(([to]) => to)));
    for (const [to] of mobileNavItems) {
      expect(primarySet.has(to), `mobile ${to} not in primary nav`).toBe(true);
    }
  });

  it('quick-create items have valid labelKeys', async () => {
    const { navigationLabels } = await import('./terminology-registry');
    for (const [, labelKey] of quickCreateItems) {
      expect(navigationLabels[labelKey]).toBeDefined();
    }
  });
});
