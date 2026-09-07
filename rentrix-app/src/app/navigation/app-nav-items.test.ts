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
      'اليوم', 'العقارات', 'العقود', 'المال', 'الصيانة', 'التقارير', 'الإعدادات',
    ]);
  });

  it('reveals Portfolio registers: units, owners and the Lands specialist register', () => {
    const portfolio = workspaceChildNavItems['/properties'];
    expect(portfolio.map(([, labelKey]) => labelKey)).toEqual(['units', 'owners', 'lands']);
    expect(portfolio.map(([, labelKey, , , permission, search]) => ({ labelKey, permission, search }))).toEqual([
      { labelKey: 'units', permission: 'properties.view', search: { section: 'units' } },
      { labelKey: 'owners', permission: 'owners.hub.view', search: { section: 'owners' } },
      { labelKey: 'lands', permission: 'lands.view', search: undefined },
    ]);
  });

  it('reveals Leasing registers: tenants plus people, leads and communication', () => {
    const leasing = workspaceChildNavItems['/contracts'];
    expect(leasing.map(([, labelKey]) => labelKey)).toEqual(['tenants', 'peopleDirectory', 'leads', 'communication']);
    expect(leasing.map(([, , , , permission, search]) => ({ permission, search }))).toEqual([
      { permission: 'contracts.view', search: { workspace: 'tenants' } },
      { permission: 'contracts.view', search: undefined },
      { permission: 'leads.view', search: undefined },
      { permission: 'communication.view', search: undefined },
    ]);
  });

  it('shows only daily Money tasks in routine navigation', () => {
    const children = workspaceChildNavItems['/financials'];
    expect(children.map(([to]) => to)).toEqual([...Array(3).fill('/financials'), '/commissions']);
    expect(children.map(([, labelKey, , , permission, search]) => ({ labelKey, permission, search }))).toEqual([
      { labelKey: 'invoices', permission: 'financial.workspace.view', search: { section: 'collections', view: 'invoices' } },
      { labelKey: 'receipts', permission: 'financial.workspace.view', search: { section: 'collections', view: 'receipts' } },
      { labelKey: 'expenses', permission: 'expenses.view', search: { section: 'expenses', view: 'expenses' } },
      { labelKey: 'commissions', permission: 'commissions.view', search: undefined },
    ]);
    for (const specialist of ['arrears', 'deposits', 'ownerSettlements', 'bankReconciliation']) {
      expect(children.some(([, labelKey]) => labelKey === specialist)).toBe(false);
    }
  });

  it('reveals Services registers: maintenance, utilities, service providers and documents vault', () => {
    const services = workspaceChildNavItems['/maintenance'];
    // The maintenance self-child was removed: the parent link already lands on
    // the default maintenance section, so a duplicate row added nothing.
    expect(services.map(([, labelKey]) => labelKey)).toEqual(['utilities', 'serviceProviders', 'documentsVault']);
    expect(services.map(([, labelKey, , , permission, search]) => ({ labelKey, permission, search }))).toEqual([
      { labelKey: 'utilities', permission: 'maintenance.view', search: { section: 'utilities' } },
      { labelKey: 'serviceProviders', permission: 'service_providers.view', search: undefined },
      { labelKey: 'documentsVault', permission: undefined, search: { section: 'documents_vault' } },
    ]);
  });

  it('keeps Settings focused on routine administration and reveals support operations to permitted roles', () => {
    const settings = workspaceChildNavItems['/settings'];
    expect(settings.map(([, labelKey]) => labelKey)).toEqual([
      'companySettings', 'usersPermissions', 'adminSupport',
    ]);
    expect(settings.some(([, labelKey]) => labelKey === 'automation')).toBe(false);
    expect(settings.some(([, labelKey]) => labelKey === 'systemSettings')).toBe(false);
    expect(settings.some(([, labelKey]) => labelKey === 'costCenters')).toBe(false);
    const adminSupport = settings.find(([, labelKey]) => labelKey === 'adminSupport');
    expect(adminSupport?.[0]).toBe('/admin-support');
    expect(adminSupport?.[4]).toBe('support.operations.view');
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
