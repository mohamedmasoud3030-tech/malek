import {
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ContactRound,
  DoorOpen,
  FileText,
  FolderKanban,
  LayoutDashboard,
  MapPinned,
  MessageSquareText,
  PieChart,
  Settings,
  Settings2,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserRoundCog,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppPermission } from '@/features/auth/permissions';

export type NavItem = readonly [
  to: string,
  labelKey: string,
  description: string,
  Icon: LucideIcon,
  permission?: AppPermission,
  search?: Readonly<Record<string, string>>,
];
export type MobileNavItem = readonly [to: string, labelKey: string, Icon: LucideIcon, permission?: AppPermission];
export type NavGroup = readonly [sectionTitle: string, items: readonly NavItem[], adminOnly?: boolean];

/** Final P6 IA. Children are owned by their visible parent domain. */
export const navGroups: readonly NavGroup[] = [
  ['الرئيسية', [['/dashboard', 'dashboard', 'ملخص الأداء اليومي وما يحتاج متابعة', LayoutDashboard]]],
  ['الأشخاص', [['/people', 'peopleDirectory', 'دليل الأشخاص وجهات التعامل', Users]]],
  ['العقارات', [['/properties', 'properties', 'العقارات والوحدات', Building2]]],
  ['الأراضي', [['/lands', 'lands', 'الأراضي وقطع الأراضي', MapPinned, 'lands.view']]],
  ['العقود', [['/contracts', 'contracts', 'العقود والتجديدات ودورة الحياة', FileText]]],
  ['المالية', [['/financials', 'financials', 'الفواتير والتحصيل والمصروفات والتسويات والبنوك', PieChart]]],
  // /reports denies every role without financial.reports.export at the page
  // gate (ReportsPage → AccessDenied). Showing the entry to roles that always
  // get denied is a misleading navigation affordance, so the nav item carries
  // the same permission the page enforces.
  ['التقارير', [['/reports', 'accountingReports', 'التقارير والتحليلات والكشوف', BarChart3, 'financial.reports.export']]],
  ['الخدمات', [['/maintenance', 'services', 'الصيانة والمرافق والخدمات التشغيلية', Wrench]]],
  ['العمولات', [['/commissions', 'commissions', 'عمولات التحصيل والمبيعات المرتبطة بالمصادر', BadgeDollarSign, 'commissions.view']]],
  ['الإعدادات', [['/settings', 'settings', 'إعدادات الشركة والصلاحيات والأتمتة والنظام', Settings]]],
];

export const workspaceChildNavItems: Record<string, readonly NavItem[]> = {
  '/people': [
    ['/leads', 'leads', 'مصادر العملاء المحتملين والتحويلات', ContactRound, 'leads.view'],
    ['/owners', 'owners', 'ملفات الملاك وعلاقات الملكية', UserRoundCog, 'owners.hub.view'],
    ['/tenants', 'tenants', 'ملفات المستأجرين والعقود المرتبطة', UserCheck],
    ['/communication', 'communication', 'سجل التواصل والمتابعات التشغيلية', MessageSquareText, 'communication.view'],
  ],
  '/properties': [
    ['/units', 'units', 'كل الوحدات وحالات الإشغال', DoorOpen],
  ],
  '/lands': [],
  '/contracts': [],
  '/financials': [
    ['/invoices', 'invoices', 'الفواتير ومتابعة الاستحقاق', FileText],
    ['/receipts', 'receipts', 'الإيصالات والتحصيلات', BadgeDollarSign],
    ['/expenses', 'expenses', 'المصروفات', PieChart, 'expenses.view'],
    ['/deposits', 'deposits', 'الودائع والتأمينات', FolderKanban, 'financial.deposits.view'],
    ['/owner-settlements', 'ownerSettlements', 'تسويات الملاك', UserRoundCog, 'financial.owner_settlements.view'],
    ['/bank-reconciliation', 'bankReconciliation', 'التسوية البنكية', BarChart3, 'financial.bank_reconciliation.view'],
  ],
  '/reports': [],
  '/maintenance': [
    ['/maintenance', 'maintenance', 'طلبات الصيانة والمتابعة', Wrench, undefined, { section: 'maintenance' }],
    ['/service-providers', 'serviceProviders', 'ملفات مزودي الخدمات وتخصصاتهم', BriefcaseBusiness, 'service_providers.view'],
    ['/utilities', 'utilities', 'المرافق والعدادات', Zap],
  ],
  '/commissions': [],
  '/settings': [
    ['/settings', 'companySettings', 'بيانات الشركة وإعداداتها', Building2, 'company.settings.manage', { section: 'company' }],
    ['/settings', 'usersPermissions', 'المستخدمون وطلبات الصلاحيات', ShieldCheck, 'permission_requests.review', { section: 'users-permissions' }],
    ['/settings', 'costCenters', 'مراكز التكلفة', FolderKanban, 'cost_centers.manage', { section: 'cost-centers' }],
    ['/settings', 'automation', 'الأتمتة', Settings2, 'automation.view', { section: 'automation' }],
    ['/settings', 'systemSettings', 'إعدادات النظام والحوكمة', Settings, 'system.view', { section: 'system-settings' }],
  ],
};

export function getAllNavItems(): readonly NavItem[] {
  return [...navGroups.flatMap((group) => group[1]), ...Object.values(workspaceChildNavItems).flat()];
}

/** Mobile navigation is exclusively the floating Menu + Search control. */
export const mobileNavItems: readonly MobileNavItem[] = [];

export const quickCreateItems: readonly MobileNavItem[] = [
  ['/contracts/new', 'newContract', FileText, 'contracts.write'],
  ['/properties/new', 'newProperty', Building2, 'properties.write'],
  ['/people/new', 'newPerson', UserPlus],
];
