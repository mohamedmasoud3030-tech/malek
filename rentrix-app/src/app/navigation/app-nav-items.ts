import { BadgeDollarSign, BarChart3, Bot, Building2, ClipboardList, ContactRound, DoorOpen, FileCheck, FileSpreadsheet, FileText, FolderKanban, HandCoins, KeyRound, Landmark, LayoutDashboard, ListChecks, MapPinned, MessageSquareText, PieChart, ReceiptText, SearchCheck, Settings, Settings2, ShieldCheck, UserCheck, UserPlus, UserRoundCog, Users, WalletCards, Wrench, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppPermission } from '@/features/auth/permissions';

export type NavItem = readonly [to: string, labelKey: string, description: string, Icon: LucideIcon, permission?: AppPermission];
export type MobileNavItem = readonly [to: string, labelKey: string, Icon: LucideIcon, permission?: AppPermission];
export type NavGroup = readonly [sectionTitle: string, items: readonly NavItem[], adminOnly?: boolean];

/**
 * Consolidated 7-workspace primary sidebar navigation.
 * Keeps only top-level hub entry points in the main sidebar to eliminate visual overload,
 * while sub-workspaces are accessible via workspace-local secondary navigation.
 */
export const navGroups: readonly NavGroup[] = [
  ['لوحة التحكم', [['/dashboard', 'dashboard', 'ملخص الأداء اليومي', LayoutDashboard]]],
  ['المحفظة العقارية', [
    ['/properties', 'properties', 'ملفات العقارات والأصول', Building2],
  ]],
  ['العلاقات والعقود', [
    ['/contracts', 'contracts', 'العقود والتجديدات', FileText],
  ]],
  ['التشغيل والصيانة', [
    ['/maintenance', 'maintenance', 'طلبات الصيانة والمتابعة', Wrench, 'maintenance.view'],
  ]],
  ['المالية', [
    ['/financials', 'financialOverview', 'نظرة شاملة على التحصيلات والمصروفات والذمم', PieChart],
  ]],
  ['التقارير', [
    ['/reports', 'reportsAndStatements', 'مركز التقارير والكشوفات التنفيذية الشاملة', BarChart3],
  ]],
  ['الإدارة', [
    ['/settings', 'settings', 'مركز تحكم المكتب، الهوية، الأمان، وسجلات الحوكمة', Settings, 'settings.manage'],
  ]],
];

/**
 * Workspace-local secondary navigation items for each top-level hub.
 * Preserves all routes, deep-link destinations, and permission checks without cluttering the sidebar.
 */
export const workspaceChildNavItems: Record<string, readonly NavItem[]> = {
  '/properties': [
    ['/owners', 'owners', 'إدارة ملفات الملاك وعلاقات الملكية', UserRoundCog, 'owners.hub.view'],
    ['/units', 'units', 'كل الوحدات وحالات الإشغال', DoorOpen],
    ['/lands', 'lands', 'إدارة قطع الأراضي ومتابعة حالتها', MapPinned, 'lands.view'],
  ],
  '/contracts': [
    ['/people', 'peopleDirectory', 'دليل جهات التعامل', Users],
    ['/tenants', 'tenants', 'بيانات المستأجرين', UserCheck],
    ['/leads', 'leads', 'مصادر العملاء المحتملين والتحويلات', ContactRound, 'leads.view'],
    ['/communication', 'communication', 'سجل التواصل والمتابعات التشغيلية', MessageSquareText, 'communication.view'],
  ],
  '/maintenance': [
    ['/utilities', 'utilities', 'عدادات الكهرباء والمياه وفواتير المرافق', Zap],
    ['/automation', 'automation', 'تذكيرات العقود والإيجار وتنبيهات التشغيل', Settings2, 'automation.view'],
    ['/documents-vault', 'documentsVault', 'أرشيف المستندات وخزينة المرفقات', FolderKanban],
  ],
  '/financials': [
    ['/invoices', 'invoices', 'مراجعة الفواتير وتسجيل دفعاتها', FileSpreadsheet],
    ['/receipts', 'receipts', 'سجل الإيصالات وطباعة سندات القبض', ReceiptText],
    ['/expenses', 'expenses', 'تسجيل ومراجعة نفقات العقارات', WalletCards, 'expenses.view'],
    ['/arrears', 'arrears', 'متابعة الذمم وأعمار الديون', ClipboardList, 'arrears.view'],
    ['/deposits', 'deposits', 'تتبع مبالغ أمانات وتأمينات المستأجرين', FileCheck, 'financial.deposits.view'],
    ['/owner-settlements', 'ownerSettlements', 'إعداد تسويات الملاك واعتمادها وصرفها', HandCoins, 'financial.owner_settlements.view'],
    ['/bank-reconciliation', 'bankReconciliation', 'مطابقة السجلات مع الحسابات البنكية', Landmark, 'financial.bank_reconciliation.view'],
    ['/commissions', 'commissions', 'تتبع عمولات المكتب وحالات الاستحقاق', BadgeDollarSign, 'commissions.view'],
  ],
  '/reports': [
    ['/ai-assistant', 'aiAssistant', 'مساعد قراءة فقط لتلخيص المتأخرات والتجديدات واللقطات المالية', Bot],
  ],
  '/settings': [
    ['/change-password', 'changePassword', 'تغيير كلمة مرور حسابك وإنهاء استخدام الكلمات الضعيفة', KeyRound, 'auth.password.change'],
    ['/audit-log', 'auditLog', 'سجل أحداث الحوكمة والعمليات', ListChecks, 'audit.view'],
    ['/data-integrity', 'dataIntegrity', 'فحوصات سلامة البيانات والتطابق', SearchCheck, 'integrity.view'],
    ['/system', 'system', 'إدارة حوكمة النظام وإسناد الأدوار', ShieldCheck, 'system.view'],
  ],
};

/**
 * Returns every registered navigation item (top-level + child workspaces) for permission and route auditing.
 */
export function getAllNavItems(): readonly NavItem[] {
  const topLevel = navGroups.flatMap((group) => group[1]);
  const children = Object.values(workspaceChildNavItems).flat();
  return [...topLevel, ...children];
}

// Five stable hubs fit on a phone without horizontal scrolling or competing
// financial destinations. Maintenance, invoices, receipts, and every advanced
// workspace remain one tap away in the full mobile drawer; /financials is their
// purpose-built daily directory.
export const mobileNavItems: readonly MobileNavItem[] = [
  ['/dashboard', 'dashboard', LayoutDashboard],
  ['/properties', 'properties', Building2],
  ['/contracts', 'contracts', FileText],
  ['/financials', 'financialOverview', PieChart],
  ['/reports', 'reports', BarChart3],
];

// Quick-create actions surfaced in the app header (+). Permissions mirror the
// destination route guards so restricted roles only see what they can open.
export const quickCreateItems: readonly MobileNavItem[] = [
  ['/contracts/new', 'newContract', FileText, 'contracts.write'],
  ['/properties/new', 'newProperty', Building2, 'properties.write'],
  ['/people/new', 'newPerson', UserPlus],
];
