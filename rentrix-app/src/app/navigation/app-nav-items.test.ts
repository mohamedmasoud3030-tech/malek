import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAllNavItems, mobileNavItems, navGroups, quickCreateItems, workspaceChildNavItems, type NavItem } from './app-nav-items';
import { navigationLabels } from './terminology-registry';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');
const routePaths = new Set(Array.from(routeTreeSource.matchAll(/path: '([^']+)'/g), (match) => match[1]));
const routePathList = Array.from(routePaths);
const navItems: NavItem[] = Array.from(getAllNavItems());

const requiredOperationalRoutes = [
  '/login', '/', '/dashboard',
  '/properties', '/properties/new', '/properties/$propertyId', '/properties/$propertyId/edit', '/units', '/lands', '/lands/$landId',
  '/owners', '/owners/$ownerId', '/tenants', '/tenants/$tenantId',
  '/people', '/people/$personId', '/people/new', '/people/$personId/edit', '/leads', '/communication',
  '/contracts', '/contracts/new', '/contracts/$contractId', '/contracts/$contractId/edit',
  '/maintenance', '/service-providers', '/service-providers/new', '/service-providers/$providerId', '/service-providers/$providerId/edit', '/utilities', '/automation', '/documents-vault',
  '/financials', '/finance/collections', '/finance/expenses', '/finance/deposits', '/finance/banking',
  '/invoices', '/receipts', '/expenses', '/arrears', '/deposits', '/owner-settlements', '/bank-reconciliation', '/commissions',
  '/reports', '/accounting', '/ai-assistant',
  '/settings', '/change-password', '/audit-log', '/data-integrity', '/system',
] as const;

function getRouteDefinition(path: string) {
  const pathToken = `path: '${path}'`;
  const pathIndex = routeTreeSource.indexOf(pathToken);
  if (pathIndex === -1) return '';
  const routeStart = routeTreeSource.lastIndexOf('createRoute({', pathIndex);
  const routeEnd = routeTreeSource.indexOf('});', pathIndex);
  if (routeStart === -1 || routeEnd === -1) return '';
  return routeTreeSource.slice(routeStart, routeEnd + 3);
}

describe('app route and task-centric navigation parity', () => {
  it('keeps the full operational route matrix registered while simplifying visible navigation', () => {
    expect(routePathList).toEqual(expect.arrayContaining([...requiredOperationalRoutes]));
    expect(routeTreeSource).toContain('notFoundComponent: NotFoundPage');
  });

  it('exposes exactly seven global destinations', () => {
    const primaryPaths = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    expect(primaryPaths).toEqual([
      '/dashboard',
      '/properties',
      '/contracts',
      '/financials',
      '/maintenance',
      '/reports',
      '/settings',
    ]);
    expect(navGroups.map(([title]) => title)).toEqual([
      'اليوم',
      'المحفظة',
      'التأجير',
      'المال',
      'الخدمات',
      'التقارير',
      'الإعدادات',
    ]);
  });

  it('moves entity registers into the workspace that owns the user task', () => {
    expect(workspaceChildNavItems['/properties'].map(([to]) => to)).toEqual(['/units', '/lands', '/owners']);
    expect(workspaceChildNavItems['/contracts'].map(([to]) => to)).toEqual(['/tenants', '/people', '/leads', '/communication']);
    expect(workspaceChildNavItems['/financials'].map(([to]) => to)).toEqual([
      '/invoices',
      '/receipts',
      '/arrears',
      '/expenses',
      '/deposits',
      '/owner-settlements',
      '/bank-reconciliation',
      '/commissions',
    ]);
    expect(workspaceChildNavItems['/maintenance'].map(([to]) => to)).toEqual([
      '/maintenance',
      '/service-providers',
      '/utilities',
      '/documents-vault',
    ]);
  });

  it('does not let feature registers leak back into global navigation', () => {
    const primaryPaths = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    for (const secondary of [
      '/people', '/owners', '/tenants', '/lands', '/units', '/commissions', '/invoices', '/receipts',
      '/expenses', '/arrears', '/deposits', '/owner-settlements', '/bank-reconciliation', '/service-providers', '/utilities',
    ]) {
      expect(primaryPaths).not.toContain(secondary);
    }
  });

  it('maps every visible navigation, mobile and quick-create item to a registered route without duplicate keys', () => {
    const navPaths = navItems.map(([to]) => to);
    const navKeys = navItems.map(([to, labelKey]) => `${to}:${labelKey}`);
    const mobilePaths = mobileNavItems.map(([to]) => to);
    const quickCreatePaths = quickCreateItems.map(([to]) => to);

    expect(new Set(navKeys).size).toBe(navKeys.length);
    expect(new Set(mobilePaths).size).toBe(mobilePaths.length);
    expect(new Set(quickCreatePaths).size).toBe(quickCreatePaths.length);
    expect(routePathList).toEqual(expect.arrayContaining([...navPaths, ...mobilePaths, ...quickCreatePaths]));
  });

  it('keeps permissioned navigation links aligned with route guards', () => {
    for (const [to, , , , permission, search] of [...navItems, ...quickCreateItems]) {
      if (!permission || search) continue;
      expect(getRouteDefinition(to)).toContain(`requirePermission('${permission}')`);
    }
  });

  it('keeps owners permission-gated and tenants authenticated without widening roles', () => {
    expect(getRouteDefinition('/owners')).toContain("requirePermission('owners.hub.view')");
    expect(getRouteDefinition('/tenants')).not.toContain('requirePermission(');
  });

  it('keeps mobile global navigation to Menu + Search only', () => {
    expect(mobileNavItems).toHaveLength(0);
  });

  it('keeps administration as one primary destination while preserving governed subroutes', () => {
    const primaryPaths = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    expect(primaryPaths).toContain('/settings');
    expect(primaryPaths).not.toContain('/audit-log');
    expect(primaryPaths).not.toContain('/data-integrity');
    expect(primaryPaths).not.toContain('/system');
    expect(routePathList).toEqual(expect.arrayContaining(['/settings', '/audit-log', '/data-integrity', '/system', '/change-password']));
  });

  it('pins every global navigation label to Arabic terminology', () => {
    const labelKeys = [
      ...navGroups.flatMap(([, items]) => items.map(([, labelKey]) => labelKey)),
      ...mobileNavItems.map(([, labelKey]) => labelKey),
      ...quickCreateItems.map(([, labelKey]) => labelKey),
    ];
    for (const labelKey of labelKeys) {
      expect(navigationLabels[labelKey], `missing Arabic navigation label for ${labelKey}`).toMatch(/[\u0600-\u06FF]/);
    }
  });
});
