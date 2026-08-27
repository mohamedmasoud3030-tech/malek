import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAllNavItems, mobileNavItems, navGroups, quickCreateItems, workspaceChildNavItems, type NavItem } from './app-nav-items';
import { navigationLabels } from './terminology-registry';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');
const mobileNavigationSource = readFileSync(new URL('../layout/layout-navigation-view.tsx', import.meta.url), 'utf8');
const routePaths = new Set(Array.from(routeTreeSource.matchAll(/path: '([^']+)'/g), (match) => match[1]));
const routePathList = Array.from(routePaths);
const navItems: NavItem[] = Array.from(getAllNavItems());

const requiredOperationalRoutes = [
  '/login', '/', '/dashboard', '/properties', '/properties/new', '/properties/$propertyId', '/properties/$propertyId/edit',
  '/units', '/lands', '/lands/$landId', '/owners', '/owners/$ownerId', '/tenants', '/tenants/$tenantId',
  '/people', '/people/$personId', '/people/new', '/people/$personId/edit', '/leads', '/communication',
  '/contracts', '/contracts/new', '/contracts/$contractId', '/contracts/$contractId/edit', '/maintenance',
  '/service-providers', '/utilities', '/documents-vault', '/automation', '/financials', '/invoices', '/receipts', '/expenses',
  '/arrears', '/deposits', '/owner-settlements', '/bank-reconciliation', '/commissions', '/reports', '/accounting',
  '/settings', '/change-password', '/audit-log', '/data-integrity', '/system',
] as const;

function getRouteDefinition(path: string) {
  const pathIndex = routeTreeSource.indexOf(`path: '${path}'`);
  if (pathIndex === -1) return '';
  const routeStart = routeTreeSource.lastIndexOf('createRoute({', pathIndex);
  const routeEnd = routeTreeSource.indexOf('});', pathIndex);
  return routeStart === -1 || routeEnd === -1 ? '' : routeTreeSource.slice(routeStart, routeEnd + 3);
}

describe('task-centric app navigation', () => {
  it('keeps the operational route matrix while exposing exactly seven global destinations', () => {
    expect(routePathList).toEqual(expect.arrayContaining([...requiredOperationalRoutes]));
    const primaryItems = navGroups.flatMap(([, items]) => items);
    expect(primaryItems.map(([to]) => to)).toEqual([
      '/dashboard', '/properties', '/contracts', '/financials', '/maintenance', '/reports', '/settings',
    ]);
    expect(primaryItems.map(([, labelKey]) => navigationLabels[labelKey])).toEqual([
      'اليوم', 'المحفظة', 'التأجير', 'المال', 'الخدمات', 'التقارير والكشوف', 'الإعدادات',
    ]);
  });

  it('keeps Portfolio routine navigation to units and owners while Lands stays out of the drawer', () => {
    const portfolio = workspaceChildNavItems['/properties'];
    expect(portfolio.map(([, labelKey]) => labelKey)).toEqual(['units', 'owners']);
    expect(portfolio.map(([, labelKey, , , permission, search]) => ({ labelKey, permission, search }))).toEqual([
      { labelKey: 'units', permission: undefined, search: { section: 'units' } },
      { labelKey: 'owners', permission: 'owners.hub.view', search: { section: 'owners' } },
    ]);
    expect(portfolio.some(([, labelKey]) => labelKey === 'lands')).toBe(false);
  });

  it('keeps Leasing routine navigation focused on tenants', () => {
    const leasing = workspaceChildNavItems['/contracts'];
    expect(leasing.map(([, labelKey]) => labelKey)).toEqual(['tenants']);
    expect(leasing[0]?.[5]).toEqual({ workspace: 'tenants' });
  });

  it('shows only daily Money tasks in routine navigation', () => {
    const children = workspaceChildNavItems['/financials'];
    expect(children.map(([to]) => to)).toEqual(Array(4).fill('/financials'));
    expect(children.map(([, labelKey, , , permission, search]) => ({ labelKey, permission, search }))).toEqual([
      { labelKey: 'invoices', permission: undefined, search: { section: 'collections', view: 'invoices' } },
      { labelKey: 'receipts', permission: undefined, search: { section: 'collections', view: 'receipts' } },
      { labelKey: 'arrears', permission: 'arrears.view', search: { section: 'collections', view: 'arrears' } },
      { labelKey: 'expenses', permission: 'expenses.view', search: { section: 'expenses', view: 'expenses' } },
    ]);
    for (const specialist of ['deposits', 'ownerSettlements', 'bankReconciliation', 'commissions']) {
      expect(children.some(([, labelKey]) => labelKey === specialist)).toBe(false);
    }
  });

  it('keeps Services routine navigation to maintenance and utilities only', () => {
    const services = workspaceChildNavItems['/maintenance'];
    expect(services.map(([, labelKey]) => labelKey)).toEqual(['maintenance', 'utilities']);
    expect(services.map(([, labelKey, , , permission, search]) => ({ labelKey, permission, search }))).toEqual([
      { labelKey: 'maintenance', permission: undefined, search: { section: 'maintenance' } },
      { labelKey: 'utilities', permission: undefined, search: { section: 'utilities' } },
    ]);
    expect(services.some(([, labelKey]) => labelKey === 'serviceProviders')).toBe(false);
    expect(services.some(([, labelKey]) => labelKey === 'documentsVault')).toBe(false);
  });

  it('keeps Settings limited to routine company and permission administration', () => {
    const settings = workspaceChildNavItems['/settings'];
    expect(settings.map(([, labelKey]) => labelKey)).toEqual([
      'companySettings', 'usersPermissions',
    ]);
    expect(settings.some(([, labelKey]) => labelKey === 'automation')).toBe(false);
    expect(settings.some(([to]) => to === '/admin-support')).toBe(false);
    expect(settings.some(([, labelKey]) => labelKey === 'systemSettings')).toBe(false);
    expect(settings.some(([, labelKey]) => labelKey === 'costCenters')).toBe(false);
  });

  it('does not leak feature registers or support/diagnostic tools back into global navigation', () => {
    const primaryPaths = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    for (const secondary of ['/people', '/owners', '/tenants', '/lands', '/units', '/commissions', '/invoices', '/receipts', '/expenses', '/arrears', '/utilities', '/service-providers', '/automation', '/admin-support', '/audit-log', '/data-integrity', '/system']) {
      expect(primaryPaths).not.toContain(secondary);
    }
  });

  it('maps every visible navigation and quick-create item to a registered route without duplicate semantic keys', () => {
    const navPaths = navItems.map(([to]) => to);
    const navKeys = navItems.map(([to, labelKey, , , , search]) => `${to}:${labelKey}:${JSON.stringify(search ?? {})}`);
    expect(new Set(navKeys).size).toBe(navKeys.length);
    expect(routePathList).toEqual(expect.arrayContaining([...navPaths, ...quickCreateItems.map(([to]) => to)]));
  });

  it('keeps standalone compatibility routes guarded or redirected to their owner', () => {
    expect(getRouteDefinition('/owners')).toContain("requirePermission('owners.hub.view')");
    expect(getRouteDefinition('/leads')).toContain("requirePermission('leads.view')");
    expect(getRouteDefinition('/communication')).toContain("requirePermission('communication.view')");
    expect(getRouteDefinition('/commissions')).toContain("requirePermission('commissions.view')");
    expect(getRouteDefinition('/automation')).toContain("to: '/settings'");
  });

  it('keeps destination-style mobile nav empty and exposes one five-tool utility dock', () => {
    expect(mobileNavItems).toHaveLength(0);
    for (const hook of [
      'data-mobile-dock-menu',
      'data-mobile-dock-search',
      'data-mobile-dock-quick-add',
      'data-mobile-dock-notifications',
      'data-mobile-dock-ai',
    ]) expect(mobileNavigationSource).toContain(hook);
  });
});