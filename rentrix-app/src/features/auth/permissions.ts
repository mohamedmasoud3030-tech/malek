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
    'documents.write',
    'owners.hub.view',
    'owners.detail.view',
    'lands.view',
    'leads.view',
    'communication.view',
    'automation.view',
    'auth.password.change',
    'properties.write',
    'contracts.write',
    'expenses.view',
    'expenses.write',
    'arrears.view',
  ]),
  USER: new Set<AppPermission>(['app.dashboard.view', 'auth.password.change']),
  VIEWER: new Set<AppPermission>([
    'app.dashboard.view',
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
