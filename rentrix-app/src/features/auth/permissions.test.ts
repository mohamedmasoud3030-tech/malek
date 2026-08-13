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
  getWriteAccessState,
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
    expect(canAccess(adminContext, 'service_providers.view')).toBe(true);
    expect(canAccess(adminContext, 'service_providers.write')).toBe(true);
    expect(canAccess(adminContext, 'system.view')).toBe(true);
    expect(canAccess(adminContext, 'auth.password.change')).toBe(true);
    expect(canAccess(adminContext, 'owners.hub.view')).toBe(true);
    expect(canAccess(adminContext, 'owners.detail.view')).toBe(true);
    expect(canAccess(adminContext, 'lands.view')).toBe(true);
    expect(canAccess(adminContext, 'leads.view')).toBe(true);
    expect(canAccess(adminContext, 'commissions.view')).toBe(true);
    expect(canAccess(adminContext, 'communication.view')).toBe(true);
    expect(canAccess(adminContext, 'properties.write')).toBe(true);
    expect(canAccess(adminContext, 'contracts.write')).toBe(true);
    expect(canAccess(adminContext, 'expenses.write')).toBe(true);
    expect(canAccess(adminContext, 'arrears.view')).toBe(true);
    expect(canAccess(adminContext, 'financial.bank_reconciliation.view')).toBe(true);
    expect(canAccess(managerContext, 'system.view')).toBe(false);
    expect(canAccess(managerContext, 'settings.manage')).toBe(false);
    expect(canAccess(managerContext, 'company.settings.manage')).toBe(false);
    expect(canAccess(managerContext, 'users.manage')).toBe(false);
    expect(canAccess(managerContext, 'permission_requests.review')).toBe(true);
    expect(canAccess(managerContext, 'integrity.view')).toBe(false);
    expect(canAccess(managerContext, 'maintenance.view')).toBe(true);
    expect(canAccess(managerContext, 'service_providers.view')).toBe(true);
    expect(canAccess(managerContext, 'service_providers.write')).toBe(true);
    expect(canAccess(managerContext, 'owners.hub.view')).toBe(true);
    expect(canAccess(managerContext, 'properties.write')).toBe(true);
    expect(canAccess(managerContext, 'contracts.write')).toBe(true);
    expect(canAccess(managerContext, 'expenses.write')).toBe(true);
    expect(canAccess(managerContext, 'arrears.view')).toBe(true);
    expect(canAccess(managerContext, 'financial.bank_reconciliation.view')).toBe(true);
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
    expect(canAccess(userContext, 'service_providers.view')).toBe(false);
    expect(canAccess(userContext, 'service_providers.write')).toBe(false);
    expect(canAccess(userContext, 'owners.hub.view')).toBe(false);
    expect(canAccess(userContext, 'leads.view')).toBe(false);
    expect(canAccess(userContext, 'settings.manage')).toBe(false);
    expect(canAccess(userContext, 'properties.write')).toBe(false);
    expect(canAccess(userContext, 'contracts.write')).toBe(false);
    expect(canAccess(userContext, 'expenses.write')).toBe(false);
    expect(canAccess(userContext, 'arrears.view')).toBe(false);
    expect(canAccess(userContext, 'financial.bank_reconciliation.view')).toBe(false);
  });

  it('grants dedicated view permissions for guarded workspaces', () => {
    const adminContext = getAuthorizationContextFromUser(userWithRole('ADMIN'));
    const managerContext = getAuthorizationContextFromUser(userWithRole('MANAGER'));
    const userContext = getAuthorizationContextFromUser(userWithRole('USER'));
    const workspaceViewPermissions = [
      'automation.view',
      'expenses.view',
      'financial.deposits.view',
      'financial.owner_settlements.view',
    ] as const;

    for (const permission of workspaceViewPermissions) {
      expect(appPermissions.includes(permission)).toBe(true);
      expect(canAccess(adminContext, permission)).toBe(true);
      expect(canAccess(managerContext, permission)).toBe(true);
      expect(canAccess(userContext, permission)).toBe(false);
    }

    // Settlement approval/payout remain a restricted financial control.
    expect(canAccess(managerContext, 'financial.owner_settlements.approve')).toBe(false);
    expect(canAccess(managerContext, 'financial.owner_settlements.pay')).toBe(false);
    expect(canAccess(adminContext, 'financial.owner_settlements.approve')).toBe(true);
    expect(canAccess(adminContext, 'financial.owner_settlements.pay')).toBe(true);
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

  it('exposes a clear write-access state for the shared app shell', () => {
    expect(getWriteAccessState(getAuthorizationContextFromUser(userWithRole('ADMIN')))).toBe('full');
    expect(getWriteAccessState(getAuthorizationContextFromUser(userWithRole('MANAGER')))).toBe('full');
    expect(getWriteAccessState(getAuthorizationContextFromUser(userWithRole('USER')))).toBe('read-only');
    expect(getWriteAccessState(null)).toBe('unconfigured');
  });

  it('uses effective grants for shell write posture while retaining action-level gates', () => {
    const approvedWriter = {
      ...getAuthorizationContextFromUser(userWithRole('USER'))!,
      grantedPermissions: ['properties.write'] as const,
    };
    const readOnlyUser = getAuthorizationContextFromUser(userWithRole('USER'));

    expect(getWriteAccessState(approvedWriter)).toBe('full');
    expect(canAccessRoute(approvedWriter, 'properties.write')).toBe(true);
    expect(canShowNavigationItem(approvedWriter, 'properties.write')).toBe(true);
    expect(canAccess(approvedWriter, 'contracts.write')).toBe(false);
    expect(getWriteAccessState(readOnlyUser)).toBe('read-only');
    expect(canAccessRoute(readOnlyUser, 'properties.write')).toBe(false);
  });

  it('recognizes all six canonical roles', () => {
    for (const role of ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'] as const) {
      const context = getAuthorizationContextFromUser(userWithRole(role));
      expect(context?.role).toBe(role);
      expect(hasRole(context, role)).toBe(true);
    }
  });

  it('enforces ACCOUNTANT capability matrix', () => {
    const ctx = getAuthorizationContextFromUser(userWithRole('ACCOUNTANT'));
    expect(ctx?.role).toBe('ACCOUNTANT');

    // Has financial review/accounting permissions.
    expect(canAccess(ctx, 'app.dashboard.view')).toBe(true);
    expect(canAccess(ctx, 'audit.view')).toBe(true);
    expect(canAccess(ctx, 'expenses.view')).toBe(true);
    expect(canAccess(ctx, 'arrears.view')).toBe(true);
    expect(canAccess(ctx, 'financial.deposits.view')).toBe(true);
    expect(canAccess(ctx, 'financial.invoices.generate')).toBe(true);
    expect(canAccess(ctx, 'financial.invoices.export')).toBe(true);
    expect(canAccess(ctx, 'financial.reports.export')).toBe(true);
    expect(canAccess(ctx, 'financial.bank_reconciliation.view')).toBe(true);
    expect(canAccess(ctx, 'financial.bank_reconciliation.match')).toBe(true);
    expect(canAccess(ctx, 'financial.owner_settlements.view')).toBe(true);
    expect(canAccess(ctx, 'financial.fixed_monthly_accruals.view')).toBe(true);
    expect(canAccess(ctx, 'financial.fixed_monthly_accruals.execute')).toBe(true);
    expect(canAccess(ctx, 'financial.fixed_monthly_accruals.reverse')).toBe(true);
    expect(canAccess(ctx, 'auth.password.change')).toBe(true);

    // Does NOT have operational/approval/admin permissions.
    expect(canAccess(ctx, 'properties.write')).toBe(false);
    expect(canAccess(ctx, 'contracts.write')).toBe(false);
    expect(canAccess(ctx, 'expenses.write')).toBe(false);
    expect(canAccess(ctx, 'users.manage')).toBe(false);
    expect(canAccess(ctx, 'company.settings.manage')).toBe(false);
    expect(canAccess(ctx, 'system.view')).toBe(false);
    expect(canAccess(ctx, 'integrity.view')).toBe(false);
    expect(canAccess(ctx, 'financial.payments.create')).toBe(false);
    expect(canAccess(ctx, 'financial.receipts.void')).toBe(false);
    expect(canAccess(ctx, 'financial.owner_settlements.approve')).toBe(false);
    expect(canAccess(ctx, 'financial.owner_settlements.pay')).toBe(false);
    expect(canAccess(ctx, 'settings.manage')).toBe(false);
  });

  it('enforces OPERATIONS capability matrix', () => {
    const ctx = getAuthorizationContextFromUser(userWithRole('OPERATIONS'));
    expect(ctx?.role).toBe('OPERATIONS');

    // Has operational permissions.
    expect(canAccess(ctx, 'app.dashboard.view')).toBe(true);
    expect(canAccess(ctx, 'maintenance.view')).toBe(true);
    expect(canAccess(ctx, 'service_providers.view')).toBe(true);
    expect(canAccess(ctx, 'service_providers.write')).toBe(true);
    expect(canAccess(ctx, 'cost_centers.manage')).toBe(true);
    expect(canAccess(ctx, 'documents.write')).toBe(true);
    expect(canAccess(ctx, 'owners.hub.view')).toBe(true);
    expect(canAccess(ctx, 'owners.detail.view')).toBe(true);
    expect(canAccess(ctx, 'lands.view')).toBe(true);
    expect(canAccess(ctx, 'leads.view')).toBe(true);
    expect(canAccess(ctx, 'communication.view')).toBe(true);
    expect(canAccess(ctx, 'automation.view')).toBe(true);
    expect(canAccess(ctx, 'auth.password.change')).toBe(true);
    expect(canAccess(ctx, 'properties.write')).toBe(true);
    expect(canAccess(ctx, 'contracts.write')).toBe(true);
    expect(canAccess(ctx, 'expenses.view')).toBe(true);
    expect(canAccess(ctx, 'expenses.write')).toBe(true);
    expect(canAccess(ctx, 'arrears.view')).toBe(true);

    // Does NOT have financial/approval/admin permissions.
    expect(canAccess(ctx, 'financial.payments.create')).toBe(false);
    expect(canAccess(ctx, 'financial.receipts.void')).toBe(false);
    expect(canAccess(ctx, 'financial.owner_settlements.approve')).toBe(false);
    expect(canAccess(ctx, 'financial.owner_settlements.pay')).toBe(false);
    expect(canAccess(ctx, 'users.manage')).toBe(false);
    expect(canAccess(ctx, 'company.settings.manage')).toBe(false);
    expect(canAccess(ctx, 'system.view')).toBe(false);
    expect(canAccess(ctx, 'audit.view')).toBe(false);
    expect(canAccess(ctx, 'integrity.view')).toBe(false);
    expect(canAccess(ctx, 'permission_requests.review')).toBe(false);
    expect(canAccess(ctx, 'settings.manage')).toBe(false);
  });

  it('enforces VIEWER capability matrix', () => {
    const ctx = getAuthorizationContextFromUser(userWithRole('VIEWER'));
    expect(ctx?.role).toBe('VIEWER');

    // Has read-only view permissions.
    expect(canAccess(ctx, 'app.dashboard.view')).toBe(true);
    expect(canAccess(ctx, 'maintenance.view')).toBe(true);
    expect(canAccess(ctx, 'service_providers.view')).toBe(true);
    expect(canAccess(ctx, 'owners.hub.view')).toBe(true);
    expect(canAccess(ctx, 'owners.detail.view')).toBe(true);
    expect(canAccess(ctx, 'lands.view')).toBe(true);
    expect(canAccess(ctx, 'leads.view')).toBe(true);
    expect(canAccess(ctx, 'commissions.view')).toBe(true);
    expect(canAccess(ctx, 'communication.view')).toBe(true);
    expect(canAccess(ctx, 'automation.view')).toBe(true);
    expect(canAccess(ctx, 'expenses.view')).toBe(true);
    expect(canAccess(ctx, 'arrears.view')).toBe(true);
    expect(canAccess(ctx, 'financial.deposits.view')).toBe(true);
    expect(canAccess(ctx, 'financial.owner_settlements.view')).toBe(true);
    expect(canAccess(ctx, 'financial.bank_reconciliation.view')).toBe(true);
    expect(canAccess(ctx, 'auth.password.change')).toBe(true);

    // Does NOT have any write permissions.
    expect(canAccess(ctx, 'properties.write')).toBe(false);
    expect(canAccess(ctx, 'contracts.write')).toBe(false);
    expect(canAccess(ctx, 'expenses.write')).toBe(false);
    expect(canAccess(ctx, 'documents.write')).toBe(false);
    expect(canAccess(ctx, 'service_providers.write')).toBe(false);
    expect(canAccess(ctx, 'financial.payments.create')).toBe(false);
    expect(canAccess(ctx, 'financial.receipts.void')).toBe(false);
    expect(canAccess(ctx, 'financial.owner_settlements.approve')).toBe(false);
    expect(canAccess(ctx, 'financial.owner_settlements.pay')).toBe(false);
    expect(canAccess(ctx, 'users.manage')).toBe(false);
    expect(canAccess(ctx, 'company.settings.manage')).toBe(false);
    expect(canAccess(ctx, 'system.view')).toBe(false);
    expect(canAccess(ctx, 'audit.view')).toBe(false);
    expect(canAccess(ctx, 'integrity.view')).toBe(false);
    expect(canAccess(ctx, 'permission_requests.review')).toBe(false);
    expect(canAccess(ctx, 'settings.manage')).toBe(false);
  });

  it('reports VIEWER and OPERATIONS as read-only shell write posture', () => {
    expect(getWriteAccessState(getAuthorizationContextFromUser(userWithRole('VIEWER')))).toBe('read-only');
    expect(getWriteAccessState(getAuthorizationContextFromUser(userWithRole('OPERATIONS')))).toBe('full');
    expect(getWriteAccessState(getAuthorizationContextFromUser(userWithRole('ACCOUNTANT')))).toBe('full');
  });

  it('normalizes roles safely', () => {
    const context = getAuthorizationContextFromUser(userWithRole(' manager '));

    expect(normalizeRole(' admin ')).toBe('ADMIN');
    expect(normalizeRole('user')).toBe('USER');
    expect(normalizeRole('accountant')).toBe('ACCOUNTANT');
    expect(normalizeRole('operations')).toBe('OPERATIONS');
    expect(normalizeRole('viewer')).toBe('VIEWER');
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
