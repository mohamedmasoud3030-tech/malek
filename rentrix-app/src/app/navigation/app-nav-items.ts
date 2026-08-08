import { BarChart3, Bot, Building2, ContactRound, DoorOpen, FileText, FolderKanban, KeyRound, LayoutDashboard, ListChecks, MapPinned, MessageSquareText, PieChart, SearchCheck, Settings, Settings2, ShieldCheck, UserCheck, UserPlus, UserRoundCog, Users, Wrench, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppPermission } from '@/features/auth/permissions';

export type NavItem = readonly [to: string, labelKey: string, description: string, Icon: LucideIcon, permission?: AppPermission];
export type MobileNavItem = readonly [to: string, labelKey: string, Icon: LucideIcon, permission?: AppPermission];
export type NavGroup = readonly [sectionTitle: string, items: readonly NavItem[], adminOnly?: boolean];

/**
 * Daily-work primary navigation.
 *
 * Core business entities are direct destinations: properties, owners, tenants,
 * and contracts. Secondary operational tools stay inside their natural
 * workspaces. Finance is intentionally one primary destination and accounting /
 * reporting is one primary destination; the legacy finance routes remain valid
 * internally and for bookmarks but no longer compete in the sidebar.
 */
export const navGroups: readonly NavGroup[] = [
  ['الرئيسية', [
    ['/dashboard', 'dashboard', 'ملخص الأداء اليومي وما يحتاج متابعة', LayoutDashboard],
  ]],
  ['إدارة العقارات', [
    ['/properties', 'properties', 'العقارات والوحدات والأراضي', Building2],
    ['/owners', 'owners', 'ملفات الملاك وعلاقات الملكية', UserRoundCog, 'owners.hub.view'],
    ['/tenants', 'tenants', 'ملفات المستأجرين والعقود المرتبطة', UserCheck],
    ['/contracts', 'contracts', 'العقود والتجديدات ودورة الحياة', FileText],
  ]],
  ['التشغيل', [
    ['/maintenance', 'maintenance', 'الصيانة والمرافق والأتمتة والمستندات', Wrench],
  ]],
  ['المالية والمحاسبة', [
    ['/financials', 'financials', 'العمليات المالية اليومية والتحصيل والمصروفات والتسويات والبنوك', PieChart],
    ['/reports', 'accountingReports', 'المحاسبة ودفتر الأستاذ والتقارير والكشوف', BarChart3],
  ]],
  ['الأدوات', [
    ['/ai-assistant', 'aiAssistant', 'مساعد ذكي قراءة فقط للتلخيص والمتابعة', Bot],
  ]],
  ['الإدارة', [
    ['/settings', 'settings', 'إعدادات المكتب والمستخدمون والأمان والحوكمة', Settings, 'settings.manage'],
  ]],
];

/**
 * Secondary navigation is reserved for supporting tools, not core entities.
 * Owners and tenants therefore have no parent workspace tab.
 */
export const workspaceChildNavItems: Record<string, readonly NavItem[]> = {
  '/properties': [
    ['/units', 'units', 'كل الوحدات وحالات الإشغال', DoorOpen],
    ['/lands', 'lands', 'إدارة قطع الأراضي ومتابعة حالتها', MapPinned, 'lands.view'],
  ],
  '/owners': [],
  '/tenants': [],
  '/contracts': [
    ['/people', 'peopleDirectory', 'دليل جهات التعامل', Users],
    ['/leads', 'leads', 'مصادر العملاء المحتملين والتحويلات', ContactRound, 'leads.view'],
    ['/communication', 'communication', 'سجل التواصل والمتابعات التشغيلية', MessageSquareText, 'communication.view'],
  ],
  '/maintenance': [
    ['/utilities', 'utilities', 'عدادات الكهرباء والمياه وفواتير المرافق', Zap],
    ['/automation', 'automation', 'تذكيرات العقود والإيجار وتنبيهات التشغيل', Settings2, 'automation.view'],
    ['/documents-vault', 'documentsVault', 'أرشيف المستندات وخزينة المرفقات', FolderKanban],
  ],
  '/financials': [],
  '/reports': [],
  '/ai-assistant': [],
  '/settings': [
    ['/change-password', 'changePassword', 'تغيير كلمة مرور الحساب', KeyRound, 'auth.password.change'],
    ['/audit-log', 'auditLog', 'سجل أحداث الحوكمة والعمليات', ListChecks, 'audit.view'],
    ['/data-integrity', 'dataIntegrity', 'فحوصات سلامة البيانات والتطابق', SearchCheck, 'integrity.view'],
    ['/system', 'system', 'إدارة النظام والمستخدمين والأدوار', ShieldCheck, 'system.view'],
  ],
};

export function getAllNavItems(): readonly NavItem[] {
  const topLevel = navGroups.flatMap((group) => group[1]);
  const children = Object.values(workspaceChildNavItems).flat();
  return [...topLevel, ...children];
}

// Five highest-frequency mobile destinations. Owners and the remaining tools
// stay directly available in the full drawer without restoring a second nav bar.
export const mobileNavItems: readonly MobileNavItem[] = [
  ['/dashboard', 'dashboard', LayoutDashboard],
  ['/properties', 'properties', Building2],
  ['/tenants', 'tenants', UserCheck],
  ['/contracts', 'contracts', FileText],
  ['/financials', 'financials', PieChart],
];

export const quickCreateItems: readonly MobileNavItem[] = [
  ['/contracts/new', 'newContract', FileText, 'contracts.write'],
  ['/properties/new', 'newProperty', Building2, 'properties.write'],
  ['/people/new', 'newPerson', UserPlus],
];
