import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getNavRoot } from './route-nav-map';
import { getAllNavItems, mobileNavItems, navGroups, workspaceChildNavItems } from './app-nav-items';
import { ROUTE_CONTRACT, TARGET_IA_TOP_LEVEL } from './route-contract';
import { navigationLabels } from './terminology-registry';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');
const portfolioHubSource = readFileSync(new URL('../../features/portfolio-hub/portfolio-hub-workspace.tsx', import.meta.url), 'utf8');
const portfolioSectionsSource = readFileSync(new URL('../../features/portfolio-hub/portfolio-hub-sections.ts', import.meta.url), 'utf8');
const leasingHubSource = readFileSync(new URL('../../features/relationships-hub/leasing-hub-workspace.tsx', import.meta.url), 'utf8');
const leasingSectionsSource = readFileSync(new URL('../../features/relationships-hub/leasing-hub-sections.ts', import.meta.url), 'utf8');
const financePageSource = readFileSync(new URL('../../features/finance/FinancePage.tsx', import.meta.url), 'utf8');
const financeModelSource = readFileSync(new URL('../../features/finance/shell/financeShellModel.ts', import.meta.url), 'utf8');
const servicesSource = readFileSync(new URL('../../features/operations-hub/operations-hub-workspace.tsx', import.meta.url), 'utf8');
const servicesSectionsSource = readFileSync(new URL('../../features/operations-hub/operations-hub.sections.ts', import.meta.url), 'utf8');
const governanceSectionsSource = readFileSync(new URL('../../features/governance-hub/governance-hub-sections.ts', import.meta.url), 'utf8');

function hasRoute(path: string): boolean {
  return routeTreeSource.includes(`path: '${path}'`);
}

describe('Task-centric canonical IA', () => {
  it('locks the seven global destinations and keeps entity deep links registered', () => {
    expect(TARGET_IA_TOP_LEVEL).toEqual(['/dashboard', '/properties', '/contracts', '/financials', '/maintenance', '/reports', '/settings']);
    expect(navGroups.flatMap(([, items]) => items.map(([to]) => to))).toEqual([...TARGET_IA_TOP_LEVEL]);
    for (const path of ['/people', '/lands', '/commissions', '/owners', '/tenants']) expect(hasRoute(path)).toBe(true);
  });

  it('keeps Portfolio routine navigation focused while retaining specialist Lands capability', () => {
    for (const path of ['/properties', '/units', '/lands', '/owners']) expect(getNavRoot(path)).toBe('/properties');
    expect(workspaceChildNavItems['/properties'].map(([to]) => to)).toEqual(['/properties', '/properties']);
    expect(workspaceChildNavItems['/properties'].map(([, labelKey]) => labelKey)).toEqual(['units', 'owners']);
    expect(portfolioHubSource).toContain('LandsWorkspace');
    expect(portfolioHubSource).toContain('OwnersWorkspace');
    expect(portfolioSectionsSource).toMatch(/id: 'lands'[\s\S]*?showInPrimaryNavigation: false/);
  });

  it('keeps Leasing focused on contracts and tenants while supporting relationship deep links', () => {
    for (const path of ['/contracts', '/tenants', '/people', '/leads', '/communication']) expect(getNavRoot(path)).toBe('/contracts');
    expect(workspaceChildNavItems['/contracts'].map(([to]) => to)).toEqual(['/contracts']);
    expect(workspaceChildNavItems['/contracts'].map(([, labelKey]) => labelKey)).toEqual(['tenants']);
    for (const workspace of ['ContractsWorkspace', 'TenantsWorkspace', 'PeopleListPage', 'LeadsWorkspace', 'CommunicationWorkspace']) {
      expect(leasingHubSource).toContain(workspace);
    }
    for (const specialist of ['people', 'leads', 'communication']) {
      expect(leasingSectionsSource).toMatch(new RegExp(`id: '${specialist}'[\\s\\S]*?showInPrimaryNavigation: false`));
    }
  });

  it('keeps Money task-first: invoices, receipt history and expenses are the routine shortcuts', () => {
    const children = workspaceChildNavItems['/financials'];
    expect(children).toHaveLength(3);
    expect(children.every(([to]) => to === '/financials')).toBe(true);
    expect(children.map(([, , , , , search]) => search?.view)).toEqual(['invoices', 'receipts', 'expenses']);

    for (const routineSection of ['collections', 'fees', 'expenses', 'funds', 'banking']) {
      expect(financeModelSource).toMatch(new RegExp(`id: '${routineSection}'[\\s\\S]*?showInPrimaryNavigation: true`));
    }
    expect(financeModelSource).toMatch(/id: 'overview'[\s\S]*?showInPrimaryNavigation: false/);
    expect(financeModelSource).toMatch(/id: 'arrears'[\s\S]*?showInSectionNavigation: false/);
    expect(financeModelSource).toContain("id: 'commissions'");
    expect(financePageSource).toContain('<CommissionsWorkspace embedded />');
    expect(financePageSource).toContain('id="finance-view-panel-commissions"');
    expect(financePageSource).toContain('data-finance-primary-nav');
    expect(financePageSource).not.toContain('lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]');
  });

  it('keeps Services routine navigation to maintenance and utilities only', () => {
    const children = workspaceChildNavItems['/maintenance'];
    expect(children).toHaveLength(2);
    expect(children.every(([to]) => to === '/maintenance')).toBe(true);
    expect(children.map(([, , , , , search]) => search?.section)).toEqual(['maintenance', 'utilities']);
    expect(servicesSectionsSource).toMatch(/id: 'service_providers'[\s\S]*?showInPrimaryNavigation: false/);
    expect(servicesSectionsSource).toMatch(/id: 'documents_vault'[\s\S]*?showInPrimaryNavigation: false/);
    expect(servicesSectionsSource).not.toContain("| 'automation'");
    expect(servicesSource).not.toContain('AutomationWorkspace');
    expect(servicesSource).toContain("title = 'الخدمات'");
    expect(routeTreeSource).toContain("path: '/automation'");
    expect(routeTreeSource).toContain("to: '/settings'");
  });

  it('treats Automation as a guarded settings deep link, not routine navigation', () => {
    expect(workspaceChildNavItems['/settings'].map(([, labelKey]) => labelKey)).toEqual(['companySettings', 'usersPermissions']);
    expect(governanceSectionsSource).toMatch(/id: 'automation'[\s\S]*?showInPrimaryNavigation: false/);
    expect(routeTreeSource).toContain("path: '/automation'");
    expect(routeTreeSource).toContain("requirePermission('automation.view')");
    expect(routeTreeSource).toContain("section: 'automation'");
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
