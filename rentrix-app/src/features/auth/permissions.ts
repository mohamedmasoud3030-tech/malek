import type { Session, User } from '@supabase/supabase-js';

export const authorizationRoles = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'] as const;

export type AuthorizationRole = (typeof authorizationRoles)[number];

export const appPermissions = [
  'app.dashboard.view',
  'audit.view',
  'integrity.view',
  'maintenance.view',
  'service_providers.view',
  'service_providers.write',
  'system.view',
  'users.manage',
  'permission_requests.review',
  'support.operations.view',
  'support.requests.triage',
  'support.user_lookup.view',
  'company.settings.manage',
  'cost_centers.manage',
  'documents.write',
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
  'financial.reports.view',
  'financial.reports.export',
  'financial.bank_reconciliation.view',
  'financial.bank_reconciliation.match',
  'financial.owner_settlements.view',
  'financial.owner_settlements.approve',
  'financial.owner_settlements.pay',
  'financial.fixed_monthly_accruals.view',
  'financial.fixed_monthly_accruals.execute',
  'financial.fixed_monthly_accruals.reverse',
] as const;

export type AppPermission = (typeof appPermissions)[number];

export const permissionLabelsAr: Readonly<Record<AppPermission, string>> = {
  'app.dashboard.view': 'عرض لوحة التحكم',
  'audit.view': 'عرض سجل التدقيق',
  'integrity.view': 'عرض سلامة البيانات',
  'maintenance.view': 'عرض الصيانة',
  'service_providers.view': 'عرض مزودي الخدمات',
  'service_providers.write': 'إضافة وتعديل وأرشفة مزودي الخدمات',
  'system.view': 'عرض إعدادات النظام والحوكمة',
  'users.manage': 'إدارة المستخدمين والأدوار',
  'permission_requests.review': 'مراجعة طلبات الصلاحية',
  'support.operations.view': 'عرض عمليات الدعم',
  'support.requests.triage': 'فرز طلبات الدعم',
  'support.user_lookup.view': 'عرض بحث المستخدمين المقنّع',
  'company.settings.manage': 'إدارة إعدادات الشركة',
  'cost_centers.manage': 'إدارة مراكز التكلفة',
  'documents.write': 'رفع واستبدال وأرشفة المستندات',
  'owners.hub.view': 'عرض سجل الملاك',
  'owners.detail.view': 'عرض ملف المالك',
  'lands.view': 'عرض الأراضي',
  'leads.view': 'عرض العملاء المحتملين',
  'commissions.view': 'عرض العمولات',
  'communication.view': 'عرض التواصل والمتابعات',
  'automation.view': 'عرض الأتمتة',
  'auth.password.change': 'تغيير كلمة المرور',
  'settings.manage': 'إدارة الإعدادات (توافق قديم)',
  'properties.write': 'إضافة وتعديل العقارات',
  'contracts.write': 'إضافة وتعديل العقود',
  'expenses.view': 'عرض المصروفات',
  'expenses.write': 'إضافة وتعديل المصروفات',
  'arrears.view': 'عرض المتأخرات',
  'financial.deposits.view': 'عرض التأمينات',
  'financial.invoices.generate': 'إنشاء الفواتير',
  'financial.invoices.export': 'تصدير الفواتير',
  'financial.payments.create': 'تسجيل التحصيلات',
  'financial.receipts.void': 'إلغاء الإيصالات',
  'financial.reports.view': 'عرض التقارير المالية',
  'financial.reports.export': 'تصدير التقارير المالية',
  'financial.bank_reconciliation.view': 'عرض المطابقة البنكية',
  'financial.bank_reconciliation.match': 'تنفيذ المطابقة البنكية',
  'financial.owner_settlements.view': 'عرض تسويات الملاك',
  'financial.owner_settlements.approve': 'اعتماد تسويات الملاك',
  'financial.owner_settlements.pay': 'صرف تسويات الملاك',
  'financial.fixed_monthly_accruals.view': 'عرض الاستحقاقات اليومية للعمولة الشهرية',
  'financial.fixed_monthly_accruals.execute': 'تنفيذ الاستحقاقات اليومية للعمولة الشهرية',
  'financial.fixed_monthly_accruals.reverse': 'عكس استحقاق يومي للعمولة الشهرية',
};

export function getPermissionLabel(permission: AppPermission): string {
  return permissionLabelsAr[permission];
}

export const financialOperationPermissions = {
  generateInvoices: 'financial.invoices.generate',
  exportInvoices: 'financial.invoices.export',
  createPayment: 'financial.payments.create',
  voidReceipt: 'financial.receipts.void',
  viewReports: 'financial.reports.view',
  exportReports: 'financial.reports.export',
  matchBankReconciliation: 'financial.bank_reconciliation.match',
  approveOwnerSettlement: 'financial.owner_settlements.approve',
  payOwnerSettlement: 'financial.owner_settlements.pay',
  executeFixedMonthlyAccruals: 'financial.fixed_monthly_accruals.execute',
  reverseFixedMonthlyAccrual: 'financial.fixed_monthly_accruals.reverse',
} as const satisfies Record<string, AppPermission>;

export type AuthorizationContext = Readonly<{
  userId: string;
  email: string | null;
  role: AuthorizationRole;
  grantedPermissions?: readonly AppPermission[];
}>;

export type AuthorizationDiagnostics = Readonly<{
  resolvedRole: AuthorizationRole | null;
  hasUserRoleMetadata: boolean;
  hasRoleMetadata: boolean;
  metadataMismatch: boolean;
}>;

type AuthorizationUserLike = Pick<User, 'id' | 'email' | 'app_metadata'>;
type AuthorizationSessionLike = Pick<Session, 'user' | 'access_token'>;

const knownRoles = new Set<string>(authorizationRoles);

const rolePermissions = {
  ADMIN: new Set<AppPermission>([
    'app.dashboard.view',
    'audit.view',
    'integrity.view',
    'maintenance.view',
    'service_providers.view',
    'service_providers.write',
    'system.view',
    'users.manage',
    'permission_requests.review',
    'support.operations.view',
    'support.requests.triage',
    'support.user_lookup.view',
    'company.settings.manage',
    'cost_centers.manage',
    'documents.write',
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
    'financial.reports.view',
  'financial.reports.export',
    'financial.bank_reconciliation.view',
    'financial.bank_reconciliation.match',
    'financial.owner_settlements.view',
    'financial.owner_settlements.approve',
    'financial.owner_settlements.pay',
    'financial.fixed_monthly_accruals.view',
    'financial.fixed_monthly_accruals.execute',
    'financial.fixed_monthly_accruals.reverse',
  ]),
  MANAGER: new Set<AppPermission>([
    'app.dashboard.view',
    'maintenance.view',
    'service_providers.view',
    'service_providers.write',
    'permission_requests.review',
    'support.operations.view',
    'support.requests.triage',
    'cost_centers.manage',
    'documents.write',
    'owners.hub.view',
    'owners.detail.view',
    'lands.view',
    'leads.view',
    'commissions.view',
    'communication.view',
    'automation.view',
    'auth.password.change',
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
    'financial.reports.view',
  'financial.reports.export',
    'financial.bank_reconciliation.view',
    'financial.bank_reconciliation.match',
    'financial.owner_settlements.view',
    'financial.fixed_monthly_accruals.view',
    'financial.fixed_monthly_accruals.execute',
    'financial.fixed_monthly_accruals.reverse',
  ]),
  ACCOUNTANT: new Set<AppPermission>([
    'app.dashboard.view',
    'audit.view',
    'expenses.view',
    'arrears.view',
    'financial.deposits.view',
    'financial.invoices.generate',
    'financial.invoices.export',
    'financial.reports.view',
  'financial.reports.export',
    'financial.bank_reconciliation.view',
    'financial.bank_reconciliation.match',
    'financial.owner_settlements.view',
    'financial.fixed_monthly_accruals.view',
    'financial.fixed_monthly_accruals.execute',
    'financial.fixed_monthly_accruals.reverse',
    'auth.password.change',
  ]),
  OPERATIONS: new Set<AppPermission>([
    'app.dashboard.view',
    'maintenance.view',
    'service_providers.view',
    'service_providers.write',
    'cost_centers.manage',
    'owners.hub.view',
    'owners.detail.view',
    'lands.view',
    'leads.view',
    'communication.view',
    'automation.view',
    'auth.password.change',
    'expenses.view',
    'arrears.view',
  ]),
  USER: new Set<AppPermission>(['app.dashboard.view', 'auth.password.change']),
  VIEWER: new Set<AppPermission>([
    'app.dashboard.view',
    'financial.reports.view',
    'maintenance.view',
    'service_providers.view',
    'owners.hub.view',
    'owners.detail.view',
    'lands.view',
    'leads.view',
    'commissions.view',
    'communication.view',
    'automation.view',
    'expenses.view',
    'arrears.view',
    'financial.deposits.view',
    'financial.owner_settlements.view',
    'financial.bank_reconciliation.view',
    'auth.password.change',
  ]),
} satisfies Record<AuthorizationRole, ReadonlySet<AppPermission>>;

export function normalizeRole(role: unknown): AuthorizationRole | null {
  if (typeof role !== 'string') return null;

  const normalizedRole = role.trim().toUpperCase();
  return knownRoles.has(normalizedRole) ? (normalizedRole as AuthorizationRole) : null;
}

export function getRoleFromUser(user: AuthorizationUserLike | null | undefined): AuthorizationRole | null {
  return normalizeRole(user?.app_metadata?.user_role ?? user?.app_metadata?.role);
}

/**
 * Custom Access Token Hooks amend the JWT, not session.user.app_metadata.
 * Decode the role from the same server-issued access token that PostgREST
 * validates. A malformed or absent claim fails closed.
 */
export function getRoleFromAccessToken(accessToken: string | null | undefined): AuthorizationRole | null {
  if (!accessToken) return null;

  try {
    const payloadSegment = accessToken.split('.')[1];
    if (!payloadSegment) return null;

    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!claims || typeof claims !== 'object') return null;

    const appMetadata = (claims as Record<string, unknown>).app_metadata;
    if (!appMetadata || typeof appMetadata !== 'object') return null;
    const metadata = appMetadata as Record<string, unknown>;
    return normalizeRole(metadata.user_role ?? metadata.role);
  } catch {
    return null;
  }
}

export function getRoleFromSession(session: AuthorizationSessionLike | null | undefined): AuthorizationRole | null {
  return getRoleFromAccessToken(session?.access_token) ?? getRoleFromUser(session?.user);
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

export function getAuthorizationDiagnosticsFromSession(session: AuthorizationSessionLike | null | undefined): AuthorizationDiagnostics {
  const tokenRole = getRoleFromAccessToken(session?.access_token);
  const metadataDiagnostics = getAuthorizationDiagnosticsFromUser(session?.user);

  return tokenRole
    ? { ...metadataDiagnostics, resolvedRole: tokenRole, metadataMismatch: false }
    : metadataDiagnostics;
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

export function getAuthorizationContextFromSession(session: AuthorizationSessionLike | null | undefined): AuthorizationContext | null {
  const role = getRoleFromSession(session);
  if (!session?.user?.id || !role) return null;

  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    role,
  };
}

export function hasRole(context: AuthorizationContext | null | undefined, role: AuthorizationRole): boolean {
  return context?.role === role;
}

/**
 * Writes the database always denies unless the actor is ADMIN or MANAGER
 * (`is_admin_or_manager()` on properties/units/owners/people/contracts/
 * expenses, contract atomic RPCs, vault/contract documents, and storage
 * attachment mutations).
 *
 * The SQL catalog may still list these as OPERATIONS capabilities via
 * `role_has_app_permission`. That is intended catalog capacity, not current
 * RLS authority. The frontend must not show actions the database will always
 * reject — including per-user grants. `service_providers.write` is NOT in
 * this fence: the database enforces it through
 * `current_user_has_effective_app_permission`.
 */
export const serverEnforcedWriteRoles = {
  'properties.write': ['ADMIN', 'MANAGER'],
  'contracts.write': ['ADMIN', 'MANAGER'],
  'expenses.write': ['ADMIN', 'MANAGER'],
  'documents.write': ['ADMIN', 'MANAGER'],
} as const satisfies Partial<Record<AppPermission, readonly AuthorizationRole[]>>;

export function canAccess(context: AuthorizationContext | null | undefined, permission: AppPermission): boolean {
  if (!context) return false;

  const requiredRoles = serverEnforcedWriteRoles[permission as keyof typeof serverEnforcedWriteRoles];
  if (requiredRoles && !(requiredRoles as readonly AuthorizationRole[]).includes(context.role)) {
    return false;
  }

  return Boolean(context.grantedPermissions?.includes(permission)) || (rolePermissions[context.role]?.has(permission) ?? false);
}

export function canAccessAny(context: AuthorizationContext | null | undefined, permissions: readonly AppPermission[]): boolean {
  return permissions.some((permission) => canAccess(context, permission));
}

export function canAccessRoute(context: AuthorizationContext | null | undefined, permission: AppPermission | null | undefined): boolean {
  return permission ? canAccess(context, permission) : Boolean(context);
}

export type WriteAccessState = 'full' | 'read-only' | 'unconfigured';

/**
 * Shell-level write posture is deliberately broad, while every individual
 * affordance remains guarded by its own capability.  This prevents a USER
 * with one approved write grant from being mislabeled read-only without
 * accidentally exposing unrelated mutations.
 */
export const writeAccessPermissions = [
  'documents.write',
  'service_providers.write',
  'properties.write',
  'contracts.write',
  'expenses.write',
  'financial.invoices.generate',
  'financial.payments.create',
  'financial.receipts.void',
  'financial.bank_reconciliation.match',
  'financial.owner_settlements.approve',
  'financial.owner_settlements.pay',
] as const satisfies readonly AppPermission[];

export function getWriteAccessState(
  context: AuthorizationContext | null | undefined,
): WriteAccessState {
  if (!context) return 'unconfigured';
  return canAccessAny(context, writeAccessPermissions) ? 'full' : 'read-only';
}

export function canShowNavigationItem(context: AuthorizationContext | null | undefined, permission: AppPermission | null | undefined): boolean {
  return permission ? canAccess(context, permission) : true;
}
