import { BadgeDollarSign, BarChart3, Bot, Building2, ClipboardList, ContactRound, DoorOpen, FileCheck, FileSpreadsheet, FileText, FolderKanban, HandCoins, Landmark, LayoutDashboard, ListChecks, MapPinned, MessageSquareText, PieChart, ReceiptText, SearchCheck, Settings, Settings2, ShieldCheck, UserCheck, UserRoundCog, Users, WalletCards, Wrench, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppPermission } from '@/features/auth/permissions';

export type NavItem = readonly [to: string, labelKey: string, description: string, Icon: LucideIcon, permission?: AppPermission];
export type MobileNavItem = readonly [to: string, labelKey: string, Icon: LucideIcon, permission?: AppPermission];
export type NavGroup = readonly [sectionTitle: string, items: readonly NavItem[], adminOnly?: boolean];

// UX overhaul (2026-07): groups now follow the daily work flow of a real-estate
// office — assets, parties, contracts & operations, money, analysis, governance.
// Every standalone financial workspace (/invoices, /receipts, /expenses,
// /arrears, /deposits, /bank-reconciliation) is a first-class sidebar entry
// instead of being buried inside the old /financials hub tabs.
export const navGroups: readonly NavGroup[] = [
  ['الرئيسية', [['/dashboard', 'dashboard', 'ملخص الأداء اليومي', LayoutDashboard]]],
  ['إدارة العقارات', [
    ['/properties', 'properties', 'ملفات العقارات والأصول', Building2],
    ['/units', 'units', 'كل الوحدات وحالات الإشغال', DoorOpen],
    ['/lands', 'lands', 'إدارة قطع الأراضي ومتابعة حالتها', MapPinned, 'lands.view'],
  ]],
  ['الأطراف', [
    ['/owners', 'owners', 'إدارة ملفات الملاك وعلاقات الملكية', UserRoundCog, 'owners.hub.view'],
    ['/tenants', 'tenants', 'بيانات المستأجرين', UserCheck],
    ['/people', 'peopleDirectory', 'دليل جهات التعامل', Users],
    ['/leads', 'leads', 'مصادر العملاء المحتملين والتحويلات', ContactRound, 'leads.view'],
  ]],
  ['العقود والتشغيل', [
    ['/contracts', 'contracts', 'العقود والتجديدات', FileText],
    ['/maintenance', 'maintenance', 'طلبات الصيانة والمتابعة', Wrench, 'maintenance.view'],
    ['/utilities', 'utilities', 'عدادات الكهرباء والمياه وفواتير المرافق', Zap],
    ['/automation', 'automation', 'تذكيرات العقود والإيجار وتنبيهات التشغيل', Settings2, 'communication.view'],
    ['/communication', 'communication', 'سجل التواصل والمتابعات التشغيلية', MessageSquareText, 'communication.view'],
  ]],
  ['المالية', [
    ['/financials', 'financialOverview', 'نظرة شاملة على التحصيلات والمصروفات والذمم', PieChart],
    ['/invoices', 'invoices', 'مراجعة الفواتير وتسجيل دفعاتها', FileSpreadsheet],
    ['/receipts', 'receipts', 'سجل الإيصالات وطباعة سندات القبض', ReceiptText],
    ['/expenses', 'expenses', 'تسجيل ومراجعة نفقات العقارات', WalletCards, 'expenses.write'],
    ['/arrears', 'arrears', 'متابعة الذمم وأعمار الديون', ClipboardList, 'arrears.view'],
    ['/deposits', 'deposits', 'تتبع مبالغ أمانات وتأمينات المستأجرين', FileCheck],
    ['/owner-settlements', 'ownerSettlements', 'إعداد تسويات الملاك واعتمادها وصرفها', HandCoins, 'financial.owner_settlements.approve'],
    ['/bank-reconciliation', 'bankReconciliation', 'مطابقة السجلات مع الحسابات البنكية', Landmark, 'financial.bank_reconciliation.view'],
  ]],
  ['التقارير والتحليل', [
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
    ['/commissions', 'commissions', 'تتبع عمولات المكتب وحالات الاستحقاق', BadgeDollarSign, 'commissions.view'],
  ]],
  ['المستندات والحوكمة', [
    ['/documents-vault', 'documentsVault', 'أرشيف المستندات وخزينة المرفقات', FolderKanban],
    ['/settings', 'settings', 'مركز تحكم المكتب، الهوية، الأمان، وسجلات الحوكمة', Settings, 'settings.manage'],
    ['/audit-log', 'auditLog', 'سجل أحداث الحوكمة والعمليات', ListChecks, 'audit.view'],
    ['/data-integrity', 'dataIntegrity', 'فحوصات سلامة البيانات والتطابق', SearchCheck, 'integrity.view'],
    ['/system', 'system', 'إدارة حوكمة النظام وإسناد الأدوار', ShieldCheck, 'system.view'],
  ]],
];

// Field-work first: dashboard, assets, contracts, maintenance, then the daily
// money loop (invoices + receipts) and reports. Everything else stays one tap
// away inside the mobile drawer.
export const mobileNavItems: readonly MobileNavItem[] = [
  ['/dashboard', 'dashboard', LayoutDashboard],
  ['/properties', 'properties', Building2],
  ['/contracts', 'contracts', FileText],
  ['/maintenance', 'maintenance', Wrench, 'maintenance.view'],
  ['/invoices', 'invoices', FileSpreadsheet],
  ['/receipts', 'receipts', ReceiptText],
  ['/reports', 'reports', BarChart3],
];
