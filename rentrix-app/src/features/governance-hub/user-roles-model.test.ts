import { describe, expect, it } from 'vitest';
import {
  canManageGovernedUser,
  getOfficePersona,
  getRoleLabel,
  governedUserRoles,
} from './user-roles-model';

describe('user roles model', () => {
  it('keeps six authorization roles internally for compatibility', () => {
    expect(governedUserRoles).toEqual(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER']);
  });

  it('never lets the current operator mutate their own account', () => {
    expect(canManageGovernedUser('current-user', 'current-user')).toBe(false);
    expect(canManageGovernedUser('current-user', 'another-user')).toBe(true);
  });

  it('collapses every internal role into the two routine office personas', () => {
    expect(getOfficePersona('ADMIN')).toBe('OWNER');
    for (const role of ['MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'] as const) {
      expect(getOfficePersona(role)).toBe('EMPLOYEE');
    }
    expect(getOfficePersona(null)).toBeNull();
  });

  it('never leaks the six-role taxonomy into business-facing labels', () => {
    expect(getRoleLabel('ADMIN')).toBe('صاحب المكتب');
    for (const role of ['MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'] as const) {
      expect(getRoleLabel(role)).toBe('موظف');
    }
    expect(getRoleLabel(null)).toBe('غير مهيأ');
    expect(getRoleLabel('UNKNOWN' as never)).toBe('غير مهيأ');
  });
});
