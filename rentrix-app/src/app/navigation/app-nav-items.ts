import { BadgeDollarSign, BarChart3, Bot, Building2, ContactRound, DoorOpen, FileText, FolderKanban, KeyRound, LayoutDashboard, ListChecks, MapPinned, MessageSquareText, PieChart, SearchCheck, Settings, Settings2, ShieldCheck, UserCheck, UserPlus, UserRoundCog, Users, Wrench, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppPermission } from '@/features/auth/permissions';

export type NavItem = readonly [to: string, labelKey: string, description: string, Icon: LucideIcon, permission?: AppPermission];
export type MobileNavItem = readonly [to: string, labelKey: string, Icon: LucideIcon, permission?: AppPermission];
export type NavGroup = readonly [sectionTitle: string, items: readonly NavItem[], adminOnly?: boolean];

/**
 * Phase 2 — Canonical IA (no redesign).
 *
 * Primary navigation now reflects the approved target IA:
 *   لوحة التحكم · الأشخاص · العقارات · الأراضي · العقود · المالية · التقارير · الخدمات · العمولات · الإعدادات
 * People and Lands are first-class; Commissions is standalone (not under Banking).
 * Reports is visually independent from Finance. Legacy ?section= aliases remain
 * for bookmarks but no longer define the sidebar.
 */
export const navGroups: readonly NavGroup[] = [
  ['الرئيسية', [
    ['/dashboard', 'dashboard', 'ملخص الأداء اليومي وما يحتاج متابعة', LayoutDashboard],
  ]],
  ['إدارة العقارات والأشخاص', [
    ['/people', 'peopleDirectory', 'دليل جهات التعامل والأشخاص', Users],
    ['/properties', 'properties', 'العقارات والوحدات', Building2],
    ['/lands', 'lands', 'الأراضي وقطع الأراضي', MapPinned, 'lands.view'],
    ['/owners', 'owners', 'ملفات الملاك وعلاقات الملكية', UserRoundCog, 'owners.hub.view'],
    ['/tenants', 'tenants', 'ملفات المستأجرين والعقود المرتبطة', UserCheck],
    ['/contracts', 'contracts', 'العقود والتجديدات ودورة الحياة', FileText],
  ]],
  ['التشغيل', [
    ['/maintenance', 'maintenance', 'الخدمات والصيانة والمرافق والأتمتة والمستندات', Wrench],
  ]],
  ['المالية', [
    ['/financials', 'financials', 'العمليات المالية اليومية والتحصيل والمصروفات والتسويات والبنوك', PieChart],
  ]],
  ['العمولات', [
    ['/commissions', 'commissions', 'عمولات التحصيل والمبيعات المرتبطة بالمصادر', BadgeDollarSign, 'commissions.view'],
  ]],
  ['التقارير', [
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
 * Phase 2: People and Lands are first-class (no longer children).
 */
export const workspaceChildNavItems: Record<string, readonly NavItem[]> = {
  '/people': [],
  '/properties': [
    ['/units', 'units', 'كل الوحدات وحالات الإشغال', DoorOpen],
  ],
  '/lands': [],
  '/owners': [],
  '/tenants': [],
  '/contracts': [
    ['/leads', 'leads', 'مصادر العملاء المحتملين والتحويلات', ContactRound, 'leads.view'],
    ['/communication', 'communication', 'سجل التواصل والمتابعات التشغيلية', MessageSquareText, 'communication.view'],
  ],
  '/maintenance': [
    ['/utilities', 'utilities', 'عدادات الكهرباء والمياه وفواتير المرافق', Zap],
    ['/automation', 'automation', 'تذكيرات العقود والإيجار وتنبيهات التشغيل', Settings2, 'automation.view'],
    ['/documents-vault', 'documentsVault', 'أرشيف المستندات وخزينة المرفقات', FolderKanban],
  ],
  '/financials': [],
  '/commissions': [],
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
