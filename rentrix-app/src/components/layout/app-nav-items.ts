import { BadgeDollarSign, BarChart3, Building2, ClipboardList, ContactRound, DoorOpen, FileText, Landmark, LayoutDashboard, ListChecks, MapPinned, MessageSquareText, ReceiptText, SearchCheck, Settings, ShieldCheck, UserRoundCog, Users, WalletCards, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppPermission } from '@/features/auth/permissions';

export type NavItem = readonly [to: string, labelKey: string, description: string, Icon: LucideIcon, permission?: AppPermission];
export type MobileNavItem = readonly [to: string, labelKey: string, Icon: LucideIcon, permission?: AppPermission];
export type NavGroup = readonly [sectionTitle: string, items: readonly NavItem[]];

/**
 * The primary sidebar / mobile drawer navigation.
 *
 * Design rules (PR #929 polish):
 *  - Group titles are short, scannable, and never wrap on mobile.
 *  - Each entry opens a real, distinct route. We never show two sidebar items
 *    that point to the same route without a real tab / deep-link behavior.
 *    `/reports` and "Statements" therefore collapse into a single entry
 *    "مركز التقارير والكشوف" — the Reports page itself renders the
 *    التقارير and كشوف الحساب sections.
 *  - Change Password stays out of the sidebar; it lives in the
 *    الأمان والحساب section of /settings (see settings-page.tsx).
 *  - ADMIN routes are visible to ADMIN via the same `permission` gating the
 *    route itself uses; we never hide them from users who can access them.
 */
export const navGroups = [
  ['الرئيسية', [['/', 'dashboard', 'ملخص الأداء اليومي', LayoutDashboard]]],
  ['المحفظة', [
    ['/properties', 'properties', 'ملفات العقارات والأصول', Building2],
    ['/units', 'units', 'كل الوحدات وحالات الإشغال', DoorOpen],
    ['/lands', 'lands', 'إدارة قطع الأراضي ومتابعة حالتها', MapPinned, 'lands.view'],
  ]],
  ['الأطراف والعلاقات', [
    ['/people', 'people', 'دليل جهات التعامل', Users],
    ['/owners', 'owners', 'إدارة ملفات الملاك وعلاقات الملكية', UserRoundCog, 'owners.hub.view'],
    ['/tenants', 'tenants', 'بيانات المستأجرين', Users],
  ]],
  ['التشغيل والصيانة', [
    ['/contracts', 'contracts', 'العقود والتجديدات', FileText],
    ['/maintenance', 'maintenance', 'طلبات الصيانة والمتابعة', Wrench, 'maintenance.view'],
    ['/communication', 'communication', 'سجل التواصل الداخلي والمتابعات', MessageSquareText, 'communication.view'],
  ]],
  ['الماليات والتحصيل', [
    ['/invoices', 'invoices', 'الفواتير المستحقة', ReceiptText],
    ['/receipts', 'collectionsReceipts', 'التحصيلات والإيصالات', ReceiptText],
    ['/expenses', 'expenses', 'مصاريف العقارات التشغيلية', WalletCards],
    ['/arrears', 'arrears', 'متابعة المبالغ المتأخرة', ClipboardList],
    ['/bank-reconciliation', 'bankReconciliation', 'مطابقة حركات كشف البنك مع السجلات المالية', Landmark],
  ]],
  ['التقارير والتحليلات', [
    [
      '/reports',
      'reportsAndStatements',
      'تحصيلات، متأخرات، إشغال، وكشوف قراءة فقط',
      BarChart3,
    ],
  ]],
  ['المبيعات والعمولات', [
    ['/leads', 'leads', 'مصادر العملاء المحتملين والتحويلات', ContactRound, 'leads.view'],
    ['/commissions', 'commissions', 'تتبع عمولات المكتب كحالة تشغيلية فقط', BadgeDollarSign, 'commissions.view'],
  ]],
  ['الإعدادات والحساب', [
    ['/settings', 'settings', 'مركز تحكم المكتب، الهوية، الأمان، والحساب', Settings, 'settings.manage'],
  ]],
  ['إدارة النظام', [
    ['/audit-log', 'auditLog', 'سجل أحداث الحوكمة قراءة فقط', ListChecks, 'audit.view'],
    ['/data-integrity', 'dataIntegrity', 'فحوصات سلامة البيانات', SearchCheck, 'integrity.view'],
    ['/system', 'system', 'إدارة حوكمة النظام', ShieldCheck, 'system.view'],
  ]],
] as const satisfies readonly NavGroup[];

export const mobileNavItems = [
  ['/', 'dashboard', LayoutDashboard],
  ['/properties', 'properties', Building2],
  ['/people', 'people', Users],
  ['/contracts', 'contracts', FileText],
  ['/financials', 'financials', WalletCards],
] as const satisfies readonly MobileNavItem[];

export const quickLinks = [
  ['/properties/new', 'إضافة عقار', Building2],
  ['/people/new', 'إضافة شخص', Users],
  ['/contracts/new', 'إنشاء عقد', FileText],
] as const;

export type QuickLinkRoute = (typeof quickLinks)[number][0];
