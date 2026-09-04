import type { Session, User } from '@supabase/supabase-js';

export const authorizationRoles = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'] as const;

export type AuthorizationRole = (typeof authorizationRoles)[number];

/**
 * Canonical application permission vocabulary.
 *
 * This list is NOT an authorization authority — it is the client-side spelling
 * of `public.app_permission_catalog`, which is the single authority. Every code
 * below must exist in the migration-backed catalog; a code that only exists
 * here (or only in `supabase/seed.sql`) fails closed server-side for every role
 * including ADMIN. Parity is regression-locked by
 * `permission-catalog-authority.test.ts` (source parity: catalog vs. this list,
 * route guards, navigation gates and the role matrix) and
 * `permission-catalog-authority.pglite.test.ts` (runtime parity: a PGlite replay
 * of the migration chain alone, with no seed, projected per role).
 */
export const appPermissions = [
  'app.dashboard.view',
  'audit.view',
  'integrity.view',
  'properties.view',
  'properties.create',
  'properties.edit',
  'properties.archive',
  'properties.write',
  'contracts.view',
  'contracts.create',
  'contracts.edit',
  'contracts.approve',
  'contracts.cancel',
  'contracts.write',
  'maintenance.view',
  'maintenance.create',
  'maintenance.edit',
  'maintenance.approve',
  'maintenance.cancel',
  'maintenance.write',
  'financial.workspace.view',
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
  'owner.portal.link',
  'tenant.portal.link',
  'lands.view',
  'leads.view',
  'commissions.view',
  'communication.view',
  'automation.view',
  'auth.password.change',
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
  'properties.view': 'عرض العقارات والوحدات',
  'properties.create': 'إضافة',
  'properties.edit': 'تعديل',
  'properties.archive': 'أرشفة',
  'properties.write': 'إضافة وتعديل العقارات والوحدات (توافق قديم)',
  'contracts.view': 'عرض العقود والمستأجرين',
  'contracts.create': 'إضافة',
  'contracts.edit': 'تعديل وتمديد وتجديد',
  'contracts.approve': 'اعتماد',
  'contracts.cancel': 'إلغاء أو إنهاء',
  'contracts.write': 'إضافة وتعديل العقود (توافق قديم)',
  'maintenance.view': 'عرض الصيانة والمرافق',
  'maintenance.create': 'إضافة',
  'maintenance.edit': 'تعديل ومتابعة',
  'maintenance.approve': 'اعتماد الإغلاق',
  'maintenance.cancel': 'إلغاء',
  'maintenance.write': 'إنشاء ومتابعة وتنفيذ الصيانة (توافق قديم)',
  'financial.workspace.view': 'عرض المالية والتحصيل',
  'service_providers.view': 'عرض مزودي الخدمات',
  'service_providers.write': 'إضافة وتعديل وأرشفة مزودي الخدمات',
  'system.view': 'عرض إعدادات النظام والحوكمة',
  'users.manage': 'إدارة المستخدمين والصلاحيات',
  'permission_requests.review': 'مراجعة طلبات الصلاحية',
  'support.operations.view': 'عرض عمليات الدعم',
  'support.requests.triage': 'فرز طلبات الدعم',
  'support.user_lookup.view': 'عرض بحث المستخدمين المقنّع',
  'company.settings.manage': 'إدارة إعدادات الشركة',
  'cost_centers.manage': 'إدارة مراكز التكلفة',
  'documents.write': 'رفع واستبدال وأرشفة المستندات',
  'owners.hub.view': 'عرض سجل الملاك',
  'owners.detail.view': 'عرض ملف المالك',
  'owner.portal.link': 'تصدير رابط عرض بوابة المالك',
  'tenant.portal.link': 'تصدير رابط عرض بوابة المستأجر',
  'lands.view': 'عرض الأراضي',
  'leads.view': 'عرض العملاء المحتملين',
  'commissions.view': 'عرض العمولات',
  'communication.view': 'عرض التواصل والمتابعات',
  'automation.view': 'عرض الأتمتة',
  'auth.password.change': 'تغيير كلمة المرور',
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

export const employeeActionPermissions = {
  properties: {
    view: 'properties.view',
    create: 'properties.create',
    edit: 'properties.edit',
    cancel: 'properties.archive',
  },
  contracts: {
    view: 'contracts.view',
    create: 'contracts.create',
    edit: 'contracts.edit',
    approve: 'contracts.approve',
    cancel: 'contracts.cancel',
  },
  maintenance: {
    view: 'maintenance.view',
    create: 'maintenance.create',
    edit: 'maintenance.edit',
    approve: 'maintenance.approve',
    cancel: 'maintenance.cancel',
  },
} as const satisfies Record<string, Readonly<Record<string, AppPermission>>>;

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
  /**
   * When resolved=true this is the authoritative server-computed capability
   * set (role compatibility + owner overrides + explicit grants). When false
   * it contains only additive grants and the legacy role map remains the
   * compatibility fallback.
   */
  grantedPermissions?: readonly AppPermission[];
  effectivePermissionsResolved?: boolean;
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

/**
 * Compatibility defaults only. Routine office UX does not expose these six
 * names. Owner overrides are resolved server-side and take precedence over
 * this map once effective permissions are loaded.
 */
const rolePermissions = {
  ADMIN: new Set<AppPermission>(appPermissions),
  MANAGER: new Set<AppPermission>([
    'app.dashboard.view',
    'properties.view', 'properties.create', 'properties.edit', 'properties.archive', 'properties.write',
    'contracts.view', 'contracts.create', 'contracts.edit', 'contracts.approve', 'contracts.cancel', 'contracts.write',
    'maintenance.view', 'maintenance.create', 'maintenance.edit', 'maintenance.approve', 'maintenance.cancel', 'maintenance.write',
    'financial.workspace.view',
    'service_providers.view', 'service_providers.write',
    'permission_requests.review',
    'support.operations.view', 'support.requests.triage',
    'cost_centers.manage', 'documents.write',
    'owners.hub.view', 'owners.detail.view', 'lands.view', 'leads.view',
    'commissions.view', 'communication.view', 'automation.view',
    'auth.password.change',
    'expenses.view', 'expenses.write', 'arrears.view',
    'financial.deposits.view',
    'financial.invoices.generate', 'financial.invoices.export',
    'financial.payments.create', 'financial.receipts.void',
    'financial.reports.view', 'financial.reports.export',
    'financial.bank_reconciliation.view', 'financial.bank_reconciliation.match',
    'financial.owner_settlements.view',
    'financial.fixed_monthly_accruals.view',
    'financial.fixed_monthly_accruals.execute',
    'financial.fixed_monthly_accruals.reverse',
  ]),
  ACCOUNTANT: new Set<AppPermission>([
    'app.dashboard.view', 'financial.workspace.view', 'audit.view',
    'expenses.view', 'arrears.view', 'financial.deposits.view',
    'financial.invoices.generate', 'financial.invoices.export',
    'financial.reports.view', 'financial.reports.export',
    'financial.bank_reconciliation.view', 'financial.bank_reconciliation.match',
    'financial.owner_settlements.view',
    'financial.fixed_monthly_accruals.view',
    'financial.fixed_monthly_accruals.execute',
    'financial.fixed_monthly_accruals.reverse',
    'auth.password.change',
  ]),
  OPERATIONS: new Set<AppPermission>([
    'app.dashboard.view',
    'properties.view', 'contracts.view',
    'maintenance.view', 'maintenance.create', 'maintenance.edit', 'maintenance.approve', 'maintenance.cancel', 'maintenance.write',
    'financial.workspace.view',
    'service_providers.view', 'service_providers.write',
    'cost_centers.manage',
    'owners.hub.view', 'owners.detail.view', 'lands.view', 'leads.view',
    'communication.view', 'automation.view', 'auth.password.change',
    'expenses.view', 'arrears.view',
  ]),
  USER: new Set<AppPermission>(['app.dashboard.view', 'auth.password.change']),
  VIEWER: new Set<AppPermission>([
    'app.dashboard.view',
    'properties.view', 'contracts.view', 'maintenance.view', 'financial.workspace.view',
    'financial.reports.view', 'service_providers.view',
    'owners.hub.view', 'owners.detail.view', 'lands.view', 'leads.view',
    'commissions.view', 'communication.view', 'automation.view',
    'expenses.view', 'arrears.view', 'financial.deposits.view',
    'financial.owner_settlements.view', 'financial.bank_reconciliation.view',
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
  return { userId: user.id, email: user.email ?? null, role };
}

export function getAuthorizationContextFromSession(session: AuthorizationSessionLike | null | undefined): AuthorizationContext | null {
  const role = getRoleFromSession(session);
  if (!session?.user?.id || !role) return null;
  return { userId: session.user.id, email: session.user.email ?? null, role };
}

export function hasRole(context: AuthorizationContext | null | undefined, role: AuthorizationRole): boolean {
  return context?.role === role;
}

export function canAccess(context: AuthorizationContext | null | undefined, permission: AppPermission): boolean {
  if (!context) return false;
  // ADMIN is the Office Owner compatibility role. Server-side permission
  // resolution never allows employee overrides to deny ADMIN, so the client
  // must preserve that invariant even when the effective-permission RPC is
  // temporarily unavailable or returns an empty set.
  if (context.role === 'ADMIN') return rolePermissions.ADMIN.has(permission);
  const effective = Boolean(context.grantedPermissions?.includes(permission));
  if (context.effectivePermissionsResolved) return effective;
  return effective || (rolePermissions[context.role]?.has(permission) ?? false);
}

export function canAccessAny(context: AuthorizationContext | null | undefined, permissions: readonly AppPermission[]): boolean {
  return permissions.some((permission) => canAccess(context, permission));
}

export function canAccessRoute(context: AuthorizationContext | null | undefined, permission: AppPermission | null | undefined): boolean {
  return permission ? canAccess(context, permission) : Boolean(context);
}

export type WriteAccessState = 'full' | 'read-only' | 'unconfigured';

export const writeAccessPermissions = [
  'documents.write', 'service_providers.write',
  'properties.create', 'properties.edit', 'properties.archive',
  'contracts.create', 'contracts.edit', 'contracts.approve', 'contracts.cancel',
  'maintenance.create', 'maintenance.edit', 'maintenance.approve', 'maintenance.cancel',
  'expenses.write', 'financial.invoices.generate',
  'financial.payments.create', 'financial.receipts.void',
  'financial.bank_reconciliation.match', 'financial.owner_settlements.approve',
  'financial.owner_settlements.pay',
] as const satisfies readonly AppPermission[];

export function getWriteAccessState(context: AuthorizationContext | null | undefined): WriteAccessState {
  if (!context) return 'unconfigured';
  return canAccessAny(context, writeAccessPermissions) ? 'full' : 'read-only';
}

export function canShowNavigationItem(context: AuthorizationContext | null | undefined, permission: AppPermission | null | undefined): boolean {
  return permission ? canAccess(context, permission) : true;
}
