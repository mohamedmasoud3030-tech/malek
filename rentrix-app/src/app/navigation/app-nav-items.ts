import { BadgeDollarSign, BarChart3, Bot, Building2, ClipboardList, ContactRound, DoorOpen, FileCheck, FileSpreadsheet, FileText, FolderKanban, HandCoins, KeyRound, Landmark, LayoutDashboard, ListChecks, MapPinned, MessageSquareText, PieChart, ReceiptText, SearchCheck, Settings, Settings2, ShieldCheck, UserCheck, UserPlus, UserRoundCog, Users, WalletCards, Wrench, Zap } from 'lucide-react';
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
  ['المحفظة العقارية', [
    ['/properties', 'properties', 'ملفات العقارات والأصول', Building2],
    ['/units', 'units', 'كل الوحدات وحالات الإشغال', DoorOpen],
    ['/lands', 'lands', 'إدارة قطع الأراضي ومتابعة حالتها', MapPinned, 'lands.view'],
  ]],
  ['العلاقات والعملاء', [
    ['/owners', 'owners', 'إدارة ملفات الملاك وعلاقات الملكية', UserRoundCog, 'owners.hub.view'],
    ['/tenants', 'tenants', 'بيانات المستأجرين', UserCheck],
    ['/people', 'peopleDirectory', 'دليل جهات التعامل', Users],
    ['/leads', 'leads', 'مصادر العملاء المحتملين والتحويلات', ContactRound, 'leads.view'],
    ['/communication', 'communication', 'سجل التواصل والمتابعات التشغيلية', MessageSquareText, 'communication.view'],
  ]],
  ['العقود والتشغيل', [
    ['/contracts', 'contracts', 'العقود والتجديدات', FileText],
    ['/maintenance', 'maintenance', 'طلبات الصيانة والمتابعة', Wrench, 'maintenance.view'],
    ['/utilities', 'utilities', 'عدادات الكهرباء والمياه وفواتير المرافق', Zap],
    ['/automation', 'automation', 'تذكيرات العقود والإيجار وتنبيهات التشغيل', Settings2, 'automation.view'],
    ['/documents-vault', 'documentsVault', 'أرشيف المستندات وخزينة المرفقات', FolderKanban],
  ]],
  ['المالية', [
    ['/financials', 'financialOverview', 'نظرة شاملة على التحصيلات والمصروفات والذمم', PieChart],
    ['/invoices', 'invoices', 'مراجعة الفواتير وتسجيل دفعاتها', FileSpreadsheet],
    ['/receipts', 'receipts', 'سجل الإيصالات وطباعة سندات القبض', ReceiptText],
    ['/expenses', 'expenses', 'تسجيل ومراجعة نفقات العقارات', WalletCards, 'expenses.view'],
    ['/arrears', 'arrears', 'متابعة الذمم وأعمار الديون', ClipboardList, 'arrears.view'],
    ['/deposits', 'deposits', 'تتبع مبالغ أمانات وتأمينات المستأجرين', FileCheck, 'financial.deposits.view'],
    ['/owner-settlements', 'ownerSettlements', 'إعداد تسويات الملاك واعتمادها وصرفها', HandCoins, 'financial.owner_settlements.view'],
    ['/bank-reconciliation', 'bankReconciliation', 'مطابقة السجلات مع الحسابات البنكية', Landmark, 'financial.bank_reconciliation.view'],
    ['/commissions', 'commissions', 'تتبع عمولات المكتب وحالات الاستحقاق', BadgeDollarSign, 'commissions.view'],
  ]],
  ['التقارير والقرار', [
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
  ]],
  ['الإدارة والحوكمة', [
    ['/settings', 'settings', 'مركز تحكم المكتب، الهوية، الأمان، وسجلات الحوكمة', Settings, 'settings.manage'],
    ['/change-password', 'changePassword', 'تغيير كلمة مرور حسابك وإنهاء استخدام الكلمات الضعيفة', KeyRound, 'auth.password.change'],
    ['/audit-log', 'auditLog', 'سجل أحداث الحوكمة والعمليات', ListChecks, 'audit.view'],
    ['/data-integrity', 'dataIntegrity', 'فحوصات سلامة البيانات والتطابق', SearchCheck, 'integrity.view'],
    ['/system', 'system', 'إدارة حوكمة النظام وإسناد الأدوار', ShieldCheck, 'system.view'],
  ]],
];

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
