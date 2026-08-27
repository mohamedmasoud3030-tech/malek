import {
  BadgeDollarSign,
  BarChart3,
  Building2,
  DoorOpen,
  FileText,
  LayoutDashboard,
  PieChart,
  Settings,
  Settings2,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserRoundCog,
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

/** Task-centric product IA: Today → Portfolio → Leasing → Money → Services → Reports → Settings. */
export const navGroups: readonly NavGroup[] = [
  ['العمل', [
    ['/dashboard', 'today', 'ما يحتاج انتباهك وتنفيذك الآن', LayoutDashboard],
    ['/properties', 'portfolio', 'العقارات والوحدات والملاك', Building2],
    ['/contracts', 'leasing', 'العقود والمستأجرون من البداية حتى التجديد أو الإخلاء', FileText],
    ['/financials', 'money', 'المستحقات والتحصيل والمصروفات وما يحتاج متابعة', PieChart],
    ['/maintenance', 'services', 'الصيانة والمرافق وما يحتاج متابعة', Wrench],
  ]],
  ['التحليل والإدارة', [
    ['/reports', 'reportsAndStatements', 'التقارير والتحليلات والكشوف', BarChart3, 'financial.reports.view'],
    ['/settings', 'settings', 'الشركة والمستخدمون والصلاحيات والإعدادات التشغيلية', Settings],
  ]],
];

/**
 * Workspace children preserve context instead of sending the user to another
 * feature module. Specialist registers stay deep-link/contextual instead of
 * competing with the user's daily navigation.
 */
export const workspaceChildNavItems: Record<string, readonly NavItem[]> = {
  '/properties': [
    ['/properties', 'units', 'كل الوحدات وحالات الإشغال', DoorOpen, undefined, { section: 'units' }],
    ['/properties', 'owners', 'الملاك وعلاقات الملكية والإدارة', UserRoundCog, 'owners.hub.view', { section: 'owners' }],
  ],
  '/contracts': [
    ['/contracts', 'tenants', 'المستأجرون وعلاقات الإيجار', UserCheck, undefined, { workspace: 'tenants' }],
  ],
  '/financials': [
    ['/financials', 'invoices', 'المستحقات والفواتير', FileText, undefined, { section: 'collections', view: 'invoices' }],
    ['/financials', 'receipts', 'التحصيل والإيصالات', BadgeDollarSign, undefined, { section: 'collections', view: 'receipts' }],
    ['/financials', 'arrears', 'المتأخرات التي تحتاج متابعة', BarChart3, 'arrears.view', { section: 'collections', view: 'arrears' }],
    ['/financials', 'expenses', 'المصروفات', PieChart, 'expenses.view', { section: 'expenses', view: 'expenses' }],
  ],
  '/maintenance': [
    ['/maintenance', 'maintenance', 'طلبات الصيانة والمتابعة', Wrench, undefined, { section: 'maintenance' }],
    ['/maintenance', 'utilities', 'المرافق والعدادات', Zap, undefined, { section: 'utilities' }],
  ],
  '/reports': [],
  '/settings': [
    ['/settings', 'companySettings', 'بيانات الشركة وإعداداتها', Building2, 'company.settings.manage', { section: 'company' }],
    ['/settings', 'usersPermissions', 'المستخدمون وطلبات الصلاحيات', ShieldCheck, 'permission_requests.review', { section: 'users-permissions' }],
    ['/settings', 'automation', 'الأتمتة', Settings2, 'automation.view', { section: 'automation' }],
  ],
};

export function getAllNavItems(): readonly NavItem[] {
  return [...navGroups.flatMap((group) => group[1]), ...Object.values(workspaceChildNavItems).flat()];
}

export const mobileNavItems: readonly MobileNavItem[] = [];

export const quickCreateItems: readonly MobileNavItem[] = [
  ['/contracts/new', 'newContract', FileText, 'contracts.write'],
  ['/properties/new', 'newProperty', Building2, 'properties.write'],
  ['/people/new', 'newPerson', UserPlus],
];
