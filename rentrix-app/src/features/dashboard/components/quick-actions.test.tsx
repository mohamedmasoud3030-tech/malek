// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { filterQuickActionsByPermission } from './quick-actions';
import type { AppPermission } from '@/features/auth/permissions';

const allowAll = () => true;
const denyAll = () => false;
const maintenanceOnly = (permission: AppPermission) => permission === 'maintenance.view';

describe('quick actions permission awareness', () => {
  it('offers every action when all permissions are granted (ADMIN/MANAGER shape)', () => {
    expect(filterQuickActionsByPermission(allowAll)).toHaveLength(4);
  });

  it('offers no action when the role holds none of the action permissions (USER shape)', () => {
    expect(filterQuickActionsByPermission(denyAll)).toHaveLength(0);
  });

  it('filters to exactly the permitted actions for partial permission sets', () => {
    const actions = filterQuickActionsByPermission(maintenanceOnly);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.to).toBe('/maintenance');
  });

  it('keeps every action bound to an explicit permission and destination', () => {
    for (const action of filterQuickActionsByPermission(allowAll)) {
      expect(action.permission).toBeTruthy();
      expect(action.to.startsWith('/')).toBe(true);
    }
  });
});
