import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAllNavItems, mobileNavItems, navGroups, quickCreateItems, workspaceChildNavItems, type NavItem } from './app-nav-items';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');
const routePaths = new Set(Array.from(routeTreeSource.matchAll(/path: '([^']+)'/g), (match) => match[1]));

const requiredOperationalRoutes = [
  '/login',
  '/',
  '/properties',
  '/properties/new',
  '/properties/$propertyId',
  '/properties/$propertyId/edit',
  '/units',
  '/people',
  '/people/new',
  '/people/$personId/edit',
  '/tenants',
  '/owners',
  '/owners/$ownerId',
  '/lands',
  '/leads',
  '/contracts',
  '/contracts/new',
  '/contracts/$contractId',
  '/contracts/$contractId/edit',
  '/financials',
  '/deposits',
  '/owner-settlements',
  '/invoices',
  '/receipts',
  '/expenses',
  '/arrears',
  '/bank-reconciliation',
  '/reports',
  '/maintenance',
  '/commissions',
  '/communication',
  '/automation',
  '/system',
  '/audit-log',
  '/data-integrity',
  '/change-password',
  '/settings',
  '/accounting',
] as const;

const governanceRoutes = [
  '/maintenance',
  '/audit-log',
  '/data-integrity',
  '/system',
] as const;

const approvedExpansionRoutes = [
  '/lands',
  '/leads',
  '/commissions',
  '/communication',
  '/automation',
] as const;

const routePathList = Array.from(routePaths);
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
  it('keeps the operational route matrix registered in TanStack Router', () => {
    expect(routePathList).toEqual(expect.arrayContaining([...requiredOperationalRoutes]));
    expect(routeTreeSource).toContain('notFoundComponent: NotFoundPage');
  });

  it('maps every visible navigation and mobile navigation item to registered routes without duplicates', () => {
    const navPaths = navItems.map(([to]) => to);
    const navKeys = navItems.map(([to, labelKey]) => `${to}:${labelKey}`);
    const mobileNavPaths = mobileNavItems.map(([to]) => to);
    const quickCreatePaths = quickCreateItems.map(([to]) => to);

    expect(new Set(navKeys).size).toBe(navKeys.length);
    expect(new Set(mobileNavPaths).size).toBe(mobileNavPaths.length);
    expect(new Set(quickCreatePaths).size).toBe(quickCreatePaths.length);
    expect(routePathList).toEqual(expect.arrayContaining([...navPaths, ...mobileNavPaths, ...quickCreatePaths]));
  });

  it('keeps permissioned navigation links aligned with route guards', () => {
    for (const [to, , , , permission] of [...navItems, ...quickCreateItems]) {
      if (!permission) continue;

      expect(getRouteDefinition(to)).toContain(`requirePermission('${permission}')`);
    }
  });

  it('keeps governance routes available in the primary navigation rendered by the mobile drawer', () => {
    const navPaths = navItems.map(([to]) => to);

    expect(navPaths).toEqual(expect.arrayContaining([...governanceRoutes]));
  });

  it('exposes approved product-expansion modules through the primary navigation rendered by desktop and mobile drawer', () => {
    const navPaths = navItems.map(([to]) => to);

    expect(routePathList).toEqual(expect.arrayContaining([...approvedExpansionRoutes]));
    expect(navPaths).toEqual(expect.arrayContaining([...approvedExpansionRoutes]));
  });

  it('keeps mobile bottom navigation focused on five daily hubs while the drawer carries the full route inventory', () => {
    expect(mobileNavItems).toHaveLength(5);
    expect(mobileNavItems.map(([to]) => to)).toEqual([
      '/dashboard',
      '/properties',
      '/contracts',
      '/financials',
      '/reports',
    ]);
  });

  it('exposes every standalone financial workspace in the financial hub without duplicating children in mobile navigation', () => {
    const mobileNavPaths = mobileNavItems.map(([to]) => to);
    const financialsChildren = workspaceChildNavItems['/financials'].map(([to]) => to);

    expect(financialsChildren).toEqual(
      expect.arrayContaining(['/invoices', '/receipts', '/expenses', '/arrears', '/deposits', '/owner-settlements', '/bank-reconciliation', '/commissions']),
    );
    expect(mobileNavPaths).toContain('/financials');
    expect(mobileNavPaths).not.toContain('/invoices');
    expect(mobileNavPaths).not.toContain('/receipts');
    expect(mobileNavPaths).not.toContain('/arrears');
    expect(mobileNavPaths).not.toContain('/owner-settlements');
    expect(mobileNavPaths).not.toContain('/expenses');
    expect(mobileNavPaths).not.toContain('/bank-reconciliation');
  });

  it('groups every feature by the office workflow and keeps account security discoverable', () => {
    expect(navGroups.length).toBe(7);
    expect(navGroups.map(([title]) => title)).toEqual([
      'لوحة التحكم',
      'المحفظة العقارية',
      'العلاقات والعقود',
      'التشغيل والصيانة',
      'المالية',
      'التقارير',
      'الإدارة',
    ]);

    const getGroupChildPaths = (topTo: string) => [
      topTo,
      ...((workspaceChildNavItems[topTo] ?? []).map(([to]) => to)),
    ];

    expect(getGroupChildPaths('/properties')).toEqual(
      expect.arrayContaining(['/properties', '/owners', '/units', '/lands']),
    );
    expect(getGroupChildPaths('/contracts')).toEqual(
      expect.arrayContaining(['/contracts', '/people', '/tenants', '/leads', '/communication']),
    );
    expect(getGroupChildPaths('/maintenance')).toEqual(
      expect.arrayContaining(['/maintenance', '/utilities', '/automation', '/documents-vault']),
    );
    expect(getGroupChildPaths('/reports')).toEqual(
      expect.arrayContaining(['/reports', '/ai-assistant']),
    );
    expect(getGroupChildPaths('/settings')).toEqual(
      expect.arrayContaining(['/settings', '/change-password', '/audit-log', '/data-integrity', '/system']),
    );
  });

  it('keeps tenants and people visually distinct with different icons', () => {
    const tenantsItem = navItems.find(([, labelKey]) => labelKey === 'tenants');
    const peopleItem = navItems.find(([, labelKey]) => labelKey === 'peopleDirectory');

    expect(tenantsItem).toBeDefined();
    expect(peopleItem).toBeDefined();
    expect(tenantsItem?.[3]).not.toBe(peopleItem?.[3]);
  });
});
