import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getNavRoot } from './route-nav-map';
import { getAllNavItems, mobileNavItems, navGroups, workspaceChildNavItems } from './app-nav-items';
import { ROUTE_CONTRACT } from './route-contract';

const routeTreeSource = readFileSync(new URL('../router/route-tree.ts', import.meta.url), 'utf8');
const portfolioHubSource = readFileSync(new URL('../../features/portfolio-hub/portfolio-hub-workspace.tsx', import.meta.url), 'utf8');
const financialsSource = readFileSync(new URL('../../features/financials/financials-page.tsx', import.meta.url), 'utf8');

function hasRoute(path: string): boolean {
  return routeTreeSource.includes(`path: '${path}'`);
}

describe('Phase 2 — Canonical IA + Navigation restructure', () => {
  it('/people is first-class canonical (not redirect)', () => {
    expect(hasRoute('/people')).toBe(true);
    expect(routeTreeSource).toContain("path: '/people', component: lazyRouteComponent(() => import('@/routes/_protected.people')");
    expect(getNavRoot('/people')).toBe('/people');
    expect(getNavRoot('/people/new')).toBe('/people');
    const allPrimary = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    expect(allPrimary).toContain('/people');
    expect(workspaceChildNavItems['/contracts'].map(([to]) => to)).not.toContain('/people');
    expect(workspaceChildNavItems['/people'].map(([to]) => to)).toEqual(['/leads', '/owners', '/tenants', '/communication']);
  });

  it('legacy /contracts?section destinations redirect to their People-owned routes', () => {
    expect(routeTreeSource).toContain("legacySection === 'people'");
    expect(routeTreeSource).toContain("legacySection === 'leads'");
    expect(routeTreeSource).toContain("? '/communication'");
    expect(routeTreeSource).toContain('throw redirect({');
  });

  it('/lands is first-class canonical (not redirect) with lands.view guard', () => {
    expect(hasRoute('/lands')).toBe(true);
    expect(routeTreeSource).toContain("path: '/lands', beforeLoad: requirePermission('lands.view'), component: lazyRouteComponent(() => import('@/routes/_protected.lands')");
    expect(getNavRoot('/lands')).toBe('/lands');
    const allPrimary = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    expect(allPrimary).toContain('/lands');
    expect(workspaceChildNavItems['/properties'].map(([to]) => to)).not.toContain('/lands');
    expect(workspaceChildNavItems['/lands']).toEqual([]);
  });

  it('legacy /properties?section=lands reaches /lands (hub redirect)', () => {
    expect(portfolioHubSource).toContain("requestedSection === 'lands'");
    expect(portfolioHubSource).toContain("navigate({ to: '/lands'");
    expect(portfolioHubSource).toContain("requestedSection === 'owners' || requestedSection === 'lands'");
  });

  it('/commissions is first-class canonical standalone (not under finance/banking)', () => {
    expect(hasRoute('/commissions')).toBe(true);
    expect(routeTreeSource).toContain("path: '/commissions'");
    expect(routeTreeSource).toContain("requirePermission('commissions.view')");
    expect(routeTreeSource).toContain("@/routes/_protected.commissions");
    expect(getNavRoot('/commissions')).toBe('/commissions');
    const allPrimary = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    expect(allPrimary).toContain('/commissions');
    const commissionsGroup = navGroups.find(([title]) => title === 'العمولات');
    expect(commissionsGroup).toBeDefined();
    expect(financialsSource).not.toContain('CommissionsWorkspace');
    expect(financialsSource).toContain("navigate({ to: '/commissions'");
  });

  it('finance child destinations remain reachable (progressive disclosure)', () => {
    for (const path of ['/invoices', '/receipts', '/expenses', '/arrears', '/deposits', '/owner-settlements', '/bank-reconciliation']) {
      expect(hasRoute(path)).toBe(true);
    }
    // finance hub still has 5 sections (overview, collections, expenses, funds, banking) without commissions
    expect(financialsSource).toContain("id: 'overview'");
    expect(financialsSource).toContain("id: 'collections'");
    expect(financialsSource).toContain("id: 'expenses'");
    expect(financialsSource).toContain("id: 'funds'");
    expect(financialsSource).toContain("id: 'banking'");
    expect(financialsSource).not.toContain("id: 'commissions'");
  });

  it('reports is top-level clear and not under finance visual group', () => {
    const financeGroup = navGroups.find(([title]) => title === 'المالية');
    expect(financeGroup?.[1].map(([to]) => to)).toEqual(['/financials']);
    const reportsGroup = navGroups.find(([title]) => title === 'التقارير');
    expect(reportsGroup?.[1].map(([to]) => to)).toEqual(['/reports']);
    expect(getNavRoot('/reports')).toBe('/reports');
    expect(getNavRoot('/accounting')).toBe('/reports');
    expect(hasRoute('/reports')).toBe(true);
  });

  it('desktop/sidebar active-state: people/lands/commissions/reports do not highlight wrong parent', () => {
    expect(getNavRoot('/people')).not.toBe('/contracts');
    expect(getNavRoot('/lands')).not.toBe('/properties');
    expect(getNavRoot('/commissions')).not.toBe('/financials');
    expect(getNavRoot('/commissions')).not.toBe('/finance/banking');
    expect(getNavRoot('/reports')).not.toBe('/financials');
    expect(getNavRoot('/people/new')).toBe('/people');
    expect(getNavRoot('/lands')).toBe('/lands');
  });

  it('permissions parity for new canonicals', () => {
    expect(routeTreeSource).toContain("path: '/lands'");
    expect(routeTreeSource).toContain("requirePermission('lands.view')");
    expect(routeTreeSource).toContain("path: '/commissions'");
    expect(routeTreeSource).toContain("requirePermission('commissions.view')");
    // people has no permission (auth-only) — keep
    const peopleBlock = routeTreeSource.slice(routeTreeSource.indexOf("path: '/people'"), routeTreeSource.indexOf("path: '/people'") + 500);
    expect(peopleBlock).not.toContain("requirePermission('people");
  });

  it('no blank states for new canonicals', () => {
    for (const path of ['/people', '/lands', '/commissions']) {
      const idx = routeTreeSource.indexOf(`path: '${path}'`);
      const block = routeTreeSource.slice(routeTreeSource.lastIndexOf('createRoute({', idx), idx + 1500);
      expect(block).toMatch(/component:/);
    }
  });

  it('legacy hub redirects use replace:true for correct Back/Forward', () => {
    expect(portfolioHubSource).toMatch(/navigate\(\{ to: '\/lands', replace: true \}\)/);
    expect(routeTreeSource).toContain("legacyTarget = legacySection === 'people'");
    expect(financialsSource).toMatch(/navigate\(\{ to: '\/commissions', replace: true \}\)/);
    // finance/banking legacy also uses redirect (route-tree)
    expect(routeTreeSource).toContain("throw redirect({ to: '/commissions' })");
  });

  it('query params preservation for finance legacy routes (still via redirect)', () => {
    // finance/collections etc still preserve previous search
    expect(routeTreeSource).toContain("...previous");
    expect(routeTreeSource).toContain("section: 'collections'");
  });

  it('route-contract reflects Phase 2 canonical IA', () => {
    const people = ROUTE_CONTRACT.find((e) => e.canonical === '/people')!;
    expect(people.isPrimaryNav).toBe(true);
    expect(people.sidebarRoot).toBe('/people');
    const lands = ROUTE_CONTRACT.find((e) => e.canonical === '/lands')!;
    expect(lands.isPrimaryNav).toBe(true);
    expect(lands.sidebarRoot).toBe('/lands');
    const commissions = ROUTE_CONTRACT.find((e) => e.canonical === '/commissions')!;
    expect(commissions.isPrimaryNav).toBe(true);
    expect(commissions.sidebarRoot).toBe('/commissions');
  });

  it('mobile navigation is replaced by the Menu + Search floating control', () => {
    expect(mobileNavItems).toHaveLength(0);
    expect(readFileSync(new URL('../layout/app-shell.tsx', import.meta.url), 'utf8')).toContain('MobileFloatingControl');
  });
});
