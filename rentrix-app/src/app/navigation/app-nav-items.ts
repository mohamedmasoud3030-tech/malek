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

/**
 * Task-centric product IA.
 *
 * The shell exposes only the seven questions a property-office user needs to
 * answer. Entity registers remain fully routable, but they are capabilities of
 * a workspace rather than independent products in the sidebar.
 *
 * Today → Portfolio → Leasing → Money → Services → Reports → Settings
 */
export const navGroups: readonly NavGroup[] = [
  ['العمل', [
    ['/dashboard', 'today', 'ما يحتاج انتباهك وتنفيذك الآن', LayoutDashboard],
    ['/properties', 'portfolio', 'العقارات والوحدات والملاك والأصول المدارة', Building2],
    ['/contracts', 'leasing', 'دورة التأجير من الجاهزية حتى التجديد أو الإخلاء', FileText],
    ['/financials', 'money', 'المستحقات والتحصيل والمصروفات وأموال الملاك والبنوك', PieChart],
    ['/maintenance', 'services', 'الصيانة والمرافق والخدمات التشغيلية', Wrench],
  ]],
  ['التحليل والإدارة', [
    ['/reports', 'reportsAndStatements', 'التقارير والتحليلات والكشوف', BarChart3, 'financial.reports.view'],
    ['/settings', 'settings', 'الشركة والمستخدمون والصلاحيات والأتمتة والنظام', Settings],
  ]],
];

/**
 * Progressive disclosure inside each primary workspace. These links keep the
 * existing routes and permissions intact while removing feature-by-feature
 * navigation from the global shell.
 */
export const workspaceChildNavItems: Record<string, readonly NavItem[]> = {
  '/properties': [
    ['/units', 'units', 'كل الوحدات وحالات الإشغال', DoorOpen],
    ['/lands', 'lands', 'الأراضي وقطع الأراضي', MapPinned, 'lands.view'],
    ['/owners', 'owners', 'الملاك وعلاقات الملكية والإدارة', UserRoundCog, 'owners.hub.view'],
  ],
  '/contracts': [
    ['/tenants', 'tenants', 'المستأجرون وعلاقات الإيجار', UserCheck],
    ['/people', 'peopleDirectory', 'دليل الأشخاص وجهات التعامل', Users],
    ['/leads', 'leads', 'العملاء المحتملون والتحويلات', ContactRound, 'leads.view'],
    ['/communication', 'communication', 'التواصل والمتابعات التشغيلية', MessageSquareText, 'communication.view'],
  ],
  '/financials': [
    ['/invoices', 'invoices', 'المستحقات والفواتير', FileText],
    ['/receipts', 'receipts', 'الإيصالات والتحصيلات', BadgeDollarSign],
    ['/arrears', 'arrears', 'المتأخرات التي تحتاج متابعة', BarChart3, 'arrears.view'],
    ['/expenses', 'expenses', 'المصروفات', PieChart, 'expenses.view'],
    ['/deposits', 'deposits', 'التأمينات والودائع', FolderKanban, 'financial.deposits.view'],
    ['/owner-settlements', 'ownerSettlements', 'مستحقات وتسويات الملاك', UserRoundCog, 'financial.owner_settlements.view'],
    ['/bank-reconciliation', 'bankReconciliation', 'البنوك والمطابقة البنكية', BarChart3, 'financial.bank_reconciliation.view'],
    ['/commissions', 'commissions', 'العمولات المرتبطة بالمصادر المالية', BadgeDollarSign, 'commissions.view'],
  ],
  '/maintenance': [
    ['/maintenance', 'maintenance', 'طلبات الصيانة والمتابعة', Wrench, undefined, { section: 'maintenance' }],
    ['/service-providers', 'serviceProviders', 'مزودو الخدمات وتخصصاتهم', BriefcaseBusiness, 'service_providers.view'],
    ['/utilities', 'utilities', 'المرافق والعدادات', Zap],
    ['/documents-vault', 'documentsVault', 'المستندات التشغيلية المرتبطة بالعمل', FolderKanban],
  ],
  '/reports': [],
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
