import { describe, expect, it } from 'vitest';
import { getNavRoot, routeNavRoot, navRootTitle } from './route-nav-map';
import { workspaceLabels } from './terminology-registry';

describe('Route-to-nav-root map', () => {
  it('keeps core entities as distinct primary roots', () => {
    expect(getNavRoot('/properties')).toBe('/properties');
    expect(getNavRoot('/owners')).toBe('/owners');
    expect(getNavRoot('/owners/owner-1')).toBe('/owners');
    expect(getNavRoot('/tenants')).toBe('/tenants');
    expect(getNavRoot('/contracts')).toBe('/contracts');
  });

  it('keeps asset support under properties and relationship support under contracts (Phase 2: people/lands first-class)', () => {
    expect(getNavRoot('/units')).toBe('/properties');
    expect(getNavRoot('/lands')).toBe('/lands');
    expect(getNavRoot('/people')).toBe('/people');
    expect(getNavRoot('/people/new')).toBe('/people');
    expect(getNavRoot('/leads')).toBe('/contracts');
    expect(getNavRoot('/communication')).toBe('/contracts');
  });

  it('maps finance detail routes to financials, commissions standalone (Phase 2)', () => {
    for (const path of [
      '/financials',
      '/finance/collections',
      '/finance/expenses',
      '/finance/deposits',
      '/finance/banking',
      '/invoices',
      '/receipts',
      '/expenses',
      '/arrears',
      '/deposits',
      '/owner-settlements',
      '/bank-reconciliation',
    ]) {
      expect(getNavRoot(path)).toBe('/financials');
    }
    expect(getNavRoot('/commissions')).toBe('/commissions');
  });

  it('maps accounting compatibility deep links into accounting and reports', () => {
    expect(getNavRoot('/reports')).toBe('/reports');
    expect(getNavRoot('/accounting')).toBe('/reports');
    expect(getNavRoot('/ai-assistant')).toBe('/ai-assistant');
  });

  it('maps settings children to settings and operations children to maintenance', () => {
    expect(getNavRoot('/change-password')).toBe('/settings');
    expect(getNavRoot('/audit-log')).toBe('/settings');
    expect(getNavRoot('/data-integrity')).toBe('/settings');
    expect(getNavRoot('/system')).toBe('/settings');
    expect(getNavRoot('/utilities')).toBe('/maintenance');
    expect(getNavRoot('/automation')).toBe('/maintenance');
    expect(getNavRoot('/documents-vault')).toBe('/maintenance');
  });

  it('has one route-map entry per exact route', () => {
    const paths = [...routeNavRoot.keys()];
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('has Arabic titles for every primary navigation root (Phase 2: people/lands/commissions)', () => {
    for (const root of ['/dashboard', '/people', '/properties', '/lands', '/owners', '/tenants', '/contracts', '/maintenance', '/financials', '/commissions', '/reports', '/ai-assistant', '/settings']) {
      expect(navRootTitle[root]).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it('keeps canonical Arabic secondary terminology', () => {
    expect(workspaceLabels.tenants).toBe('المستأجرون');
    expect(workspaceLabels.expenses).toBe('المصروفات');
    expect(workspaceLabels.receipts).toBe('الإيصالات');
  });
});
