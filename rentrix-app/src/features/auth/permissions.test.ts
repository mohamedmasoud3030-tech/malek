import { describe, expect, it } from 'vitest';
import {
  appPermissions,
  canAccess,
  canAccessAny,
  canAccessRoute,
  canShowNavigationItem,
  financialOperationPermissions,
  getAuthorizationContextFromSession,
  getAuthorizationContextFromUser,
  getRoleFromAccessToken,
  getWriteAccessState,
  hasRole,
  normalizeRole,
  type AppPermission,
  type AuthorizationContext,
} from './permissions';

const userWithRole = (role: unknown) => ({
  id: 'user-1',
  email: 'user@example.com',
  app_metadata: { user_role: role },
});

const accessTokenWithRole = (role: unknown) => [
  'header',
  Buffer.from(JSON.stringify({ app_metadata: { user_role: role } })).toString('base64url'),
  'signature',
].join('.');

function resolved(role: AuthorizationContext['role'], permissions: readonly AppPermission[]): AuthorizationContext {
  return {
    userId: 'user-1',
    email: 'user@example.com',
    role,
    grantedPermissions: permissions,
    effectivePermissionsResolved: true,
  };
}

describe('canonical authorization permissions', () => {
  it('keeps all six historical roles as internal compatibility inputs', () => {
    for (const role of ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'] as const) {
      expect(normalizeRole(role.toLowerCase())).toBe(role);
      const context = getAuthorizationContextFromUser(userWithRole(role));
      expect(context?.role).toBe(role);
      expect(hasRole(context, role)).toBe(true);
    }
    expect(normalizeRole('OWNER')).toBeNull();
    expect(normalizeRole('EMPLOYEE')).toBeNull();
  });

  it('uses the server-issued access-token role before stale auth metadata', () => {
    const session = {
      user: { ...userWithRole('USER'), app_metadata: {} },
      access_token: accessTokenWithRole('ADMIN'),
    };
    expect(getRoleFromAccessToken(session.access_token)).toBe('ADMIN');
    expect(getAuthorizationContextFromSession(session as never)).toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'ADMIN',
    });
  });

  it('fails closed for malformed or unknown token roles', () => {
    expect(getRoleFromAccessToken('not-a-jwt')).toBeNull();
    expect(getRoleFromAccessToken(accessTokenWithRole('OWNER'))).toBeNull();
    expect(getAuthorizationContextFromUser(userWithRole('OWNER'))).toBeNull();
  });

  it('keeps ADMIN as the full-access compatibility role for the Office Owner', () => {
    const owner = getAuthorizationContextFromUser(userWithRole('ADMIN'));
    for (const permission of appPermissions) {
      expect(canAccess(owner, permission), permission).toBe(true);
    }
  });

  it('keeps legacy role defaults only until the authoritative effective set resolves', () => {
    const manager = getAuthorizationContextFromUser(userWithRole('MANAGER'));
    expect(canAccess(manager, 'properties.view')).toBe(true);
    expect(canAccess(manager, 'properties.write')).toBe(true);
    expect(canAccess(manager, 'contracts.view')).toBe(true);
    expect(canAccess(manager, 'financial.workspace.view')).toBe(true);
    expect(canAccess(manager, 'maintenance.write')).toBe(true);
    expect(canAccess(manager, 'users.manage')).toBe(false);
  });

  it('treats the resolved server capability set as authoritative even over a legacy MANAGER role', () => {
    const employee = resolved('MANAGER', ['app.dashboard.view', 'contracts.view']);
    expect(canAccess(employee, 'contracts.view')).toBe(true);
    expect(canAccess(employee, 'properties.view')).toBe(false);
    expect(canAccess(employee, 'properties.write')).toBe(false);
    expect(canAccess(employee, 'financial.workspace.view')).toBe(false);
    expect(canAccess(employee, 'maintenance.write')).toBe(false);
  });

  it('allows owner-approved capabilities to a historically minimal USER role', () => {
    const employee = resolved('USER', [
      'app.dashboard.view',
      'properties.view',
      'properties.write',
      'maintenance.view',
      'maintenance.write',
    ]);
    expect(canAccess(employee, 'properties.view')).toBe(true);
    expect(canAccess(employee, 'properties.write')).toBe(true);
    expect(canAccess(employee, 'maintenance.write')).toBe(true);
    expect(canAccess(employee, 'contracts.view')).toBe(false);
  });

  it('supports a collections-only employee without inventing a new role', () => {
    const employee = resolved('USER', [
      'app.dashboard.view',
      'financial.workspace.view',
      'financial.payments.create',
    ]);
    expect(canAccess(employee, 'financial.workspace.view')).toBe(true);
    expect(canAccess(employee, financialOperationPermissions.createPayment)).toBe(true);
    expect(canAccess(employee, 'financial.reports.view')).toBe(false);
    expect(canAccess(employee, 'expenses.write')).toBe(false);
  });

  it('supports a reports-only employee without exposing operational workspaces', () => {
    const employee = resolved('VIEWER', ['app.dashboard.view', 'financial.reports.view']);
    expect(canAccess(employee, 'financial.reports.view')).toBe(true);
    expect(canAccess(employee, 'financial.workspace.view')).toBe(false);
    expect(canAccess(employee, 'properties.view')).toBe(false);
    expect(canAccess(employee, 'contracts.view')).toBe(false);
    expect(canAccess(employee, 'maintenance.view')).toBe(false);
  });

  it('uses the same effective result for actions, routes and navigation', () => {
    const employee = resolved('OPERATIONS', ['app.dashboard.view', 'contracts.view', 'contracts.write']);
    expect(canAccess(employee, 'contracts.write')).toBe(true);
    expect(canAccessRoute(employee, 'contracts.write')).toBe(true);
    expect(canShowNavigationItem(employee, 'contracts.write')).toBe(true);
    expect(canAccessRoute(employee, 'properties.view')).toBe(false);
    expect(canShowNavigationItem(employee, 'properties.view')).toBe(false);
  });

  it('keeps auth-only navigation visible while permissioned navigation fails closed without context', () => {
    expect(canShowNavigationItem(null, undefined)).toBe(true);
    expect(canShowNavigationItem(null, 'properties.view')).toBe(false);
    expect(canAccessRoute(null, 'properties.view')).toBe(false);
  });

  it('calculates shell write posture from the same effective capability set', () => {
    expect(getWriteAccessState(resolved('USER', ['app.dashboard.view']))).toBe('read-only');
    expect(getWriteAccessState(resolved('USER', ['app.dashboard.view', 'properties.write']))).toBe('full');
    expect(getWriteAccessState(resolved('VIEWER', ['maintenance.write']))).toBe('full');
    expect(getWriteAccessState(null)).toBe('unconfigured');
  });

  it('keeps sensitive financial approvals separate from ordinary collection access', () => {
    const employee = resolved('USER', [
      'financial.workspace.view',
      'financial.payments.create',
      'financial.reports.view',
    ]);
    expect(canAccess(employee, financialOperationPermissions.createPayment)).toBe(true);
    expect(canAccess(employee, financialOperationPermissions.approveOwnerSettlement)).toBe(false);
    expect(canAccess(employee, financialOperationPermissions.payOwnerSettlement)).toBe(false);
    expect(canAccess(employee, financialOperationPermissions.voidReceipt)).toBe(false);
  });

  it('supports checking any capability without leaking unrelated defaults after resolution', () => {
    const employee = resolved('MANAGER', ['contracts.view']);
    expect(canAccessAny(employee, ['properties.view', 'contracts.view'])).toBe(true);
    expect(canAccessAny(employee, ['properties.view', 'maintenance.view'])).toBe(false);
  });
});
