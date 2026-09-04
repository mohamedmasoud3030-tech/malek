import { describe, expect, it } from 'vitest';
import { getNavRoot, routeNavRoot } from './route-nav-map';
import { workspaceLabels } from './terminology-registry';

describe('Route-to-nav-root map', () => {
  it('maps portfolio entities to the Portfolio root', () => {
    for (const path of [
      '/properties',
      '/lands',
      '/lands/land-1',
      '/owners',
      '/owners/owner-1',
    ]) {
      expect(getNavRoot(path)).toBe('/properties');
    }
  });

  it('maps leasing relationships to the Leasing root', () => {
    for (const path of [
      '/contracts',
      '/contracts/new',
      '/tenants',
      '/tenants/tenant-1',
      '/people',
      '/people/new',
      '/leads',
      '/communication',
    ]) {
      expect(getNavRoot(path)).toBe('/contracts');
    }
  });

  it('maps all day-to-day finance registers to Money', () => {
    for (const path of [
      '/financials',
      '/receipts',
      '/commissions',
    ]) {
      expect(getNavRoot(path)).toBe('/financials');
    }
  });

  it('keeps reports independent from Money', () => {
    expect(getNavRoot('/reports')).toBe('/reports');
    expect(getNavRoot('/ai-assistant')).toBe('/dashboard');
  });

  it('maps service providers to Services and tools to Settings', () => {
    expect(getNavRoot('/service-providers')).toBe('/maintenance');
    expect(getNavRoot('/settings')).toBe('/settings');
    expect(getNavRoot('/help')).toBe('/settings');
  });

  it('has one route-map entry per exact route', () => {
    const paths = [...routeNavRoot.keys()];
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('keeps canonical Arabic secondary terminology', () => {
    expect(workspaceLabels.tenants).toBe('المستأجرون');
    expect(workspaceLabels.expenses).toBe('المصروفات');
    expect(workspaceLabels.receipts).toBe('الإيصالات');
  });
});
