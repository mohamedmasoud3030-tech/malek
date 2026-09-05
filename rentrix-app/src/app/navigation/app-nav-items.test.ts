import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAllNavItems, mobileNavItems, navGroups, quickCreateItems, workspaceChildNavItems, type NavItem } from './app-nav-items';
import { navigationLabels } from './terminology-registry';
import { findRouteBlock, registeredRoutePaths, topLevelRoutePaths } from './route-tree-paths';

const mobileNavigationSource = readFileSync(new URL('../layout/layout-navigation-view.tsx', import.meta.url), 'utf8');
const routePathList = registeredRoutePaths();
const topLevelPathList = topLevelRoutePaths();
const navItems: NavItem[] = Array.from(getAllNavItems());

const requiredOperationalRoutes = [
  '/login', '/', '/dashboard', '/properties', '/properties/new', '/properties/$propertyId', '/properties/$propertyId/edit',
  '/lands', '/lands/$landId', '/owners', '/owners/$ownerId', '/tenants', '/tenants/$tenantId',
  '/people', '/people/$personId', '/people/new', '/people/$personId/edit', '/leads', '/communication',
  '/contracts', '/contracts/new', '/contracts/$contractId', '/contracts/$contractId/edit', '/maintenance',
  '/service-providers', '/financials', '/receipts', '/commissions', '/reports', '/reports/$reportId',
  '/settings', '/help', '/admin-support', '/ai-assistant',
] as const;

const retiredOperationalRoutes = [
  '/units', '/utilities', '/documents-vault', '/automation', '/invoices', '/expenses',
  '/arrears', '/deposits', '/owner-settlements', '/bank-reconciliation', '/accounting',
  '/change-password', '/audit-log', '/data-integrity', '/system', '/landing',
  '/finance/collections', '/finance/expenses', '/finance/deposits', '/finance/banking',
] as const;

function getRouteDefinition(path: string) {
  return findRouteBlock(path);
}

describe('task-centric app navigation', () => {
  it('keeps the operational route matrix while exposing exactly seven global destinations', () => {
    expect(routePathList).toEqual(expect.arrayContaining([...requiredOperationalRoutes]));
    for (const retired of retiredOperationalRoutes) {
      expect(routePathList, `retired ${retired} must not be registered`).not.toContain(retired);
    }
    const primaryItems = navGroups.flatMap(([, items]) => items);
    expect(primaryItems.map(([to]) => to)).toEqual([
      '/dashboard', '/properties', '/contracts', '/financials', '/maintenance', '/reports', '/settings',
    ]);
    expect(primaryItems.map(([, labelKey]) => navigationLabels[labelKey])).toEqual([
      'اليوم', 'المحفظة', 'التأجير', 'المال', 'الخدمات', 'التقارير', 'الإعدادات',
    ]);
  });

  it('keeps Portfolio routine navigation to units and owners while Lands stays out of the drawer', () => {
    const portfolio = workspaceChildNavItems['/properties'];
    expect(portfolio.map(([, labelKey]) => labelKey)).toEqual(['units', 'owners']);
    expect(portfolio.map(([, labelKey, , , permission, search]) => ({ labelKey, permission, search }))).toEqual([
      { labelKey: 'units', permission: 'properties.view', search: { section: 'units' } },
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
    expect(children.map(([to]) => to)).toEqual(Array(3).fill('/financials'));
    expect(children.map(([, labelKey, , , permission, search]) => ({ labelKey, permission, search }))).toEqual([
      { labelKey: 'invoices', permission: 'financial.workspace.view', search: { section: 'collections', view: 'invoices' } },
      { labelKey: 'receipts', permission: 'financial.workspace.view', search: { section: 'collections', view: 'receipts' } },
      { labelKey: 'expenses', permission: 'expenses.view', search: { section: 'expenses', view: 'expenses' } },
    ]);
    for (const specialist of ['arrears', 'deposits', 'ownerSettlements', 'bankReconciliation', 'commissions']) {
      expect(children.some(([, labelKey]) => labelKey === specialist)).toBe(false);
    }
  });

  it('keeps Services routine navigation to maintenance and utilities only', () => {
    const services = workspaceChildNavItems['/maintenance'];
    expect(services.map(([, labelKey]) => labelKey)).toEqual(['maintenance', 'utilities']);
    expect(services.map(([, labelKey, , , permission, search]) => ({ labelKey, permission, search }))).toEqual([
      { labelKey: 'maintenance', permission: 'maintenance.view', search: { section: 'maintenance' } },
      { labelKey: 'utilities', permission: 'maintenance.view', search: { section: 'utilities' } },
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
    expect(getRouteDefinition('/receipts')).toContain("ReceiptsWorkspace");
  });

  it('keeps destination-style mobile nav empty, with two header actions and three lower utilities', () => {
    expect(mobileNavItems).toHaveLength(0);
    for (const hook of [
      'data-header-phone-search',
      'data-header-quick-add',
      'data-mobile-dock-menu',
    ]) {
      expect(mobileNavigationSource).toContain(hook);
    }
    expect(topLevelPathList).not.toContain('/units');
  });
});
