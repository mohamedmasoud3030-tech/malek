import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getNavRoot } from './route-nav-map';
import { getAllNavItems, mobileNavItems, navGroups, workspaceChildNavItems } from './app-nav-items';
import { ROUTE_CONTRACT, TARGET_IA_TOP_LEVEL } from './route-contract';
import { navigationLabels } from './terminology-registry';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');
const portfolioHubSource = readFileSync(new URL('../../features/portfolio-hub/portfolio-hub-workspace.tsx', import.meta.url), 'utf8');
const leasingHubSource = readFileSync(new URL('../../features/leasing-hub/leasing-hub-workspace.tsx', import.meta.url), 'utf8');
const moneyRouteSource = readFileSync(new URL('../../features/financials/money-page.tsx', import.meta.url), 'utf8');
const financeModelSource = readFileSync(new URL('../../features/financials/finance-shell-model.ts', import.meta.url), 'utf8');
const servicesSource = readFileSync(new URL('../../features/operations-hub/operations-hub-workspace.tsx', import.meta.url), 'utf8');
const servicesSectionsSource = readFileSync(new URL('../../features/operations-hub/operations-hub.sections.ts', import.meta.url), 'utf8');

function hasRoute(path: string): boolean {
  return routeTreeSource.includes(`path: '${path}'`);
}

describe('Task-centric canonical IA', () => {
  it('locks the seven global destinations and keeps entity deep links registered', () => {
    expect(TARGET_IA_TOP_LEVEL).toEqual(['/dashboard', '/properties', '/contracts', '/financials', '/maintenance', '/reports', '/settings']);
    expect(navGroups.flatMap(([, items]) => items.map(([to]) => to))).toEqual([...TARGET_IA_TOP_LEVEL]);
    for (const path of ['/people', '/lands', '/commissions', '/owners', '/tenants']) expect(hasRoute(path)).toBe(true);
  });

  it('keeps Portfolio as one managed-assets and ownership workspace', () => {
    for (const path of ['/properties', '/units', '/lands', '/owners']) expect(getNavRoot(path)).toBe('/properties');
    expect(workspaceChildNavItems['/properties'].map(([to]) => to)).toEqual(['/properties', '/properties', '/properties']);
    expect(portfolioHubSource).toContain('LandsWorkspace');
    expect(portfolioHubSource).toContain('OwnersWorkspace');
  });

  it('keeps Leasing as one contract-and-relationship journey', () => {
    for (const path of ['/contracts', '/tenants', '/people', '/leads', '/communication']) expect(getNavRoot(path)).toBe('/contracts');
    expect(workspaceChildNavItems['/contracts'].map(([to]) => to)).toEqual(['/contracts', '/contracts', '/contracts', '/contracts']);
    for (const workspace of ['ContractsWorkspace', 'TenantsWorkspace', 'PeopleListPage', 'LeadsWorkspace', 'CommunicationWorkspace']) {
      expect(leasingHubSource).toContain(workspace);
    }
  });

  it('keeps Money capabilities inside /financials instead of module-hopping', () => {
    const children = workspaceChildNavItems['/financials'];
    expect(children).toHaveLength(8);
    expect(children.every(([to]) => to === '/financials')).toBe(true);
    expect(children.map(([, , , , , search]) => search?.view)).toEqual([
      'invoices', 'receipts', 'arrears', 'expenses', 'deposits', 'owner_settlements', 'bank_reconciliation', 'commissions',
    ]);
    expect(financeModelSource).toContain("id: 'commissions'");
    expect(moneyRouteSource).toContain('<CommissionsWorkspace embedded />');
  });

  it('keeps Services in one operational workspace and removes duplicate Automation authority', () => {
    const children = workspaceChildNavItems['/maintenance'];
    expect(children).toHaveLength(4);
    expect(children.every(([to]) => to === '/maintenance')).toBe(true);
    expect(children.map(([, , , , , search]) => search?.section)).toEqual([
      'maintenance', 'service_providers', 'utilities', 'documents_vault',
    ]);
    expect(servicesSectionsSource).toContain("'service_providers'");
    expect(servicesSectionsSource).toContain("'documents_vault'");
    expect(servicesSectionsSource).not.toContain("| 'automation'");
    expect(servicesSource).not.toContain('AutomationWorkspace');
    expect(servicesSource).toContain("title = 'الخدمات'");
    expect(routeTreeSource).toContain("path: '/automation'");
    expect(routeTreeSource).toContain("to: '/settings'");
  });

  it('keeps standalone compatibility routes without treating them as global products', () => {
    const primary = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    for (const path of ['/commissions', '/owners', '/tenants', '/people', '/lands', '/utilities', '/service-providers', '/automation']) {
      expect(hasRoute(path)).toBe(true);
      expect(primary).not.toContain(path);
    }
  });

  it('keeps Reports independent from Money', () => {
    expect(getNavRoot('/reports')).toBe('/reports');
    expect(getNavRoot('/accounting')).toBe('/reports');
    expect(getNavRoot('/reports')).not.toBe('/financials');
  });

  it('route contract agrees with the workspace mental model', () => {
    const roots: Record<string, string> = {
      '/people': '/contracts', '/tenants': '/contracts', '/lands': '/properties', '/owners': '/properties',
      '/commissions': '/financials', '/service-providers': '/maintenance', '/utilities': '/maintenance', '/documents-vault': '/maintenance',
    };
    for (const [path, root] of Object.entries(roots)) {
      const entry = ROUTE_CONTRACT.find((candidate) => candidate.canonical === path)!;
      expect(entry.isPrimaryNav).toBe(false);
      expect(entry.sidebarRoot).toBe(root);
    }
  });

  it('keeps one lightweight shell vocabulary and mobile Menu + Search', () => {
    const primaryItems = navGroups.flatMap(([, items]) => items);
    expect(primaryItems).toHaveLength(7);
    expect(navGroups).toHaveLength(2);
    expect(primaryItems.map(([, labelKey]) => navigationLabels[labelKey])).toEqual([
      'اليوم', 'المحفظة', 'التأجير', 'المال', 'الخدمات', 'التقارير والكشوف', 'الإعدادات',
    ]);
    expect(getAllNavItems().length).toBeGreaterThan(7);
    expect(mobileNavItems).toHaveLength(0);
  });
});
