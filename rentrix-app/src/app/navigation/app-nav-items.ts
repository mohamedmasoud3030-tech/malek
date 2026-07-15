import { BadgeDollarSign, BarChart3, Bot, Building2, ContactRound, DoorOpen, FileText, FolderKanban, LayoutDashboard, ListChecks, MapPinned, MessageSquareText, SearchCheck, Settings, Settings2, ShieldCheck, UserRoundCog, Users, WalletCards, Wrench, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppPermission } from '@/features/auth/permissions';

export type NavItem = readonly [to: string, labelKey: string, description: string, Icon: LucideIcon, permission?: AppPermission];
export type MobileNavItem = readonly [to: string, labelKey: string, Icon: LucideIcon, permission?: AppPermission];
export type NavGroup = readonly [sectionTitle: string, items: readonly NavItem[], adminOnly?: boolean];

export const navGroups: readonly NavGroup[] = [
  ['نظرة عامة', [['/', 'dashboard', 'ملخص الأداء اليومي', LayoutDashboard]]],
  ['الأصول والعلاقات', [
    ['/properties', 'properties', 'ملفات العقارات والأصول', Building2],
    ['/units', 'units', 'كل الوحدات وحالات الإشغال', DoorOpen],
    ['/lands', 'lands', 'إدارة قطع الأراضي ومتابعة حالتها', MapPinned, 'lands.view'],
    ['/documents-vault', 'documentsVault', 'أرشيف المستندات وخزينة المرفقات', FolderKanban],
    ['/people', 'people', 'دليل جهات التعامل', Users],
    ['/owners', 'owners', 'إدارة ملفات الملاك وعلاقات الملكية', UserRoundCog, 'owners.hub.view'],
    ['/tenants', 'tenants', 'بيانات المستأجرين', Users],
  ]],
  ['التشغيل اليومي', [
    ['/contracts', 'contracts', 'العقود والتجديدات', FileText],
    ['/maintenance', 'maintenance', 'طلبات الصيانة والمتابعة', Wrench, 'maintenance.view'],
    ['/utilities', 'utilities', 'عدادات الكهرباء والمياه وفواتير المرافق', Zap],
    ['/communication', 'communication', 'سجل التواصل والمتابعات التشغيلية', MessageSquareText, 'communication.view'],
    ['/automation', 'automation', 'تذكيرات العقود والإيجار وتنبيهات التشغيل', Settings2, 'communication.view'],
  ]],
  ['الماليات والمحاسبة', [
    ['/financials', 'financials', 'مركز إدارة الفواتير، الإيصالات، المصاريف، والمتأخرات', WalletCards],
  ]],
  ['التحليل والنمو', [
    [
      '/reports',
      'reportsAndStatements',
      'مركز التقارير والكشوفات التنفيذية الشاملة',
      BarChart3,
    ],
    [
      '/ai-assistant',
      'aiAssistant',
      'مساعد قراءة فقط لتلخيص المتأخرات والتجديدات واللقطات المالية',
      Bot,
    ],
    ['/leads', 'leads', 'مصادر العملاء المحتملين والتحويلات', ContactRound, 'leads.view'],
    ['/commissions', 'commissions', 'تتبع عمولات المكتب وحالات الاستحقاق', BadgeDollarSign, 'commissions.view'],
  ]],
  ['الإعدادات والحوكمة', [
    ['/settings', 'settings', 'مركز تحكم المكتب، الهوية، الأمان، وسجلات الحوكمة', Settings, 'settings.manage'],
    ['/audit-log', 'auditLog', 'سجل أحداث الحوكمة والعمليات', ListChecks, 'audit.view'],
    ['/data-integrity', 'dataIntegrity', 'فحوصات سلامة البيانات والتطابق', SearchCheck, 'integrity.view'],
    ['/system', 'system', 'إدارة حوكمة النظام وإسناد الأدوار', ShieldCheck, 'system.view'],
  ]],
];

export const mobileNavItems: readonly MobileNavItem[] = [
  ['/', 'dashboard', LayoutDashboard],
  ['/properties', 'properties', Building2],
  ['/contracts', 'contracts', FileText],
  ['/financials', 'financials', WalletCards],
  ['/reports', 'reports', BarChart3],
];

export const quickLinks = [
  ['/properties', 'العقارات', Building2],
  ['/people', 'الأشخاص', Users],
  ['/contracts', 'العقود', FileText],
  ['/financials', 'المالية', WalletCards],
] as const;

export type QuickLinkRoute = (typeof quickLinks)[number][0];
