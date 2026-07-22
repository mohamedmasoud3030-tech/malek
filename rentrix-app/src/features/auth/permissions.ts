import type { Session, User } from '@supabase/supabase-js';

export const authorizationRoles = ['ADMIN', 'MANAGER', 'USER'] as const;

export type AuthorizationRole = (typeof authorizationRoles)[number];

export const appPermissions = [
  'app.dashboard.view',
  'audit.view',
  'integrity.view',
  'maintenance.view',
  'system.view',
  'owners.hub.view',
  'owners.detail.view',
  'lands.view',
  'leads.view',
  'commissions.view',
  'communication.view',
  'automation.view',
  'auth.password.change',
  'settings.manage',
  'properties.write',
  'contracts.write',
  'expenses.view',
  'expenses.write',
  'arrears.view',
  'financial.deposits.view',
  'financial.invoices.generate',
  'financial.invoices.export',
  'financial.payments.create',
  'financial.receipts.void',
  'financial.reports.export',
  'financial.bank_reconciliation.view',
  'financial.bank_reconciliation.match',
  'financial.owner_settlements.view',
  'financial.owner_settlements.approve',
  'financial.owner_settlements.pay',
] as const;

export type AppPermission = (typeof appPermissions)[number];

export const financialOperationPermissions = {
  generateInvoices: 'financial.invoices.generate',
  exportInvoices: 'financial.invoices.export',
  createPayment: 'financial.payments.create',
  voidReceipt: 'financial.receipts.void',
  exportReports: 'financial.reports.export',
  matchBankReconciliation: 'financial.bank_reconciliation.match',
  approveOwnerSettlement: 'financial.owner_settlements.approve',
  payOwnerSettlement: 'financial.owner_settlements.pay',
} as const satisfies Record<string, AppPermission>;

export type AuthorizationContext = Readonly<{
  userId: string;
  email: string | null;
  role: AuthorizationRole;
}>;

export type AuthorizationDiagnostics = Readonly<{
  resolvedRole: AuthorizationRole | null;
  hasUserRoleMetadata: boolean;
  hasRoleMetadata: boolean;
  metadataMismatch: boolean;
}>;

type AuthorizationUserLike = Pick<User, 'id' | 'email' | 'app_metadata'>;

const knownRoles = new Set<string>(authorizationRoles);

const rolePermissions = {
  ADMIN: new Set<AppPermission>([
    'app.dashboard.view',
    'audit.view',
    'integrity.view',
    'maintenance.view',
    'system.view',
    'owners.hub.view',
    'owners.detail.view',
    'lands.view',
    'leads.view',
    'commissions.view',
    'communication.view',
    'automation.view',
    'auth.password.change',
    'settings.manage',
    'properties.write',
    'contracts.write',
    'expenses.view',
    'expenses.write',
    'arrears.view',
    'financial.deposits.view',
    'financial.invoices.generate',
    'financial.invoices.export',
    'financial.payments.create',
    'financial.receipts.void',
    'financial.reports.export',
    'financial.bank_reconciliation.view',
    'financial.bank_reconciliation.match',
    'financial.owner_settlements.view',
    'financial.owner_settlements.approve',
    'financial.owner_settlements.pay',
  ]),
  MANAGER: new Set<AppPermission>([
    'app.dashboard.view',
    'maintenance.view',
    'owners.hub.view',
    'owners.detail.view',
    'lands.view',
    'leads.view',
    'commissions.view',
    'communication.view',
    'automation.view',
    'auth.password.change',
    'settings.manage',
    'properties.write',
    'contracts.write',
    'expenses.view',
    'expenses.write',
    'arrears.view',
    'financial.deposits.view',
    'financial.invoices.generate',
    'financial.invoices.export',
    'financial.payments.create',
    'financial.receipts.void',
    'financial.reports.export',
    'financial.bank_reconciliation.view',
    'financial.bank_reconciliation.match',
    'financial.owner_settlements.view',
  ]),
  USER: new Set<AppPermission>(['app.dashboard.view', 'auth.password.change']),
} satisfies Record<AuthorizationRole, ReadonlySet<AppPermission>>;

export function normalizeRole(role: unknown): AuthorizationRole | null {
  if (typeof role !== 'string') return null;

  const normalizedRole = role.trim().toUpperCase();
  return knownRoles.has(normalizedRole) ? (normalizedRole as AuthorizationRole) : null;
}

export function getRoleFromUser(user: AuthorizationUserLike | null | undefined): AuthorizationRole | null {
  return normalizeRole(user?.app_metadata?.user_role ?? user?.app_metadata?.role);
}

export function getAuthorizationDiagnosticsFromUser(user: AuthorizationUserLike | null | undefined): AuthorizationDiagnostics {
  const userRole = user?.app_metadata?.user_role;
  const role = user?.app_metadata?.role;
  const resolvedRole = getRoleFromUser(user);

  return {
    resolvedRole,
    hasUserRoleMetadata: userRole !== undefined && userRole !== null,
    hasRoleMetadata: role !== undefined && role !== null,
    metadataMismatch: Boolean(user?.id) && !resolvedRole,
  };
}

export function getAuthorizationDiagnosticsFromSession(session: Pick<Session, 'user'> | null | undefined): AuthorizationDiagnostics {
  return getAuthorizationDiagnosticsFromUser(session?.user);
}

export function getAuthorizationContextFromUser(user: AuthorizationUserLike | null | undefined): AuthorizationContext | null {
  const role = getRoleFromUser(user);
  if (!user?.id || !role) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    role,
  };
}

export function getAuthorizationContextFromSession(session: Pick<Session, 'user'> | null | undefined): AuthorizationContext | null {
  return getAuthorizationContextFromUser(session?.user);
}

export function hasRole(context: AuthorizationContext | null | undefined, role: AuthorizationRole): boolean {
  return context?.role === role;
}

export function canAccess(context: AuthorizationContext | null | undefined, permission: AppPermission): boolean {
  if (!context) return false;

  return rolePermissions[context.role]?.has(permission) ?? false;
}

export function canAccessAny(context: AuthorizationContext | null | undefined, permissions: readonly AppPermission[]): boolean {
  return permissions.some((permission) => canAccess(context, permission));
}

export function canAccessRoute(context: AuthorizationContext | null | undefined, permission: AppPermission | null | undefined): boolean {
  return permission ? canAccess(context, permission) : Boolean(context);
}

export type WriteAccessState = 'full' | 'read-only' | 'unconfigured';

export function getWriteAccessState(
  context: AuthorizationContext | null | undefined,
): WriteAccessState {
  if (!context) return 'unconfigured';
  return context.role === 'USER' ? 'read-only' : 'full';
}

export function canShowNavigationItem(context: AuthorizationContext | null | undefined, permission: AppPermission | null | undefined): boolean {
  return permission ? canAccess(context, permission) : true;
}
