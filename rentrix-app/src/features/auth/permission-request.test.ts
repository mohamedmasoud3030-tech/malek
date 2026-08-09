import { describe, expect, it } from 'vitest';
import { canAccess, getAuthorizationContextFromUser, getPermissionLabel } from './permissions';

describe('permission request semantic authorization', () => {
  it('separates review authority from users, roles, and company settings', () => {
    const manager = getAuthorizationContextFromUser({ id: 'manager', email: 'manager@example.com', app_metadata: { user_role: 'MANAGER' } });
    const admin = getAuthorizationContextFromUser({ id: 'admin', email: 'admin@example.com', app_metadata: { user_role: 'ADMIN' } });
    expect(canAccess(manager, 'permission_requests.review')).toBe(true);
    expect(canAccess(manager, 'users.manage')).toBe(false);
    expect(canAccess(manager, 'company.settings.manage')).toBe(false);
    expect(canAccess(manager, 'system.view')).toBe(false);
    expect(canAccess(admin, 'permission_requests.review')).toBe(true);
    expect(canAccess(admin, 'users.manage')).toBe(true);
    expect(canAccess(admin, 'company.settings.manage')).toBe(true);
  });

  it('provides a human Arabic label instead of exposing permission keys', () => {
    expect(getPermissionLabel('financial.payments.create')).toBe('تسجيل التحصيلات');
    expect(getPermissionLabel('users.manage')).toBe('إدارة المستخدمين والأدوار');
  });
});
