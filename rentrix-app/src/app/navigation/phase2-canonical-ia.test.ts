import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getNavRoot } from './route-nav-map';
import { getAllNavItems, mobileNavItems, navGroups, workspaceChildNavItems } from './app-nav-items';
import { ROUTE_CONTRACT, TARGET_IA_TOP_LEVEL } from './route-contract';
import { navigationLabels } from './terminology-registry';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');
const portfolioHubSource = readFileSync(new URL('../../features/portfolio-hub/portfolio-hub-workspace.tsx', import.meta.url), 'utf8');
const financialsPageSource = readFileSync(new URL('../../features/financials/financials-page.tsx', import.meta.url), 'utf8');
const financialsSource = readFileSync(new URL('../../features/financials/finance-shell-model.ts', import.meta.url), 'utf8')
  + '\n' + financialsPageSource;

function hasRoute(path: string): boolean {
  return routeTreeSource.includes(`path: '${path}'`);
}

describe('Task-centric canonical IA', () => {
  it('keeps all entity routes first-class while removing them from the global shell', () => {
    for (const path of ['/people', '/lands', '/commissions', '/owners', '/tenants']) {
      expect(hasRoute(path)).toBe(true);
    }

    const primary = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    expect(primary).toEqual([...TARGET_IA_TOP_LEVEL]);
    for (const secondary of ['/people', '/lands', '/commissions', '/owners', '/tenants']) {
      expect(primary).not.toContain(secondary);
    }
  });

  it('organizes Portfolio around managed assets and ownership', () => {
    expect(getNavRoot('/properties')).toBe('/properties');
    expect(getNavRoot('/units')).toBe('/properties');
    expect(getNavRoot('/lands')).toBe('/properties');
    expect(getNavRoot('/owners')).toBe('/properties');
    expect(workspaceChildNavItems['/properties'].map(([to]) => to)).toEqual(['/units', '/lands', '/owners']);
  });

  it('organizes Leasing around contract and relationship workflows', () => {
    for (const path of ['/contracts', '/tenants', '/people', '/leads', '/communication']) {
      expect(getNavRoot(path)).toBe('/contracts');
    }
    expect(workspaceChildNavItems['/contracts'].map(([to]) => to)).toEqual([
      '/tenants', '/people', '/leads', '/communication',
    ]);
  });

  it('organizes Money around obligations, cash, owner funds, banking and commissions', () => {
    const children = workspaceChildNavItems['/financials'].map(([to]) => to);
    expect(children).toEqual([
      '/invoices',
      '/receipts',
      '/arrears',
      '/expenses',
      '/deposits',
      '/owner-settlements',
      '/bank-reconciliation',
      '/commissions',
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
    expect(getNavRoot('/service-providers')).toBe('/maintenance');
    expect(getNavRoot('/utilities')).toBe('/maintenance');
    expect(getNavRoot('/documents-vault')).toBe('/maintenance');
  });

  it('keeps Reports independent from Money', () => {
    expect(getNavRoot('/reports')).toBe('/reports');
    expect(getNavRoot('/accounting')).toBe('/reports');
    expect(getNavRoot('/reports')).not.toBe('/financials');
    const reportItems = navGroups.flatMap(([, items]) => items).filter(([to]) => to === '/reports');
    expect(reportItems.map(([to]) => to)).toEqual(['/reports']);
  });

  it('preserves legacy hub/deep-link compatibility instead of breaking routes', () => {
    expect(portfolioHubSource).toContain("requestedSection === 'lands'");
    expect(portfolioHubSource).toContain("navigate({ to: '/lands'");
    expect(financialsSource).toContain("navigate({ to: '/commissions'");
    expect(routeTreeSource).toContain("throw redirect({ to: '/commissions' })");
    expect(routeTreeSource).toContain("...previous");
  });

  it('keeps existing route permissions after regrouping', () => {
    expect(routeTreeSource).toContain("path: '/lands'");
    expect(routeTreeSource).toContain("requirePermission('lands.view')");
    expect(routeTreeSource).toContain("path: '/commissions'");
    expect(routeTreeSource).toContain("requirePermission('commissions.view')");
    const peopleBlock = routeTreeSource.slice(routeTreeSource.indexOf("path: '/people'"), routeTreeSource.indexOf("path: '/people'") + 500);
    expect(peopleBlock).not.toContain("requirePermission('people");
  });

  it('route contract agrees with the seven-workspace mental model', () => {
    expect(TARGET_IA_TOP_LEVEL).toEqual([
      '/dashboard', '/properties', '/contracts', '/financials', '/maintenance', '/reports', '/settings',
    ]);

    const rootBySecondary: Record<string, string> = {
      '/people': '/contracts',
      '/tenants': '/contracts',
      '/lands': '/properties',
      '/owners': '/properties',
      '/commissions': '/financials',
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
