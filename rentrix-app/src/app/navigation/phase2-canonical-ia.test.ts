import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getNavRoot } from './route-nav-map';
import { getAllNavItems, mobileNavItems, navGroups, workspaceChildNavItems } from './app-nav-items';
import { ROUTE_CONTRACT, TARGET_IA_TOP_LEVEL } from './route-contract';
import { navigationLabels } from './terminology-registry';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');
const portfolioHubSource = readFileSync(new URL('../../features/portfolio-hub/portfolio-hub-workspace.tsx', import.meta.url), 'utf8');
const portfolioSectionsSource = readFileSync(new URL('../../features/portfolio-hub/portfolio-hub-sections.ts', import.meta.url), 'utf8');
const leasingHubSource = readFileSync(new URL('../../features/leasing-hub/leasing-hub-workspace.tsx', import.meta.url), 'utf8');
const leasingSectionsSource = readFileSync(new URL('../../features/leasing-hub/leasing-hub-sections.ts', import.meta.url), 'utf8');
const contractsRouteSource = readFileSync(new URL('../../routes/_protected.contracts.tsx', import.meta.url), 'utf8');
const financialsPageSource = readFileSync(new URL('../../features/financials/financials-page.tsx', import.meta.url), 'utf8');
const financialsSource = readFileSync(new URL('../../features/financials/finance-shell-model.ts', import.meta.url), 'utf8') + '\n' + financialsPageSource;

function hasRoute(path: string): boolean {
  return routeTreeSource.includes(`path: '${path}'`);
}

describe('Task-centric canonical IA', () => {
  it('keeps all entity routes first-class while removing them from the global shell', () => {
    for (const path of ['/people', '/lands', '/commissions', '/owners', '/tenants']) expect(hasRoute(path)).toBe(true);
    const primary = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    expect(primary).toEqual([...TARGET_IA_TOP_LEVEL]);
    for (const secondary of ['/people', '/lands', '/commissions', '/owners', '/tenants']) expect(primary).not.toContain(secondary);
  });

  it('organizes Portfolio around managed assets and ownership in one workspace', () => {
    for (const path of ['/properties', '/units', '/lands', '/owners']) expect(getNavRoot(path)).toBe('/properties');
    const children = workspaceChildNavItems['/properties'];
    expect(children.map(([to]) => to)).toEqual(['/properties', '/properties', '/properties']);
    expect(children.map(([, labelKey, , , , search]) => [labelKey, search?.section])).toEqual([
      ['units', 'units'], ['lands', 'lands'], ['owners', 'owners'],
    ]);
    expect(portfolioSectionsSource).toContain("'properties' | 'units' | 'lands' | 'owners'");
    expect(portfolioHubSource).toContain('LandsWorkspace');
    expect(portfolioHubSource).toContain('OwnersWorkspace');
  });

  it('organizes Leasing around one context-preserving journey workspace', () => {
    for (const path of ['/contracts', '/tenants', '/people', '/leads', '/communication']) expect(getNavRoot(path)).toBe('/contracts');
    const children = workspaceChildNavItems['/contracts'];
    expect(children.map(([to]) => to)).toEqual(['/contracts', '/contracts', '/contracts', '/contracts']);
    expect(children.map(([, labelKey, , , , search]) => [labelKey, search?.workspace])).toEqual([
      ['tenants', 'tenants'],
      ['peopleDirectory', 'people'],
      ['leads', 'leads'],
      ['communication', 'communication'],
    ]);
    expect(leasingSectionsSource).toContain("'contracts' | 'tenants' | 'people' | 'leads' | 'communication'");
    for (const workspace of ['ContractsWorkspace', 'TenantsWorkspace', 'PeopleListPage', 'LeadsWorkspace', 'CommunicationWorkspace']) {
      expect(leasingHubSource).toContain(workspace);
    }
    expect(contractsRouteSource).toContain('LeasingHubPage');
  });

  it('organizes Money around obligations, cash, owner funds, banking and commissions', () => {
    const children = workspaceChildNavItems['/financials'].map(([to]) => to);
    expect(children).toEqual([
      '/invoices', '/receipts', '/arrears', '/expenses', '/deposits', '/owner-settlements', '/bank-reconciliation', '/commissions',
    ]);
    for (const path of children) {
      expect(getNavRoot(path)).toBe('/financials');
      expect(hasRoute(path)).toBe(true);
    }
  });

  it('keeps Services as the operational home for maintenance and support capabilities', () => {
    expect(workspaceChildNavItems['/maintenance'].map(([to]) => to)).toEqual([
      '/maintenance', '/service-providers', '/utilities', '/documents-vault',
    ]);
    for (const path of ['/service-providers', '/utilities', '/documents-vault']) expect(getNavRoot(path)).toBe('/maintenance');
  });

  it('keeps Reports independent from Money', () => {
    expect(getNavRoot('/reports')).toBe('/reports');
    expect(getNavRoot('/accounting')).toBe('/reports');
    expect(getNavRoot('/reports')).not.toBe('/financials');
    expect(navGroups.flatMap(([, items]) => items).filter(([to]) => to === '/reports').map(([to]) => to)).toEqual(['/reports']);
  });

  it('preserves standalone deep-link compatibility while preferring owning workspaces', () => {
    for (const path of ['/lands', '/owners', '/units', '/tenants', '/people', '/leads', '/communication']) expect(hasRoute(path)).toBe(true);
    // Money remains the next migration stage; commissions still has standalone compatibility here.
    expect(financialsSource).toContain("navigate({ to: '/commissions'");
    expect(routeTreeSource).toContain("throw redirect({ to: '/commissions' })");
  });

  it('keeps existing route permissions after regrouping', () => {
    expect(routeTreeSource).toContain("requirePermission('lands.view')");
    expect(routeTreeSource).toContain("requirePermission('leads.view')");
    expect(routeTreeSource).toContain("requirePermission('communication.view')");
    expect(routeTreeSource).toContain("requirePermission('commissions.view')");
    const peopleBlock = routeTreeSource.slice(routeTreeSource.indexOf("path: '/people'"), routeTreeSource.indexOf("path: '/people'") + 500);
    expect(peopleBlock).not.toContain("requirePermission('people");
  });

  it('route contract agrees with the seven-workspace mental model', () => {
    expect(TARGET_IA_TOP_LEVEL).toEqual(['/dashboard', '/properties', '/contracts', '/financials', '/maintenance', '/reports', '/settings']);
    const rootBySecondary: Record<string, string> = {
      '/people': '/contracts', '/tenants': '/contracts', '/lands': '/properties', '/owners': '/properties', '/commissions': '/financials',
    };
    for (const [path, root] of Object.entries(rootBySecondary)) {
      const entry = ROUTE_CONTRACT.find((candidate) => candidate.canonical === path)!;
      expect(entry.isPrimaryNav).toBe(false);
      expect(entry.sidebarRoot).toBe(root);
    }
  });

  it('global shell contains seven primary items without seven duplicate section headings', () => {
    const primaryItems = navGroups.flatMap(([, items]) => items);
    expect(primaryItems).toHaveLength(7);
    expect(navGroups).toHaveLength(2);
    expect(navGroups.map(([title]) => title)).toEqual(['العمل', 'التحليل والإدارة']);
    expect(primaryItems.map(([, labelKey]) => navigationLabels[labelKey])).toEqual([
      'اليوم', 'المحفظة', 'التأجير', 'المال', 'الخدمات', 'التقارير والكشوف', 'الإعدادات',
    ]);
    expect(getAllNavItems().length).toBeGreaterThan(7);
  });

  it('mobile navigation remains Menu + Search only', () => {
    expect(mobileNavItems).toHaveLength(0);
    expect(readFileSync(new URL('../layout/app-shell.tsx', import.meta.url), 'utf8')).toContain('MobileFloatingControl');
  });
});
