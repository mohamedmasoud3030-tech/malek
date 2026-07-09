import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  canAccess,
  canAccessRoute,
  canShowNavigationItem,
  financialOperationPermissions,
  appPermissions,
  getAuthorizationContextFromUser,
  getAuthorizationDiagnosticsFromUser,
  hasRole,
  normalizeRole,
} from './permissions';

const sourcePath = fileURLToPath(new URL('./permissions.ts', import.meta.url));

const userWithRole = (role: unknown) => ({
  id: 'user-1',
  email: 'user@example.com',
  app_metadata: { user_role: role },
});

describe('canonical authorization permissions', () => {
  it('allows settings access for a known authorized role', () => {
    const context = getAuthorizationContextFromUser(userWithRole('ADMIN'));

    expect(context).toEqual({ userId: 'user-1', email: 'user@example.com', role: 'ADMIN' });
    expect(canAccess(context, 'settings.manage')).toBe(true);
    expect(canAccessRoute(context, 'settings.manage')).toBe(true);
    expect(canShowNavigationItem(context, 'settings.manage')).toBe(true);
  });

  it('denies settings access for a known unauthorized role', () => {
    const context = getAuthorizationContextFromUser(userWithRole('USER'));

    expect(context?.role).toBe('USER');
    expect(canAccess(context, 'settings.manage')).toBe(false);
    expect(canAccessRoute(context, 'settings.manage')).toBe(false);
  });

  it('keeps unrestricted navigation visible while permission checks fail closed without a role claim', () => {
    expect(getAuthorizationContextFromUser(null)).toBeNull();
    expect(canAccess(null, 'app.dashboard.view')).toBe(false);
    expect(canAccessRoute(null, 'app.dashboard.view')).toBe(false);
    expect(canShowNavigationItem(null, undefined)).toBe(true);
    expect(canShowNavigationItem(null, 'settings.manage')).toBe(false);
  });

  it('denies access when the role is unknown', () => {
    const context = getAuthorizationContextFromUser(userWithRole('OWNER'));

    expect(context).toBeNull();
    expect(normalizeRole('OWNER')).toBeNull();
    expect(canAccess(context, 'app.dashboard.view')).toBe(false);
  });

  it('checks explicit permissions without granting unrelated permissions', () => {
    const adminContext = getAuthorizationContextFromUser(userWithRole('ADMIN'));
    const managerContext = getAuthorizationContextFromUser(userWithRole('MANAGER'));
    const userContext = getAuthorizationContextFromUser(userWithRole('USER'));

    expect(canAccess(adminContext, 'app.dashboard.view')).toBe(true);
    expect(canAccess(adminContext, 'audit.view')).toBe(true);
    expect(canAccess(adminContext, 'integrity.view')).toBe(true);
    expect(canAccess(adminContext, 'maintenance.view')).toBe(true);
    expect(canAccess(adminContext, 'system.view')).toBe(true);
    expect(canAccess(adminContext, 'auth.password.change')).toBe(true);
    expect(canAccess(adminContext, 'owners.hub.view')).toBe(true);
    expect(canAccess(adminContext, 'owners.detail.view')).toBe(true);
    expect(canAccess(adminContext, 'lands.view')).toBe(true);
    expect(canAccess(adminContext, 'leads.view')).toBe(true);
    expect(canAccess(adminContext, 'commissions.view')).toBe(true);
    expect(canAccess(adminContext, 'communication.view')).toBe(true);
    expect(canAccess(managerContext, 'system.view')).toBe(false);
    expect(canAccess(managerContext, 'integrity.view')).toBe(false);
    expect(canAccess(managerContext, 'maintenance.view')).toBe(false);
    expect(canAccess(managerContext, 'owners.hub.view')).toBe(true);
    expect(canAccess(managerContext, 'owners.detail.view')).toBe(true);
    expect(canAccess(managerContext, 'lands.view')).toBe(true);
    expect(canAccess(managerContext, 'leads.view')).toBe(true);
    expect(canAccess(managerContext, 'commissions.view')).toBe(true);
    expect(canAccess(managerContext, 'communication.view')).toBe(true);
    expect(canAccess(managerContext, 'audit.view')).toBe(false);
    expect(canAccess(userContext, 'app.dashboard.view')).toBe(true);
    expect(canAccess(userContext, 'auth.password.change')).toBe(true);
    expect(canAccess(userContext, 'system.view')).toBe(false);
    expect(canAccess(userContext, 'maintenance.view')).toBe(false);
    expect(canAccess(userContext, 'owners.hub.view')).toBe(false);
    expect(canAccess(userContext, 'leads.view')).toBe(false);
    expect(canAccess(userContext, 'settings.manage')).toBe(false);
  });


  it('enforces explicit financial operation permissions by role', () => {
    const adminContext = getAuthorizationContextFromUser(userWithRole('ADMIN'));
    const managerContext = getAuthorizationContextFromUser(userWithRole('MANAGER'));
    const userContext = getAuthorizationContextFromUser(userWithRole('USER'));
    const allFinancialPermissions = Object.values(financialOperationPermissions);

    expect(allFinancialPermissions.every((permission) => appPermissions.includes(permission))).toBe(true);
    expect(allFinancialPermissions.every((permission) => canAccess(adminContext, permission))).toBe(true);

    expect(canAccess(managerContext, financialOperationPermissions.generateInvoices)).toBe(true);
    expect(canAccess(managerContext, financialOperationPermissions.exportInvoices)).toBe(true);
    expect(canAccess(managerContext, financialOperationPermissions.createPayment)).toBe(true);
    expect(canAccess(managerContext, financialOperationPermissions.voidReceipt)).toBe(true);
    expect(canAccess(managerContext, financialOperationPermissions.exportReports)).toBe(true);
    expect(canAccess(managerContext, financialOperationPermissions.matchBankReconciliation)).toBe(true);
    expect(canAccess(managerContext, financialOperationPermissions.approveOwnerSettlement)).toBe(false);
    expect(canAccess(managerContext, financialOperationPermissions.payOwnerSettlement)).toBe(false);

    expect(allFinancialPermissions.every((permission) => !canAccess(userContext, permission))).toBe(true);
  });

  it('normalizes roles safely', () => {
    const context = getAuthorizationContextFromUser(userWithRole(' manager '));

    expect(normalizeRole(' admin ')).toBe('ADMIN');
    expect(normalizeRole('user')).toBe('USER');
    expect(context?.role).toBe('MANAGER');
    expect(hasRole(context, 'MANAGER')).toBe(true);
  });

  it('fails closed for malformed users and metadata', () => {
    expect(getAuthorizationContextFromUser(userWithRole(null))).toBeNull();
    expect(getAuthorizationContextFromUser({ ...userWithRole('ADMIN'), id: '' })).toBeNull();
    expect(normalizeRole(undefined)).toBeNull();
  });

  it('reports safe authorization diagnostics without granting missing role metadata', () => {
    const diagnostics = getAuthorizationDiagnosticsFromUser({
      id: 'user-1',
      email: 'admin@example.com',
      app_metadata: {},
    });

    expect(getAuthorizationContextFromUser({ id: 'user-1', email: 'admin@example.com', app_metadata: {} })).toBeNull();
    expect(diagnostics).toEqual({
      resolvedRole: null,
      hasUserRoleMetadata: false,
      hasRoleMetadata: false,
      metadataMismatch: true,
    });
  });

  it('reports which accepted app metadata role field resolved authorization', () => {
    expect(getAuthorizationDiagnosticsFromUser(userWithRole('ADMIN'))).toEqual({
      resolvedRole: 'ADMIN',
      hasUserRoleMetadata: true,
      hasRoleMetadata: false,
      metadataMismatch: false,
    });

    expect(
      getAuthorizationDiagnosticsFromUser({
        id: 'user-1',
        email: 'admin@example.com',
        app_metadata: { role: 'ADMIN' },
      }),
    ).toEqual({
      resolvedRole: 'ADMIN',
      hasUserRoleMetadata: false,
      hasRoleMetadata: true,
      metadataMismatch: false,
    });
  });

  it('does not depend on historical AppContext or React Router', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).not.toContain('AppContext');
    expect(source).not.toContain('useApp');
    expect(source).not.toContain('react-router-dom');
    expect(source).not.toContain('@tanstack/react-router');
  });

  it('does not perform Supabase client writes or queries', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).not.toContain('@/integrations/supabase');
    expect(source).not.toMatch(/\.(from|insert|update|upsert|delete|rpc)\s*\(/);
  });
});
