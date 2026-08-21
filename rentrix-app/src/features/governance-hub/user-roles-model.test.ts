import { describe, expect, it } from 'vitest';
import { canManageGovernedUser, getRoleLabel, governedUserRoles } from './user-roles-model';

describe('user roles model', () => {
  it('keeps the application authorization roles as the only editable roles', () => {
    expect(governedUserRoles).toEqual(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER']);
  });

  it('never lets an administrator disable or demote their own session account', () => {
    expect(canManageGovernedUser('current-user', 'current-user')).toBe(false);
    expect(canManageGovernedUser('current-user', 'another-user')).toBe(true);
  });

  it('uses clear Arabic role labels for all six roles', () => {
    expect(getRoleLabel('ADMIN')).toBe('مالك الشركة');
    expect(getRoleLabel('MANAGER')).toBe('مسؤول المكتب');
    expect(getRoleLabel('ACCOUNTANT')).toBe('محاسب');
    expect(getRoleLabel('OPERATIONS')).toBe('التشغيل');
    expect(getRoleLabel('USER')).toBe('مستخدم محدود');
    expect(getRoleLabel('VIEWER')).toBe('مشاهدة فقط');
    expect(getRoleLabel(null)).toBe('غير مهيأ');
    expect(getRoleLabel('UNKNOWN' as never)).toBe('غير مهيأ');
  });
});
