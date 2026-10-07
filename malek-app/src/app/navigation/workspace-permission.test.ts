import { describe, expect, it } from 'vitest';
import { ROUTE_CONTRACT, workspacePermissionForPath } from './route-contract';

describe('reactive workspace gate behavior retained during extraction', () => {
  const cases = [
    ['/properties', 'properties.view'], ['/contracts', 'contracts.view'],
    ['/tenants', 'contracts.view'], ['/people', 'contracts.view'],
    ['/financials', 'financial.workspace.view'], ['/maintenance', 'maintenance.view'],
    ['/reports', 'financial.reports.view'],
  ] as const;

  it.each(cases)('%s retains its root and nested workspace permission', (path, permission) => {
    for (const suffix of ['', '/', '/new', '/some-id/edit', '/some-id/units/unit-id']) {
      expect(workspacePermissionForPath(path + suffix)).toBe(permission);
    }
    expect(workspacePermissionForPath(path + '-unrelated')).toBeNull();
  });

  it('receipts retains the exact-only gate', () => {
    expect(workspacePermissionForPath('/receipts')).toBe('financial.workspace.view');
    expect(workspacePermissionForPath('/receipts/unregistered')).toBeNull();
  });

  it.each(['/dashboard', '/settings', '/owners', '/lands', '/leads', '/login', '/unknown'])(
    '%s does not inherit unrelated sidebar permissions', (path) => {
      expect(workspacePermissionForPath(path)).toBeNull();
    },
  );

  it('every workspace gate declares an actual permission', () => {
    for (const route of ROUTE_CONTRACT.filter((entry) => entry.workspaceGuard)) {
      expect(route.permission).not.toBeNull();
    }
  });
});
