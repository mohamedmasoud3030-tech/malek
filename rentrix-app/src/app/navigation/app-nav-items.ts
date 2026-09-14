import { BarChart3, Building2, CircleDollarSign, ContactRound, DoorOpen, FileText, FolderKanban, Gauge, HandCoins, HardHat, KeyRound, LayoutDashboard, LifeBuoy, MapPinned, MessageSquareText, Percent, Receipt, ReceiptText, Settings, ShieldCheck, UserRound, Users, Wallet, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppPermission } from '@/features/auth/permissions';

export type NavItem = readonly [to: string, labelKey: string, description: string, Icon: LucideIcon, permission?: AppPermission, search?: Readonly<Record<string, string>>];
export type MobileNavItem = readonly [to: string, labelKey: string, Icon: LucideIcon, permission?: AppPermission, search?: Readonly<Record<string, string>>];
export type NavGroup = readonly [sectionTitle: string, items: readonly NavItem[], adminOnly?: boolean];

export const navGroups: readonly NavGroup[] = [
  ['العمل', [
    ['/dashboard', 'today', 'ما يحتاج انتباهك وتنفيذك الآن', LayoutDashboard],
    ['/properties', 'portfolio', 'العقارات والوحدات والملاك', Building2, 'properties.view'],
    ['/contracts', 'leasing', 'العقود والمستأجرون من البداية حتى التجديد أو الإخلاء', FileText, 'contracts.view'],
    ['/financials', 'money', 'الفواتير والتحصيل والمصروفات وأموال الملاك والبنوك', Wallet, 'financial.workspace.view'],
    ['/maintenance', 'services', 'الصيانة والمرافق وما يحتاج متابعة', Wrench, 'maintenance.view'],
  ]],
  ['التحليل والإدارة', [
    ['/reports', 'reports', 'التقارير التحليلية والتشغيلية', BarChart3, 'financial.reports.view'],
    ['/settings', 'settings', 'الشركة والمستخدمون والصلاحيات والإعدادات التشغيلية', Settings],
  ]],
];

export const workspaceChildNavItems: Record<string, readonly NavItem[]> = {
  '/properties': [
    ['/properties', 'units', 'كل الوحدات وحالات الإشغال', DoorOpen, 'properties.view', { section: 'units' }],
    ['/owners', 'owners', 'الملاك وعلاقات الملكية والإدارة', UserRound, 'owners.hub.view'],
    ['/lands', 'lands', 'قطع الأراضي كأصول ضمن المحفظة', MapPinned, 'lands.view'],
  ],
  '/contracts': [
    ['/contracts', 'contracts', 'العقود وعلاقات الإيجار', FileText, 'contracts.view'],
    ['/tenants', 'tenants', 'المستأجرون وعلاقات الإيجار', KeyRound, 'contracts.view'],
    ['/people', 'peopleDirectory', 'دليل أطراف التأجير والتعامل', Users, 'contracts.view'],
    ['/leads', 'leads', 'الفرص قبل التعاقد ومتابعة تحويلها', ContactRound, 'leads.view'],
    ['/communication', 'communication', 'المتابعات والتواصل مع الأطراف', MessageSquareText, 'communication.view'],
  ],
  '/financials': [
    ['/financials', 'invoices', 'ابحث عن الفاتورة وحصّلها مباشرة', FileText, 'financial.workspace.view', { section: 'collections', view: 'invoices' }],
    ['/financials', 'receipts', 'سجل التحصيلات والإيصالات السابقة', Receipt, 'financial.workspace.view', { section: 'collections', view: 'receipts' }],
    ['/financials', 'expenses', 'إضافة المصروفات ومراجعتها', CircleDollarSign, 'expenses.view', { section: 'expenses', view: 'expenses' }],
    ['/commissions', 'commissions', 'عمولات الوسطاء والتشغيل', Percent, 'commissions.view'],
  ],
  '/maintenance': [
    ['/maintenance', 'maintenance', 'طلبات الصيانة والمتابعة', Wrench, 'maintenance.view'],
    ['/utilities', 'utilities', 'المرافق والعدادات', Gauge, 'maintenance.view'],
    ['/service-providers', 'serviceProviders', 'مزودو الخدمات ومهامهم', HardHat, 'service_providers.view'],
    ['/documents-vault', 'documentsVault', 'المستندات التشغيلية', FolderKanban],
  ],
  '/reports': [],
  '/settings': [
    ['/settings/company', 'companySettings', 'بيانات الشركة وإعداداتها', Building2, 'company.settings.manage'],
    ['/settings/users-permissions', 'usersPermissions', 'الموظفون والصلاحيات', ShieldCheck, 'users.manage'],
    ['/settings/automation', 'automation', 'قواعد الأتمتة والتنبيهات', Settings, 'automation.view'],
    ['/settings/audit-log', 'auditLog', 'سجل التدقيق', ShieldCheck, 'audit.view'],
    ['/admin-support', 'adminSupport', 'عمليات الدعم والتحقيق حسب صلاحياتك', LifeBuoy, 'support.operations.view'],
  ],
};

export function getAllNavItems(): readonly NavItem[] {
  return [...navGroups.flatMap((group) => group[1]), ...Object.values(workspaceChildNavItems).flat()];
}
export const mobileNavItems: readonly MobileNavItem[] = [];
export const quickCreateItems: readonly MobileNavItem[] = [
  ['/contracts/new', 'newContract', FileText, 'contracts.create'],
  ['/financials', 'collectPayment', HandCoins, 'financial.payments.create', { section: 'collections', view: 'invoices', quickAdd: 'collect' }],
  ['/maintenance', 'maintenanceRequest', Wrench, 'maintenance.create', { quickAdd: 'maintenance' }],
  ['/utilities', 'utilityBill', ReceiptText, 'maintenance.create', { quickAdd: 'utility-bill' }],
];
