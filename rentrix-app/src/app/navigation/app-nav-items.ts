import {
  BarChart3,
  Building2,
  CircleDollarSign,
  DoorOpen,
  FileText,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  UserPlus,
  UserRound,
  Wallet,
  Wrench,
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
    ['/properties', 'portfolio', 'العقارات والوحدات والملاك', Building2, 'properties.view'],
    ['/contracts', 'leasing', 'العقود والمستأجرون من البداية حتى التجديد أو الإخلاء', FileText, 'contracts.view'],
    ['/financials', 'money', 'الفواتير والتحصيل والمصروفات وأموال الملاك والبنوك', Wallet, 'financial.workspace.view'],
    ['/maintenance', 'services', 'الصيانة والمرافق وما يحتاج متابعة', Wrench, 'maintenance.view'],
  ]],
  ['التحليل والإدارة', [
    ['/reports', 'reportsAndStatements', 'التقارير والتحليلات والكشوف', BarChart3, 'financial.reports.view'],
    ['/settings', 'settings', 'الشركة والمستخدمون والصلاحيات والإعدادات التشغيلية', Settings],
  ]],
];

/**
 * Workspace children are the shortest routine paths, not an inventory of every
 * specialist register. Extra finance capabilities stay inside the Money shell
 * or behind contextual deep links so the global navigation remains obvious.
 */
export const workspaceChildNavItems: Record<string, readonly NavItem[]> = {
  '/properties': [
    ['/properties', 'units', 'كل الوحدات وحالات الإشغال', DoorOpen, 'properties.view', { section: 'units' }],
    ['/properties', 'owners', 'الملاك وعلاقات الملكية والإدارة', UserRound, 'owners.hub.view', { section: 'owners' }],
  ],
  '/contracts': [
    ['/contracts', 'tenants', 'المستأجرون وعلاقات الإيجار', KeyRound, 'contracts.view', { workspace: 'tenants' }],
  ],
  '/financials': [
    ['/financials', 'invoices', 'ابحث عن الفاتورة وحصّلها مباشرة', FileText, 'financial.workspace.view', { section: 'collections', view: 'invoices' }],
    ['/financials', 'receipts', 'سجل التحصيلات والإيصالات السابقة', Receipt, 'financial.workspace.view', { section: 'collections', view: 'receipts' }],
    ['/financials', 'expenses', 'إضافة المصروفات ومراجعتها', CircleDollarSign, 'expenses.view', { section: 'expenses', view: 'expenses' }],
  ],
  '/maintenance': [
    ['/maintenance', 'maintenance', 'طلبات الصيانة والمتابعة', Wrench, 'maintenance.view', { section: 'maintenance' }],
    ['/maintenance', 'utilities', 'المرافق والعدادات', Gauge, 'maintenance.view', { section: 'utilities' }],
  ],
  '/reports': [],
  '/settings': [
    ['/settings', 'companySettings', 'بيانات الشركة وإعداداتها', Building2, 'company.settings.manage', { section: 'company' }],
    ['/settings', 'usersPermissions', 'الموظفون والصلاحيات', ShieldCheck, 'users.manage', { section: 'users-permissions' }],
  ],
};

export function getAllNavItems(): readonly NavItem[] {
  return [...navGroups.flatMap((group) => group[1]), ...Object.values(workspaceChildNavItems).flat()];
}

export const mobileNavItems: readonly MobileNavItem[] = [];

export const quickCreateItems: readonly MobileNavItem[] = [
  ['/contracts/new', 'newContract', FileText, 'contracts.create'],
  ['/properties/new', 'newProperty', Building2, 'properties.create'],
  ['/people/new', 'newPerson', UserPlus, 'contracts.create'],
];
