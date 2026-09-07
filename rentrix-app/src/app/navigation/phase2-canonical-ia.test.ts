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

  it('keeps Portfolio focused while revealing the specialist Lands register', () => {
    for (const path of ['/properties', '/lands', '/owners']) expect(getNavRoot(path)).toBe('/properties');
    expect(workspaceChildNavItems['/properties'].map(([to]) => to)).toEqual(['/properties', '/properties', '/lands']);
    expect(workspaceChildNavItems['/properties'].map(([, labelKey]) => labelKey)).toEqual(['units', 'owners', 'lands']);
    expect(portfolioHubSource).toContain('LandsWorkspace');
    expect(portfolioHubSource).toContain('OwnersWorkspace');
    // Hub tabs stay routine-first; /lands remains the canonical register page.
    expect(portfolioSectionsSource).toMatch(/id: 'lands'[\s\S]*?showInPrimaryNavigation: false/);
  });

  it('keeps Leasing focused while revealing people, leads and communication registers', () => {
    for (const path of ['/contracts', '/tenants', '/people', '/leads', '/communication']) expect(getNavRoot(path)).toBe('/contracts');
    expect(workspaceChildNavItems['/contracts'].map(([to]) => to)).toEqual(['/contracts', '/people', '/leads', '/communication']);
    expect(workspaceChildNavItems['/contracts'].map(([, labelKey]) => labelKey)).toEqual(['tenants', 'peopleDirectory', 'leads', 'communication']);
    for (const workspace of ['ContractsWorkspace', 'TenantsWorkspace', 'PeopleListPage', 'LeadsWorkspace', 'CommunicationWorkspace']) {
      expect(leasingHubSource).toContain(workspace);
    }
    for (const specialist of ['people', 'leads', 'communication']) {
      expect(leasingSectionsSource).toMatch(new RegExp(`id: '${specialist}'[\\s\\S]*?showInPrimaryNavigation: false`));
    }
  });

  it('keeps Money task-first: invoices, receipt history and expenses are the routine shortcuts', () => {
    const children = workspaceChildNavItems['/financials'];
    expect(children).toHaveLength(4);
    expect(children.slice(0, 3).every(([to]) => to === '/financials')).toBe(true);
    expect(children.map(([, , , , , search]) => search?.view)).toEqual(['invoices', 'receipts', 'expenses', undefined]);

    for (const routineSection of ['collections', 'fees', 'expenses', 'funds', 'banking']) {
      expect(financeModelSource).toMatch(new RegExp(`id: '${routineSection}'[\\s\\S]*?showInPrimaryNavigation: true`));
    }
    // The retired cockpit section is gone; only its deep-link redirect survives.
    expect(financeModelSource).not.toMatch(/id: 'overview'/);
    expect(financeModelSource).toContain("sec === 'overview'");
    expect(financeModelSource).toMatch(/id: 'arrears'[\s\S]*?showInSectionNavigation: false/);
    expect(financeModelSource).toContain("id: 'commissions'");
    expect(financePageSource).toContain('<CommissionsWorkspace embedded />');
    expect(financePageSource).toContain('id="finance-view-panel-commissions"');
    expect(financePageSource).toContain('data-finance-primary-nav');
    expect(financePageSource).not.toContain('lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]');
  });

  it('keeps Services routine navigation to maintenance and utilities only', () => {
    const children = workspaceChildNavItems['/maintenance'];
    expect(children).toHaveLength(4);
    expect(children.filter(([to]) => to === '/maintenance')).toHaveLength(3);
    expect(children.map(([, , , , , search]) => search?.section)).toEqual(['maintenance', 'utilities', undefined, 'documents_vault']);
    expect(servicesSectionsSource).toMatch(/id: 'service_providers'[\s\S]*?showInPrimaryNavigation: false/);
    expect(servicesSectionsSource).toMatch(/id: 'documents_vault'[\s\S]*?showInPrimaryNavigation: false/);
    expect(servicesSectionsSource).not.toContain("| 'automation'");
    expect(servicesSource).not.toContain('AutomationWorkspace');
    // The hub always owns its page identity (derived from the active section);
    // hub-inside-hub title overrides were removed as dead surface.
    expect(servicesSource).toContain('title={activeSectionDefinition.label}');
    expect(servicesSource).not.toContain('title?:');
  });

  it('treats Automation as a guarded settings deep link, not routine navigation', () => {
    expect(workspaceChildNavItems['/settings'].map(([, labelKey]) => labelKey)).toEqual(['companySettings', 'usersPermissions', 'adminSupport']);
    expect(governanceSectionsSource).toMatch(/id: 'automation'[\s\S]*?showInPrimaryNavigation: false/);
    // Automation has a single canonical destination: the guarded settings
    // section deep link. No legacy /automation route may be registered.
    expect(routeTreeSource).not.toContain("path: '/automation'");
  });

  it('keeps standalone compatibility routes without treating them as global products', () => {
    const primary = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    for (const path of ['/commissions', '/owners', '/tenants', '/people', '/lands', '/service-providers']) {
      expect(hasRoute(path)).toBe(true);
      expect(primary).not.toContain(path);
    }
  });

  it('keeps Reports independent from Money', () => {
    expect(getNavRoot('/reports')).toBe('/reports');
    expect(getNavRoot('/reports')).not.toBe('/financials');
  });

  it('route contract agrees with the workspace mental model', () => {
    const roots: Record<string, string> = {
      '/people': '/contracts', '/tenants': '/contracts', '/lands': '/properties', '/owners': '/properties',
      '/commissions': '/financials', '/service-providers': '/maintenance', '/receipts': '/financials',
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
      'اليوم', 'المحفظة', 'التأجير', 'المال', 'الخدمات', 'التقارير', 'الإعدادات',
    ]);
    expect(getAllNavItems().length).toBeGreaterThan(7);
    expect(mobileNavItems).toHaveLength(0);
  });
});
