import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getNavRoot } from './route-nav-map';
import { getAllNavItems, mobileNavItems, navGroups, workspaceChildNavItems } from './app-nav-items';
import { ROUTE_CONTRACT, TARGET_IA_TOP_LEVEL } from './route-contract';
import { navigationLabels } from './terminology-registry';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');
const financePageSource = readFileSync(new URL('../../features/finance/FinancePage.tsx', import.meta.url), 'utf8');
const financeModelSource = readFileSync(new URL('../../features/finance/shell/financeShellModel.ts', import.meta.url), 'utf8');
function hasRoute(path: string): boolean { return routeTreeSource.includes(`path: '${path}'`); }

describe('Task-centric canonical IA', () => {
  it('locks the seven global destinations and keeps entity deep links registered', () => {
    expect(TARGET_IA_TOP_LEVEL).toEqual(['/dashboard', '/properties', '/contracts', '/financials', '/maintenance', '/reports', '/settings']);
    expect(navGroups.flatMap(([, items]) => items.map(([to]) => to))).toEqual([...TARGET_IA_TOP_LEVEL]);
    for (const path of ['/people', '/lands', '/commissions', '/owners', '/tenants', '/utilities', '/documents-vault']) expect(hasRoute(path)).toBe(true);
  });

  it('keeps Portfolio entities standalone', () => {
    for (const path of ['/properties', '/units', '/lands', '/owners']) expect(getNavRoot(path)).toBe('/properties');
    expect(workspaceChildNavItems['/properties'].map(([to]) => to)).toEqual(['/units', '/owners', '/lands']);
    expect(routeTreeSource).not.toContain('portfolio-hub');
  });

  it('keeps Leasing entities standalone', () => {
    for (const path of ['/contracts', '/tenants', '/people', '/leads', '/communication']) expect(getNavRoot(path)).toBe('/contracts');
    expect(workspaceChildNavItems['/contracts'].map(([to]) => to)).toEqual(['/contracts', '/tenants', '/people', '/leads', '/communication']);
    expect(routeTreeSource).not.toContain('relationships-hub');
    expect(routeTreeSource).toContain("@/features/contracts/ContractsListPage");
  });

  it('keeps Services entities standalone', () => {
    expect(workspaceChildNavItems['/maintenance'].map(([to]) => to)).toEqual(['/maintenance', '/utilities', '/service-providers', '/documents-vault']);
    expect(routeTreeSource).not.toContain('operations-hub');
    expect(routeTreeSource).toContain("@/features/utilities/components/utilities-workspace");
    expect(routeTreeSource).toContain("@/features/documents-vault/components/documents-vault-workspace");
  });

  it('keeps Governance entities standalone and guarded at route boundaries', () => {
    expect(workspaceChildNavItems['/settings'].map(([to]) => to)).toEqual(['/settings/company', '/settings/users-permissions', '/settings/automation', '/settings/audit-log', '/admin-support']);
    expect(routeTreeSource).not.toContain('governance-hub');
    expect(routeTreeSource).toContain("requirePermission('company.settings.manage')");
    expect(routeTreeSource).toContain("requireAnyPermission('users.manage', 'permission_requests.review')");
    expect(routeTreeSource).toContain("requirePermission('automation.view')");
    expect(routeTreeSource).toContain("requirePermission('audit.view')");
  });

  it('keeps Money task-first', () => {
    const children = workspaceChildNavItems['/financials'];
    expect(children).toHaveLength(4);
    expect(children.slice(0, 3).every(([to]) => to === '/financials')).toBe(true);
    for (const routineSection of ['collections', 'fees', 'expenses', 'funds', 'banking']) expect(financeModelSource).toMatch(new RegExp(`id: '${routineSection}'[\\s\\S]*?showInPrimaryNavigation: true`));
    expect(financePageSource).toContain('<CommissionsWorkspace embedded />');
  });

  it('keeps specialist destinations non-primary while routable', () => {
    const primary = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    for (const path of ['/commissions', '/owners', '/tenants', '/people', '/lands', '/units', '/service-providers', '/utilities', '/documents-vault']) {
      expect(hasRoute(path)).toBe(true);
      expect(primary).not.toContain(path);
    }
  });

  it('keeps Reports independent from Money', () => {
    expect(getNavRoot('/reports')).toBe('/reports');
    expect(getNavRoot('/reports')).not.toBe('/financials');
  });

  it('keeps one lightweight shell vocabulary and mobile Menu + Search', () => {
    const primaryItems = navGroups.flatMap(([, items]) => items);
    expect(primaryItems).toHaveLength(7);
    expect(navGroups).toHaveLength(2);
    expect(primaryItems.map(([, labelKey]) => navigationLabels[labelKey])).toEqual(['اليوم', 'العقارات', 'العقود', 'المال', 'الصيانة', 'التقارير', 'الإعدادات']);
    expect(getAllNavItems().length).toBeGreaterThan(7);
    expect(mobileNavItems).toHaveLength(0);
  });

  it('keeps route contract roots coherent', () => {
    const roots: Record<string, string> = { '/people': '/contracts', '/tenants': '/contracts', '/lands': '/properties', '/owners': '/properties', '/commissions': '/financials', '/service-providers': '/maintenance' };
    for (const [path, root] of Object.entries(roots)) {
      const entry = ROUTE_CONTRACT.find((candidate) => candidate.canonical === path)!;
      expect(entry.isPrimaryNav).toBe(false);
      expect(entry.sidebarRoot).toBe(root);
    }
  });
});
