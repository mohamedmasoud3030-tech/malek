/**
 * Route / Navigation Contract — Phase 2 Canonical IA
 *
 * Single source of truth that binds:
 *   canonical route → legacy aliases → sidebar location → permission → mobile navigation → target IA
 *
 * Phase 2 implements canonical IA:
 *   /dashboard | /people* | /properties | /lands* | /contracts |
 *   /financials (invoices/receipts/expenses/deposits/owner_settlements/bank_reconciliation) |
 *   /reports | /services(=maintenance) | /commissions* | /settings
 *   * = newly promoted to first-class in Phase 2 (previously aliases).
 *
 * Critical invariants enforced elsewhere:
 *   - No legacy URL may 404 (must redirect preserving ?search).
 *   - No protected route may render blank (loading/error/empty must be gated).
 *   - Active nav state must resolve for every registered path.
 *   - Permission on nav item must match route-tree requirePermission().
 */

import type { AppPermission } from '@/features/auth/permissions';

// ---------------------------------------------------------------------------
// Canonical route definitions
// ---------------------------------------------------------------------------

export type SidebarRoot =
  | '/dashboard'
  | '/people'
  | '/properties'
  | '/lands'
  | '/owners'
  | '/tenants'
  | '/contracts'
  | '/maintenance'
  | '/financials'
  | '/commissions'
  | '/reports'
  | '/ai-assistant'
  | '/settings';

export interface RouteContractEntry {
  /** Canonical path as registered in route-tree.ts (e.g. '/financials'). Alias routes are not canonical. */
  canonical: string;
  /** Human title (Arabic) — must match routeTree staticData.title. */
  titleAr: string;
  /** Primary nav root (for active state). Must match routeNavRoot value. */
  sidebarRoot: SidebarRoot;
  /** Visible as top-level sidebar entry? */
  isPrimaryNav: boolean;
  /** Legacy flag; always false because mobile exposes Menu + Search only. */
  inMobileNav: boolean;
  /** Permission guard or null (auth-only). */
  permission: AppPermission | null;
  /** Legacy alias paths that must redirect to canonical (preserving search). */
  legacyAliases: readonly string[];
  /**
   * Query-param view binding (for hubs). E.g. /financials?section=collections&view=invoices
   * Null means direct route (owns its own path).
   */
  viewBinding: { param: string; section: string; view?: string } | null;
  /** Target-IA note: where this route lands after future restructuring. */
  targetIANote?: string;
}

// ---------------------------------------------------------------------------
// Current reality (must mirror route-tree.ts + app-nav-items.ts + route-nav-map.ts)
// ---------------------------------------------------------------------------

export const ROUTE_CONTRACT: readonly RouteContractEntry[] = [
  // ── Public / Auth
  { canonical: '/', titleAr: 'مالك — كل أملاكك في مكان واحد', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: ['/landing'], viewBinding: null },
  { canonical: '/login', titleAr: 'تسجيل الدخول', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/privacy', titleAr: 'سياسة الخصوصية', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/terms', titleAr: 'شروط الاستخدام', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },

  // ── لوحة التحكم
  { canonical: '/dashboard', titleAr: 'لوحة التحكم', sidebarRoot: '/dashboard', isPrimaryNav: true, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },

  // ── العقارات + asset support
  { canonical: '/properties', titleAr: 'العقارات', sidebarRoot: '/properties', isPrimaryNav: true, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null, targetIANote: 'Stays primary. Lands leaves to own top-level in target IA.' },
  { canonical: '/properties/new', titleAr: 'إضافة عقار', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'properties.write', legacyAliases: [], viewBinding: null },
  { canonical: '/properties/$propertyId', titleAr: 'تفاصيل العقار', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/properties/$propertyId/edit', titleAr: 'تعديل عقار', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: 'properties.write', legacyAliases: [], viewBinding: null },
  { canonical: '/units', titleAr: 'الوحدات', sidebarRoot: '/properties', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: { param: 'section', section: 'units' }, targetIANote: 'Redirects to /properties?section=units — stays under properties.' },
  { canonical: '/lands', titleAr: 'الأراضي', sidebarRoot: '/lands', isPrimaryNav: true, inMobileNav: false, permission: 'lands.view', legacyAliases: [], viewBinding: null },
  { canonical: '/lands/$landId', titleAr: 'ملف الأرض', sidebarRoot: '/lands', isPrimaryNav: false, inMobileNav: false, permission: 'lands.view', legacyAliases: [], viewBinding: null },

  // ── الملاك والمستأجرون
  { canonical: '/owners', titleAr: 'الملاك', sidebarRoot: '/people', isPrimaryNav: true, inMobileNav: false, permission: 'owners.hub.view', legacyAliases: [], viewBinding: null },
  { canonical: '/owners/$ownerId', titleAr: 'ملف المالك', sidebarRoot: '/people', isPrimaryNav: false, inMobileNav: false, permission: 'owners.detail.view', legacyAliases: [], viewBinding: null },
  { canonical: '/tenants', titleAr: 'المستأجرون', sidebarRoot: '/people', isPrimaryNav: true, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/tenants/$tenantId', titleAr: 'ملف المستأجر', sidebarRoot: '/people', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },

  // ── الأشخاص — Phase 2 canonical standalone
  { canonical: '/people', titleAr: 'جهات التعامل', sidebarRoot: '/people', isPrimaryNav: true, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/people/$personId', titleAr: 'ملف الشخص', sidebarRoot: '/people', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/people/new', titleAr: 'إضافة شخص', sidebarRoot: '/people', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/people/$personId/edit', titleAr: 'تعديل شخص', sidebarRoot: '/people', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/leads', titleAr: 'العملاء المحتملون', sidebarRoot: '/people', isPrimaryNav: false, inMobileNav: false, permission: 'leads.view', legacyAliases: [], viewBinding: null, targetIANote: 'People-owned first-class workspace.' },
  { canonical: '/communication', titleAr: 'التواصل', sidebarRoot: '/people', isPrimaryNav: false, inMobileNav: false, permission: 'communication.view', legacyAliases: [], viewBinding: null },

  // ── العقود
  { canonical: '/contracts', titleAr: 'العقود', sidebarRoot: '/contracts', isPrimaryNav: true, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/contracts/new', titleAr: 'إنشاء عقد', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.write', legacyAliases: [], viewBinding: null },
  { canonical: '/contracts/$contractId', titleAr: 'تفاصيل العقد', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/contracts/$contractId/edit', titleAr: 'تعديل عقد', sidebarRoot: '/contracts', isPrimaryNav: false, inMobileNav: false, permission: 'contracts.write', legacyAliases: [], viewBinding: null },

  // ── التشغيل / الخدمات
  { canonical: '/maintenance', titleAr: 'الخدمات', sidebarRoot: '/maintenance', isPrimaryNav: true, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null, targetIANote: 'Target IA renames conceptually to "الخدمات" but route stays /maintenance for compatibility.' },
  { canonical: '/utilities', titleAr: 'المرافق والعدادات', sidebarRoot: '/maintenance', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: { param: 'section', section: 'utilities' } },
  { canonical: '/automation', titleAr: 'الأتمتة', sidebarRoot: '/settings', isPrimaryNav: false, inMobileNav: false, permission: 'automation.view', legacyAliases: [], viewBinding: { param: 'section', section: 'automation' } },
  { canonical: '/documents-vault', titleAr: 'خزينة المستندات', sidebarRoot: '/maintenance', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: { param: 'section', section: 'documents_vault' } },

  // ── المالية — one primary hub, many views (no radical split in Phase 1)
  { canonical: '/financials', titleAr: 'المالية', sidebarRoot: '/financials', isPrimaryNav: true, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/finance/collections', titleAr: 'التحصيل والفواتير', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: { param: 'section', section: 'collections' } },
  { canonical: '/finance/expenses', titleAr: 'المصروفات والمتأخرات', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'expenses.view', legacyAliases: [], viewBinding: { param: 'section', section: 'expenses' } },
  { canonical: '/finance/deposits', titleAr: 'التأمينات وتسويات الملاك', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'financial.deposits.view', legacyAliases: [], viewBinding: { param: 'section', section: 'funds' } },
  { canonical: '/finance/banking', titleAr: 'البنوك', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: { param: 'section', section: 'banking' } },
  { canonical: '/invoices', titleAr: 'الفواتير', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: { param: 'section', section: 'collections', view: 'invoices' } },
  { canonical: '/receipts', titleAr: 'الإيصالات', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: { param: 'section', section: 'collections', view: 'receipts' } },
  { canonical: '/expenses', titleAr: 'المصروفات', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'expenses.view', legacyAliases: [], viewBinding: { param: 'section', section: 'expenses', view: 'expenses' } },
  { canonical: '/arrears', titleAr: 'المتأخرات', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'arrears.view', legacyAliases: [], viewBinding: { param: 'section', section: 'collections', view: 'arrears' } },
  { canonical: '/deposits', titleAr: 'التأمينات', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'financial.deposits.view', legacyAliases: [], viewBinding: { param: 'section', section: 'funds', view: 'deposits' } },
  { canonical: '/owner-settlements', titleAr: 'تسويات الملاك', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'financial.owner_settlements.view', legacyAliases: [], viewBinding: { param: 'section', section: 'funds', view: 'owner_settlements' } },
  { canonical: '/bank-reconciliation', titleAr: 'المطابقة البنكية', sidebarRoot: '/financials', isPrimaryNav: false, inMobileNav: false, permission: 'financial.bank_reconciliation.view', legacyAliases: [], viewBinding: { param: 'section', section: 'banking' } },
  { canonical: '/commissions', titleAr: 'العمولات', sidebarRoot: '/commissions', isPrimaryNav: true, inMobileNav: false, permission: 'commissions.view', legacyAliases: [], viewBinding: null, targetIANote: 'Phase 2 canonical standalone — cross-domain commission workflow, not banking fee. Legacy /financials?section=expenses&view=commissions and /finance/banking?section=commissions redirect to /commissions.' },

  // ── التقارير — independent
  { canonical: '/reports', titleAr: 'المحاسبة والتقارير', sidebarRoot: '/reports', isPrimaryNav: true, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null, targetIANote: 'Must remain visually & conceptually independent from Finance — no shared page chrome.' },
  { canonical: '/accounting', titleAr: 'المحاسبة والتقارير', sidebarRoot: '/reports', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: { param: 'section', section: 'accounting', view: 'general_ledger' } },

  // ── الأدوات
  { canonical: '/ai-assistant', titleAr: 'المساعد الذكي', sidebarRoot: '/dashboard', isPrimaryNav: false, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null, targetIANote: 'Legacy deep-link only; the assistant is now a global overlay action.' },

  // ── الإدارة
  { canonical: '/settings', titleAr: 'الإعدادات', sidebarRoot: '/settings', isPrimaryNav: true, inMobileNav: false, permission: null, legacyAliases: [], viewBinding: null },
  { canonical: '/change-password', titleAr: 'تغيير كلمة المرور', sidebarRoot: '/settings', isPrimaryNav: false, inMobileNav: false, permission: 'auth.password.change', legacyAliases: [], viewBinding: { param: 'section', section: 'change-password' } },
  { canonical: '/audit-log', titleAr: 'سجل التدقيق', sidebarRoot: '/settings', isPrimaryNav: false, inMobileNav: false, permission: 'audit.view', legacyAliases: [], viewBinding: null },
  { canonical: '/data-integrity', titleAr: 'سلامة البيانات', sidebarRoot: '/settings', isPrimaryNav: false, inMobileNav: false, permission: 'integrity.view', legacyAliases: [], viewBinding: null },
  { canonical: '/system', titleAr: 'إدارة النظام', sidebarRoot: '/settings', isPrimaryNav: false, inMobileNav: false, permission: 'system.view', legacyAliases: [], viewBinding: null },
] as const;

// ---------------------------------------------------------------------------
// Derived helpers (used by tests and future navigation)
// ---------------------------------------------------------------------------

export const LEGACY_REDIRECT_PATHS = ROUTE_CONTRACT.flatMap((e) =>
  e.legacyAliases.length > 0 ? [{ from: e.legacyAliases[0], to: e.canonical } as const] : [],
);

// All paths that have a redirect beforeLoad (aliases + finance internal views + maintenance/property children)
// We list them explicitly for test discoverability.
export const REDIRECT_ROUTES = [
  '/landing',
  '/units',
  '/utilities',
  '/automation',
  '/documents-vault',
  '/finance/collections',
  '/finance/expenses',
  '/finance/deposits',
  '/finance/banking',
  '/expenses',
  '/invoices',
  // /receipts special: redirect only when receiptId absent (print shell exception)
  '/receipts',
  '/arrears',
  '/deposits',
  '/owner-settlements',
  '/bank-reconciliation',
  '/accounting',
  '/ai-assistant',
  '/change-password',
  '/audit-log',
  '/data-integrity',
  '/system',
] as const;

export const TARGET_IA_TOP_LEVEL = [
  '/dashboard',
  '/people', // was /contracts child — target: top-level الأشخاص
  '/properties',
  '/lands', // was alias — target: top-level الأراضي
  '/contracts',
  '/financials', // invoices/receipts/expenses/deposits/owner_settlements/bank_reconciliation stay inside
  '/reports',
  '/maintenance', // conceptually "الخدمات"
  '/commissions', // standalone module
  '/settings',
] as const;

export function findContract(canonical: string): RouteContractEntry | undefined {
  return ROUTE_CONTRACT.find((e) => e.canonical === canonical);
}

export function contractsBySidebarRoot(root: SidebarRoot): readonly RouteContractEntry[] {
  return ROUTE_CONTRACT.filter((e) => e.sidebarRoot === root);
}
