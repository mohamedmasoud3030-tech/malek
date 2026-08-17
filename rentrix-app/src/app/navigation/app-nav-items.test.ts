import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAllNavItems, mobileNavItems, navGroups, quickCreateItems, workspaceChildNavItems, type NavItem } from './app-nav-items';
import { navigationLabels } from './terminology-registry';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');
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

  it('keeps Portfolio and Leasing child navigation inside their owning workspace', () => {
    expect(workspaceChildNavItems['/properties'].map(([to]) => to)).toEqual(['/properties', '/properties', '/properties']);
    expect(workspaceChildNavItems['/contracts'].map(([to]) => to)).toEqual(['/contracts', '/contracts', '/contracts', '/contracts']);
  });

  it('keeps every Money child inside /financials with explicit section/view state', () => {
    const children = workspaceChildNavItems['/financials'];
    expect(children.map(([to]) => to)).toEqual(Array(8).fill('/financials'));
    expect(children.map(([, labelKey, , , permission, search]) => ({ labelKey, permission, search }))).toEqual([
      { labelKey: 'invoices', permission: undefined, search: { section: 'collections', view: 'invoices' } },
      { labelKey: 'receipts', permission: undefined, search: { section: 'collections', view: 'receipts' } },
      { labelKey: 'arrears', permission: 'arrears.view', search: { section: 'collections', view: 'arrears' } },
      { labelKey: 'expenses', permission: 'expenses.view', search: { section: 'expenses', view: 'expenses' } },
      { labelKey: 'deposits', permission: 'financial.deposits.view', search: { section: 'funds', view: 'deposits' } },
      { labelKey: 'ownerSettlements', permission: 'financial.owner_settlements.view', search: { section: 'funds', view: 'owner_settlements' } },
      { labelKey: 'bankReconciliation', permission: 'financial.bank_reconciliation.view', search: { section: 'banking', view: 'bank_reconciliation' } },
      { labelKey: 'commissions', permission: 'commissions.view', search: { section: 'expenses', view: 'commissions' } },
    ]);
  });

  it('keeps every Services child inside /maintenance and leaves Automation only in Settings', () => {
    const services = workspaceChildNavItems['/maintenance'];
    expect(services.map(([to]) => to)).toEqual(Array(4).fill('/maintenance'));
    expect(services.map(([, labelKey, , , permission, search]) => ({ labelKey, permission, search }))).toEqual([
      { labelKey: 'maintenance', permission: undefined, search: { section: 'maintenance' } },
      { labelKey: 'serviceProviders', permission: 'service_providers.view', search: { section: 'service_providers' } },
      { labelKey: 'utilities', permission: undefined, search: { section: 'utilities' } },
      { labelKey: 'documentsVault', permission: undefined, search: { section: 'documents_vault' } },
    ]);
    expect(services.some(([, labelKey]) => labelKey === 'automation')).toBe(false);
    expect(workspaceChildNavItems['/settings'].some(([, labelKey, , , permission, search]) =>
      labelKey === 'automation' && permission === 'automation.view' && search?.section === 'automation')).toBe(true);
  });

  it('does not leak feature registers back into global navigation', () => {
    const primaryPaths = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    for (const secondary of ['/people', '/owners', '/tenants', '/lands', '/units', '/commissions', '/invoices', '/receipts', '/expenses', '/arrears', '/utilities', '/service-providers']) {
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

  it('keeps mobile navigation to Menu + Search only', () => {
    expect(mobileNavItems).toHaveLength(0);
  });
});
