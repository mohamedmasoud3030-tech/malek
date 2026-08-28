import { describe, expect, it } from 'vitest';
import {
  appPermissions,
  canAccess,
  getPermissionLabel,
  type AuthorizationContext,
} from './permissions';

const employeeBase: AuthorizationContext = {
  userId: 'employee-1',
  email: 'employee@example.test',
  role: 'USER',
  grantedPermissions: [],
  effectivePermissionsResolved: true,
};

describe('external portal link permissions', () => {
  it('keeps both link capabilities in the typed permission catalog', () => {
    expect(appPermissions).toContain('owner.portal.link');
    expect(appPermissions).toContain('tenant.portal.link');
    expect(getPermissionLabel('owner.portal.link')).toBe('تصدير رابط عرض بوابة المالك');
    expect(getPermissionLabel('tenant.portal.link')).toBe('تصدير رابط عرض بوابة المستأجر');
  });

  it('does not grant link export to an employee unless explicitly delegated', () => {
    expect(canAccess(employeeBase, 'owner.portal.link')).toBe(false);
    expect(canAccess(employeeBase, 'tenant.portal.link')).toBe(false);

    const delegated: AuthorizationContext = {
      ...employeeBase,
      grantedPermissions: ['tenant.portal.link'],
    };
    expect(canAccess(delegated, 'tenant.portal.link')).toBe(true);
    expect(canAccess(delegated, 'owner.portal.link')).toBe(false);
  });

  it('keeps the office owner omnipotent through the compatibility ADMIN context', () => {
    const owner: AuthorizationContext = {
      userId: 'owner-1',
      email: 'owner@example.test',
      role: 'ADMIN',
      effectivePermissionsResolved: false,
    };
    expect(canAccess(owner, 'owner.portal.link')).toBe(true);
    expect(canAccess(owner, 'tenant.portal.link')).toBe(true);
  });
});
