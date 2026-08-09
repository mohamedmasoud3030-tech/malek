import { BadgeDollarSign, BarChart3, Building2, ContactRound, DoorOpen, FileText, FolderKanban, LayoutDashboard, MapPinned, MessageSquareText, PieChart, Settings, Settings2, ShieldCheck, UserCheck, UserPlus, UserRoundCog, Users, Wrench, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppPermission } from '@/features/auth/permissions';

export type NavItem = readonly [to: string, labelKey: string, description: string, Icon: LucideIcon, permission?: AppPermission];
export type MobileNavItem = readonly [to: string, labelKey: string, Icon: LucideIcon, permission?: AppPermission];
export type NavGroup = readonly [sectionTitle: string, items: readonly NavItem[], adminOnly?: boolean];

/** Canonical product IA. Supporting routes are rendered beneath their owning domain. */
export const navGroups: readonly NavGroup[] = [
  ['الرئيسية', [
    ['/dashboard', 'dashboard', 'ملخص الأداء اليومي وما يحتاج متابعة', LayoutDashboard],
  ]],
  ['الأشخاص', [
    ['/people', 'peopleDirectory', 'دليل الأشخاص وجهات التعامل', Users],
  ]],
  ['العقارات', [
    ['/properties', 'properties', 'العقارات والوحدات', Building2],
  ]],
  ['الأراضي', [
    ['/lands', 'lands', 'الأراضي وقطع الأراضي', MapPinned, 'lands.view'],
  ]],
  ['العقود', [
    ['/contracts', 'contracts', 'العقود والتجديدات ودورة الحياة', FileText],
  ]],
  ['المالية', [
    ['/financials', 'financials', 'العمليات المالية اليومية والتحصيل والمصروفات والتسويات والبنوك', PieChart],
  ]],
  ['التقارير', [
    ['/reports', 'accountingReports', 'التقارير والتحليلات والكشوف', BarChart3],
  ]],
  ['الخدمات', [
    ['/maintenance', 'maintenance', 'الصيانة والمرافق والتشغيل', Wrench],
  ]],
  ['العمولات', [
    ['/commissions', 'commissions', 'عمولات التحصيل والمبيعات المرتبطة بالمصادر', BadgeDollarSign, 'commissions.view'],
  ]],
  ['الإعدادات', [
    ['/settings', 'settings', 'إعدادات الشركة والمستخدمين والنظام', Settings, 'settings.manage'],
  ]],
];

/** Child destinations stay grouped under their domain while retaining their canonical routes. */
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
    ['/utilities', 'utilities', 'المرافق والعدادات', Zap],
  ],
  '/commissions': [],
  '/settings': [
    ['/system', 'system', 'المستخدمون والصلاحيات وإعدادات النظام والحوكمة', ShieldCheck, 'system.view'],
    ['/automation', 'automation', 'الأتمتة', Settings2, 'automation.view'],
  ],
};

export function getAllNavItems(): readonly NavItem[] {
  const topLevel = navGroups.flatMap((group) => group[1]);
  const children = Object.values(workspaceChildNavItems).flat();
  return [...topLevel, ...children];
}

// The mobile shell intentionally exposes only Menu + Search. Kept as an empty
// compatibility export for consumers/tests that imported the former 5-item model.
export const mobileNavItems: readonly MobileNavItem[] = [];

export const quickCreateItems: readonly MobileNavItem[] = [
  ['/contracts/new', 'newContract', FileText, 'contracts.write'],
  ['/properties/new', 'newProperty', Building2, 'properties.write'],
  ['/people/new', 'newPerson', UserPlus],
];
