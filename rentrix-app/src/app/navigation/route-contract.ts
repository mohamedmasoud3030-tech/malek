/**
 * Route / Navigation Contract — task-centric IA
 *
 * Single source of truth that binds:
 *   canonical route → primary workspace → permission → mobile navigation.
 *
 * Global IA is intentionally limited to seven primary destinations:
 *   Today → Portfolio → Leasing → Money → Services → Reports → Settings.
 *
 * Entity registers remain canonical and deep-linkable. They are exposed by
 * progressive disclosure inside the workspace that owns the user's task,
 * rather than competing as independent products in the global sidebar.
 *
 * Critical invariants enforced elsewhere:
 *   - Every capability has exactly ONE canonical route; duplicate legacy
 *     routes and redirect stubs are not registered and internal navigation
 *     never generates them.
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
  targetIANote?: string;
}

export const ROUTE_CONTRACT: readonly RouteContractEntry[] = [
  // Public / auth
  { canonical: '/', titleAr: 'مالك — كل أملاكك في مكان واحد', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null },
  { canonical: '/login', titleAr: 'تسجيل الدخول', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null },
  { canonical: '/privacy', titleAr: 'سياسة الخصوصية', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null },
  { canonical: '/terms', titleAr: 'شروط الاستخدام', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null },
  { canonical: '/support', titleAr: 'الدعم والتواصل', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null },

  // Today
  { canonical: '/dashboard', titleAr: 'اليوم', sidebarRoot: '/dashboard', isPrimaryNav: true, inMobileNav: false, permission: null, targetIANote: 'Canonical label is اليوم; route stays /dashboard for compatibility.' },

  // Portfolio
  { canonical: '/properties', titleAr: 'العقارات', sidebarRoot: '/properties', isPrimaryNav: true, inMobileNav: false, permission: 'properties.view' },
  { canonical: '/properties/new', titleAr: 'إضافة عقار', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'properties.create' },
  { canonical: '/properties/$propertyId', titleAr: 'تفاصيل العقار', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'properties.view' },
  { canonical: '/properties/$propertyId/edit', titleAr: 'تعديل عقار', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'properties.edit' },
  { canonical: '/lands', titleAr: 'الأراضي', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'lands.view' },
  { canonical: '/lands/$landId', titleAr: 'ملف الأرض', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'lands.view' },
  { canonical: '/owners', titleAr: 'الملاك', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'owners.hub.view' },
  { canonical: '/owners/$ownerId', titleAr: 'ملف المالك', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'owners.detail.view' },
  { canonical: '/owners/$ownerId/edit', titleAr: 'تعديل مالك', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'owners.hub.view' },

  // Leasing
  { canonical: '/contracts', titleAr: 'العقود', sidebarRoot: '/contracts', isPrimaryNav: true, inMobileNav: false, permission: 'contracts.view' },
  { canonical: '/contracts/new', titleAr: 'إنشاء عقد', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.create' },
  { canonical: '/contracts/$contractId', titleAr: 'تفاصيل العقد', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.view' },
  { canonical: '/contracts/$contractId/edit', titleAr: 'تعديل عقد', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.edit' },
  { canonical: '/tenants', titleAr: 'المستأجرون', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.view' },
  { canonical: '/tenants/$tenantId', titleAr: 'ملف المستأجر', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.view' },
  { canonical: '/people', titleAr: 'جهات التعامل', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.view' },
  { canonical: '/people/$personId', titleAr: 'ملف الشخص', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.view' },
  { canonical: '/people/new', titleAr: 'إضافة شخص', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.create' },
  { canonical: '/people/$personId/edit', titleAr: 'تعديل شخص', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.edit' },
  { canonical: '/leads', titleAr: 'العملاء المحتملون', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'leads.view' },
  { canonical: '/communication', titleAr: 'التواصل', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'communication.view' },

  // Services
  { canonical: '/maintenance', titleAr: 'الخدمات', sidebarRoot: '/maintenance', isPrimaryNav: true, inMobileNav: false, permission: 'maintenance.view' },
  { canonical: '/service-providers', titleAr: 'مزودو الخدمات', sidebarRoot: '/maintenance', isPrimaryNav: false, inMobileNav: false, permission: 'service_providers.view' },
  { canonical: '/service-providers/new', titleAr: 'إضافة مزود خدمة', sidebarRoot: '/maintenance', isPrimaryNav: false, inMobileNav: false, permission: 'service_providers.write' },
  { canonical: '/service-providers/$providerId', titleAr: 'ملف مزود الخدمة', sidebarRoot: '/maintenance', isPrimaryNav: false, inMobileNav: false, permission: 'service_providers.view' },
  { canonical: '/service-providers/$providerId/edit', titleAr: 'تعديل مزود الخدمة', sidebarRoot: '/maintenance', isPrimaryNav: false, inMobileNav: false, permission: 'service_providers.write' },

  // Money
  { canonical: '/financials', titleAr: 'المال', sidebarRoot: '/financials', isPrimaryNav: true, inMobileNav: false, permission: 'financial.workspace.view' },
  { canonical: '/commissions', titleAr: 'العمولات', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'commissions.view' },
  { canonical: '/receipts', titleAr: 'الإيصالات', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'financial.workspace.view', targetIANote: 'Receipt document/print surface; requires ?receiptId=. The register canonical is /financials?section=collections&view=receipts.' },

  // Reports
  { canonical: '/reports', titleAr: 'المحاسبة والتقارير', sidebarRoot: '/reports', isPrimaryNav: true, inMobileNav: false, permission: 'financial.reports.view' },
  { canonical: '/reports/$reportId', titleAr: 'تقرير MALEK', sidebarRoot: '/reports', isPrimaryNav: false, inMobileNav: false, permission: 'financial.reports.view', targetIANote: 'Premium report product route — opened from the /reports catalog; export permissions stay page-level.' },

  // Tools/settings
  { canonical: '/ai-assistant', titleAr: 'المساعد الذكي', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null },
  { canonical: '/help', titleAr: 'المساعدة والدعم', sidebarRoot: '/settings', isPrimaryNav: false, inMobileNav: false, permission: null },
  { canonical: '/admin-support', titleAr: 'عمليات الدعم والتحقيق', sidebarRoot: '/settings', isPrimaryNav: false, inMobileNav: false, permission: 'support.operations.view' },
  { canonical: '/settings', titleAr: 'الإعدادات', sidebarRoot: '/settings', isPrimaryNav: true, inMobileNav: false, permission: null },
] as const;

export const TARGET_IA_TOP_LEVEL = [
  '/dashboard', '/properties', '/contracts', '/financials', '/maintenance', '/reports', '/settings',
] as const;
