/**
 * Route / Navigation Contract — task-centric IA
 *
 * Single source of truth that binds:
 *   canonical route → legacy aliases → primary workspace → permission → mobile navigation.
 *
 * Global IA is intentionally limited to seven primary destinations:
 *   Today → Portfolio → Leasing → Money → Services → Reports → Settings.
 *
 * Entity registers remain canonical and deep-linkable. They are exposed by
 * progressive disclosure inside the workspace that owns the user's task,
 * rather than competing as independent products in the global sidebar.
 *
 * Critical invariants enforced elsewhere:
 *   - No legacy URL may 404 (must redirect preserving ?search).
 *   - No protected route may render blank (loading/error/empty must be gated).
 *   - Active nav state must resolve for every registered path.
 *   - Permission on nav item must match route-tree requirePermission().
 */

import type { AppPermission } from '@/features/auth/permissions';

export type SidebarRoot =
  | '/dashboard'
  | '/properties'
  | '/contracts'
  | '/maintenance'
  | '/financials'
  | '/reports'
  | '/settings';

export interface RouteContractEntry {
  canonical: string;
  titleAr: string;
  sidebarRoot: SidebarRoot;
  isPrimaryNav: boolean;
  inMobileNav: boolean;
  permission: AppPermission | null;
  legacyAliases: readonly string[];
  viewBinding: { param: string; section: string; view?: string } | null;
  targetIANote?: string;
}

export const ROUTE_CONTRACT: readonly RouteContractEntry[] = [
  // Public / auth
  { canonical: '/', titleAr: 'مالك — كل أملاكك في مكان واحد', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: ['/landing'], viewBinding: null },
  { canonical: '/login', titleAr: 'تسجيل الدخول', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/privacy', titleAr: 'سياسة الخصوصية', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/terms', titleAr: 'شروط الاستخدام', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/support', titleAr: 'الدعم والتواصل', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },

  // Today
  { canonical: '/dashboard', titleAr: 'لوحة التحكم', sidebarRoot: '/dashboard', isPrimaryNav: true, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null, targetIANote: 'Global label is اليوم; route stays /dashboard for compatibility.' },

  // Portfolio
  { canonical: '/properties', titleAr: 'العقارات', sidebarRoot: '/properties', isPrimaryNav: true, inMobileNav: false, permission: 'properties.view', legacyAliases: [], viewBinding: null },
  { canonical: '/properties/new', titleAr: 'إضافة عقار', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'properties.create', legacyAliases: [], viewBinding: null },
  { canonical: '/properties/$propertyId', titleAr: 'تفاصيل العقار', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'properties.view', legacyAliases: [], viewBinding: null },
  { canonical: '/properties/$propertyId/edit', titleAr: 'تعديل عقار', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'properties.edit', legacyAliases: [], viewBinding: null },
  { canonical: '/units', titleAr: 'الوحدات', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'properties.view', legacyAliases: [], viewBinding: { param: 'section', section: 'units' } },
  { canonical: '/lands', titleAr: 'الأراضي', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'lands.view', legacyAliases: [], viewBinding: null },
  { canonical: '/lands/$landId', titleAr: 'ملف الأرض', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'lands.view', legacyAliases: [], viewBinding: null },
  { canonical: '/owners', titleAr: 'الملاك', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'owners.hub.view', legacyAliases: [], viewBinding: null },
  { canonical: '/owners/$ownerId', titleAr: 'ملف المالك', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'owners.detail.view', legacyAliases: [], viewBinding: null },
  { canonical: '/owners/$ownerId/edit', titleAr: 'تعديل مالك', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'owners.hub.view', legacyAliases: [], viewBinding: null },

  // Leasing
  { canonical: '/contracts', titleAr: 'العقود', sidebarRoot: '/contracts', isPrimaryNav: true, inMobileNav: false, permission: 'contracts.view', legacyAliases: [], viewBinding: null },
  { canonical: '/contracts/new', titleAr: 'إنشاء عقد', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.create', legacyAliases: [], viewBinding: null },
  { canonical: '/contracts/$contractId', titleAr: 'تفاصيل العقد', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.view', legacyAliases: [], viewBinding: null },
  { canonical: '/contracts/$contractId/edit', titleAr: 'تعديل عقد', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.edit', legacyAliases: [], viewBinding: null },
  { canonical: '/tenants', titleAr: 'المستأجرون', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.view', legacyAliases: [], viewBinding: null },
  { canonical: '/tenants/$tenantId', titleAr: 'ملف المستأجر', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.view', legacyAliases: [], viewBinding: null },
  { canonical: '/people', titleAr: 'جهات التعامل', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.view', legacyAliases: [], viewBinding: null },
  { canonical: '/people/$personId', titleAr: 'ملف الشخص', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.view', legacyAliases: [], viewBinding: null },
  { canonical: '/people/new', titleAr: 'إضافة شخص', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.create', legacyAliases: [], viewBinding: null },
  { canonical: '/people/$personId/edit', titleAr: 'تعديل شخص', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.edit', legacyAliases: [], viewBinding: null },
  { canonical: '/leads', titleAr: 'العملاء المحتملون', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'leads.view', legacyAliases: [], viewBinding: null },
  { canonical: '/communication', titleAr: 'التواصل', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'communication.view', legacyAliases: [], viewBinding: null },

  // Services
  { canonical: '/maintenance', titleAr: 'الخدمات', sidebarRoot: '/maintenance', isPrimaryNav: true, inMobileNav: false, permission: 'maintenance.view', legacyAliases: [], viewBinding: null },
  { canonical: '/service-providers', titleAr: 'مزودو الخدمات', sidebarRoot: '/maintenance', isPrimaryNav: false, inMobileNav: false, permission: 'service_providers.view', legacyAliases: [], viewBinding: null },
  { canonical: '/service-providers/new', titleAr: 'إضافة مزود خدمة', sidebarRoot: '/maintenance', isPrimaryNav: false, inMobileNav: false, permission: 'service_providers.write', legacyAliases: [], viewBinding: null },
  { canonical: '/service-providers/$providerId', titleAr: 'ملف مزود الخدمة', sidebarRoot: '/maintenance', isPrimaryNav: false, inMobileNav: false, permission: 'service_providers.view', legacyAliases: [], viewBinding: null },
  { canonical: '/service-providers/$providerId/edit', titleAr: 'تعديل مزود الخدمة', sidebarRoot: '/maintenance', isPrimaryNav: false, inMobileNav: false, permission: 'service_providers.write', legacyAliases: [], viewBinding: null },
  { canonical: '/utilities', titleAr: 'المرافق والعدادات', sidebarRoot: '/maintenance', isPrimaryNav: false, inMobileNav: false, permission: 'maintenance.view', legacyAliases: [], viewBinding: { param: 'section', section: 'utilities' } },
  { canonical: '/documents-vault', titleAr: 'المستندات — توافق قديم', sidebarRoot: '/maintenance', isPrimaryNav: false, inMobileNav: false, permission: 'maintenance.view', legacyAliases: [], viewBinding: { param: 'section', section: 'documents_vault' } },

  // Money
  { canonical: '/financials', titleAr: 'المالية', sidebarRoot: '/financials', isPrimaryNav: true, inMobileNav: false, permission: 'financial.workspace.view', legacyAliases: [], viewBinding: null },
  { canonical: '/finance/collections', titleAr: 'التحصيل والفواتير', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'financial.workspace.view', legacyAliases: [], viewBinding: { param: 'section', section: 'collections' } },
  { canonical: '/finance/expenses', titleAr: 'المصروفات والمتأخرات', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'expenses.view', legacyAliases: [], viewBinding: { param: 'section', section: 'expenses' } },
  { canonical: '/finance/deposits', titleAr: 'التأمينات وتسويات الملاك', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'financial.deposits.view', legacyAliases: [], viewBinding: { param: 'section', section: 'funds' } },
  { canonical: '/finance/banking', titleAr: 'البنوك', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'financial.workspace.view', legacyAliases: [], viewBinding: { param: 'section', section: 'banking' } },
  { canonical: '/invoices', titleAr: 'الفواتير', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'financial.workspace.view', legacyAliases: [], viewBinding: { param: 'section', section: 'collections', view: 'invoices' } },
  { canonical: '/receipts', titleAr: 'الإيصالات', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'financial.workspace.view', legacyAliases: [], viewBinding: { param: 'section', section: 'collections', view: 'receipts' } },
  { canonical: '/expenses', titleAr: 'المصروفات', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'expenses.view', legacyAliases: [], viewBinding: { param: 'section', section: 'expenses', view: 'expenses' } },
  { canonical: '/arrears', titleAr: 'المتأخرات', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'arrears.view', legacyAliases: [], viewBinding: { param: 'section', section: 'collections', view: 'arrears' } },
  { canonical: '/deposits', titleAr: 'التأمينات', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'financial.deposits.view', legacyAliases: [], viewBinding: { param: 'section', section: 'funds', view: 'deposits' } },
  { canonical: '/owner-settlements', titleAr: 'تسويات الملاك', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'financial.owner_settlements.view', legacyAliases: [], viewBinding: { param: 'section', section: 'funds', view: 'owner_settlements' } },
  { canonical: '/bank-reconciliation', titleAr: 'المطابقة البنكية', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'financial.bank_reconciliation.view', legacyAliases: [], viewBinding: { param: 'section', section: 'banking' } },
  { canonical: '/commissions', titleAr: 'العمولات', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'commissions.view', legacyAliases: [], viewBinding: null },

  // Reports
  { canonical: '/reports', titleAr: 'المحاسبة والتقارير', sidebarRoot: '/reports', isPrimaryNav: true, inMobileNav: false, permission: 'financial.reports.view', legacyAliases: [], viewBinding: null },
  { canonical: '/accounting', titleAr: 'المحاسبة والتقارير', sidebarRoot: '/reports', isPrimaryNav: false, inMobileNav: false, permission: 'financial.reports.view', legacyAliases: [], viewBinding: { param: 'section', section: 'accounting', view: 'general_ledger' } },

  // Tools/settings
  { canonical: '/ai-assistant', titleAr: 'المساعد الذكي', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/help', titleAr: 'المساعدة والدعم', sidebarRoot: '/settings', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/admin-support', titleAr: 'عمليات الدعم والتحقيق', sidebarRoot: '/settings', isPrimaryNav: false, inMobileNav: false, permission: 'support.operations.view', legacyAliases: [], viewBinding: null },
  { canonical: '/settings', titleAr: 'الإعدادات', sidebarRoot: '/settings', isPrimaryNav: true, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/automation', titleAr: 'الأتمتة', sidebarRoot: '/settings', isPrimaryNav: false, inMobileNav: false, permission: 'automation.view', legacyAliases: [], viewBinding: { param: 'section', section: 'automation' } },
  { canonical: '/change-password', titleAr: 'تغيير كلمة المرور', sidebarRoot: '/settings', isPrimaryNav: false, inMobileNav: false, permission: 'auth.password.change', legacyAliases: [], viewBinding: { param: 'section', section: 'change-password' } },
  { canonical: '/audit-log', titleAr: 'سجل التدقيق', sidebarRoot: '/settings', isPrimaryNav: false, inMobileNav: false, permission: 'audit.view', legacyAliases: [], viewBinding: null },
  { canonical: '/data-integrity', titleAr: 'سلامة البيانات', sidebarRoot: '/settings', isPrimaryNav: false, inMobileNav: false, permission: 'integrity.view', legacyAliases: [], viewBinding: null },
  { canonical: '/system', titleAr: 'إدارة النظام', sidebarRoot: '/settings', isPrimaryNav: false, inMobileNav: false, permission: 'system.view', legacyAliases: [], viewBinding: null },
] as const;

export const REDIRECT_ROUTES = [
  '/landing', '/units', '/utilities', '/automation', '/documents-vault',
  '/finance/collections', '/finance/expenses', '/finance/deposits', '/finance/banking',
  '/expenses', '/invoices', '/receipts', '/arrears', '/deposits', '/owner-settlements',
  '/bank-reconciliation', '/accounting', '/change-password', '/audit-log', '/data-integrity', '/system',
] as const;

export const TARGET_IA_TOP_LEVEL = [
  '/dashboard', '/properties', '/contracts', '/financials', '/maintenance', '/reports', '/settings',
] as const;