import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAllNavItems, mobileNavItems, navGroups, quickCreateItems, workspaceChildNavItems, type NavItem } from './app-nav-items';
import { navigationLabels } from './terminology-registry';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');
const routePaths = new Set(Array.from(routeTreeSource.matchAll(/path: '([^']+)'/g), (match) => match[1]));
const navItems: NavItem[] = Array.from(getAllNavItems());

function getRouteDefinition(path: string) {
  const pathToken = `path: '${path}'`;
  const pathIndex = routeTreeSource.indexOf(pathToken);
  if (pathIndex === -1) return '';
  const routeStart = routeTreeSource.lastIndexOf('createRoute({', pathIndex);
  const routeEnd = routeTreeSource.indexOf('});', pathIndex);
  if (routeStart === -1 || routeEnd === -1) return '';
  return routeTreeSource.slice(routeStart, routeEnd + 3);
}

describe('app route and navigation parity', () => {
  it('promotes the four core property-management entities to direct primary destinations', () => {
    const primaryPaths = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    expect(primaryPaths).toEqual(expect.arrayContaining(['/properties', '/owners', '/tenants', '/contracts']));

    expect(workspaceChildNavItems['/properties'].map(([to]) => to)).not.toContain('/owners');
    expect(workspaceChildNavItems['/contracts'].map(([to]) => to)).not.toContain('/tenants');
  });

  it('keeps finance and accounting to two primary entries', () => {
    const group = navGroups.find(([title]) => title === 'المالية والمحاسبة');
    expect(group?.[1].map(([to]) => to)).toEqual(['/financials', '/reports']);

    const allPrimary = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    expect(allPrimary).not.toEqual(expect.arrayContaining([
      '/finance/collections',
      '/finance/expenses',
      '/finance/deposits',
      '/finance/banking',
    ]));
  });

  it('keeps secondary tools inside their natural workspaces', () => {
    expect(workspaceChildNavItems['/properties'].map(([to]) => to)).toEqual(['/units', '/lands']);
    expect(workspaceChildNavItems['/contracts'].map(([to]) => to)).toEqual(['/people', '/leads', '/communication']);
    expect(workspaceChildNavItems['/maintenance'].map(([to]) => to)).toEqual(['/utilities', '/automation', '/documents-vault']);
    expect(workspaceChildNavItems['/settings'].map(([to]) => to)).toEqual(['/change-password', '/audit-log', '/data-integrity', '/system']);
  });

  it('maps every visible navigation and quick-create item to a registered route', () => {
    const navPaths = navItems.map(([to]) => to);
    const mobilePaths = mobileNavItems.map(([to]) => to);
    const quickCreatePaths = quickCreateItems.map(([to]) => to);
    expect([...routePaths]).toEqual(expect.arrayContaining([...navPaths, ...mobilePaths, ...quickCreatePaths]));
  });

  it('keeps permissioned navigation links aligned with route guards', () => {
    for (const [to, , , , permission] of [...navItems, ...quickCreateItems]) {
      if (!permission) continue;
      expect(getRouteDefinition(to)).toContain(`requirePermission('${permission}')`);
    }
  });

  it('keeps five daily mobile destinations without restoring horizontal clutter', () => {
    expect(mobileNavItems.map(([to]) => to)).toEqual([
      '/dashboard',
      '/properties',
      '/tenants',
      '/contracts',
      '/financials',
    ]);
  });

  it('has a pinned Arabic label for every visible primary and mobile item', () => {
    const labelKeys = [
      ...navGroups.flatMap(([, items]) => items.map(([, labelKey]) => labelKey)),
      ...mobileNavItems.map(([, labelKey]) => labelKey),
    ];
    for (const labelKey of labelKeys) {
      expect(navigationLabels[labelKey]).toMatch(/[\u0600-\u06FF]/);
    }
  });
});
