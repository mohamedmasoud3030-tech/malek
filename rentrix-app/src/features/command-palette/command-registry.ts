import type { AppPermission } from '@/features/auth/permissions';
import {
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  Building,
  Building2,
  ClipboardList,
  ContactRound,
  DoorOpen,
  FileCheck,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  HandCoins,
  KeyRound,
  Landmark,
  LayoutDashboard,
  MessageSquareText,
  PieChart,
  ReceiptText,
  Settings,
  Settings2,
  UserRoundCog,
  Users,
  WalletCards,
  Wrench,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface StaticCommand {
  id: string;
  title: string;
  category: 'navigation' | 'financial' | 'operational' | 'system';
  canonicalRoute: string;
  search?: Record<string, string>;
  permission: AppPermission | null;
  keywords: string[];
  icon: LucideIcon;
}

/**
 * Global Command Center destinations follow the same task-centric IA as the
 * app shell. Entity search may still open a specific detail route directly,
 * but static navigation must never reintroduce module-hopping list pages.
 */
export const STATIC_COMMANDS: StaticCommand[] = [
  {
    id: 'dashboard', title: 'اليوم', category: 'navigation', canonicalRoute: '/dashboard', permission: null,
    keywords: ['اليوم', 'الرئيسية', 'لوحة التحكم', 'المطلوب الآن', 'dashboard', 'home'], icon: LayoutDashboard,
  },
  {
    id: 'properties', title: 'المحفظة — العقارات', category: 'navigation', canonicalRoute: '/properties', permission: null,
    keywords: ['المحفظة', 'العقارات', 'عقار', 'مباني', 'properties', 'portfolio'], icon: Building2,
  },
  {
    id: 'units', title: 'المحفظة — الوحدات', category: 'navigation', canonicalRoute: '/properties',
    search: { section: 'units' }, permission: null,
    keywords: ['الوحدات', 'وحدة', 'الشقق', 'الإشغال', 'units'], icon: DoorOpen,
  },
  {
    id: 'lands', title: 'المحفظة — الأراضي', category: 'navigation', canonicalRoute: '/properties',
    search: { section: 'lands' }, permission: 'lands.view',
    keywords: ['الأراضي', 'أرض', 'قطع الأراضي', 'lands', 'plots'], icon: Building,
  },
  {
    id: 'owners', title: 'المحفظة — الملاك', category: 'navigation', canonicalRoute: '/properties',
    search: { section: 'owners' }, permission: 'owners.hub.view',
    keywords: ['الملاك', 'المالك', 'أصحاب الأملاك', 'owners'], icon: UserRoundCog,
  },
  {
    id: 'contracts', title: 'التأجير — العقود', category: 'navigation', canonicalRoute: '/contracts', permission: null,
    keywords: ['التأجير', 'العقود', 'عقد إيجار', 'contracts', 'leases'], icon: FileText,
  },
  {
    id: 'tenants', title: 'التأجير — المستأجرون', category: 'navigation', canonicalRoute: '/contracts',
    search: { workspace: 'tenants' }, permission: null,
    keywords: ['المستأجرون', 'المستأجر', 'tenants'], icon: KeyRound,
  },
  {
    id: 'people', title: 'التأجير — جهات التعامل', category: 'navigation', canonicalRoute: '/contracts',
    search: { workspace: 'people' }, permission: null,
    keywords: ['الأشخاص', 'جهات التعامل', 'العملاء', 'people', 'contacts'], icon: Users,
  },
  {
    id: 'leads', title: 'التأجير — العملاء المحتملون', category: 'navigation', canonicalRoute: '/contracts',
    search: { workspace: 'leads' }, permission: 'leads.view',
    keywords: ['العملاء المحتملون', 'ليدز', 'leads', 'prospects'], icon: ContactRound,
  },
  {
    id: 'communication', title: 'التأجير — التواصل', category: 'navigation', canonicalRoute: '/contracts',
    search: { workspace: 'communication' }, permission: 'communication.view',
    keywords: ['التواصل', 'المتابعات', 'اتصال', 'communication'], icon: MessageSquareText,
  },
  {
    id: 'money', title: 'المال — وضع المال', category: 'financial', canonicalRoute: '/financials', permission: null,
    keywords: ['المال', 'المالية', 'الوضع المالي', 'money', 'finance'], icon: PieChart,
  },
  {
    id: 'financial-invoices', title: 'المال — المستحقات والفواتير', category: 'financial', canonicalRoute: '/financials',
    search: { section: 'collections', view: 'invoices' }, permission: null,
    keywords: ['الفواتير', 'المستحقات', 'المطالبات', 'invoices', 'billing'], icon: FileSpreadsheet,
  },
  {
    id: 'financial-receipts', title: 'المال — التحصيل والإيصالات', category: 'financial', canonicalRoute: '/financials',
    search: { section: 'collections', view: 'receipts' }, permission: null,
    keywords: ['الإيصالات', 'التحصيل', 'سند قبض', 'receipts', 'payments'], icon: ReceiptText,
  },
  {
    id: 'financial-arrears', title: 'المال — المتأخرات', category: 'financial', canonicalRoute: '/financials',
    search: { section: 'collections', view: 'arrears' }, permission: 'arrears.view',
    keywords: ['المتأخرات', 'الديون', 'أعمار الديون', 'الذمم', 'arrears', 'overdue'], icon: ClipboardList,
  },
  {
    id: 'financial-expenses', title: 'المال — المصروفات', category: 'financial', canonicalRoute: '/financials',
    search: { section: 'expenses', view: 'expenses' }, permission: 'expenses.view',
    keywords: ['المصروفات', 'المصاريف', 'التكاليف', 'expenses', 'payables'], icon: WalletCards,
  },
  {
    id: 'commissions', title: 'المال — العمولات', category: 'financial', canonicalRoute: '/financials',
    search: { section: 'expenses', view: 'commissions' }, permission: 'commissions.view',
    keywords: ['العمولات', 'عمولة التسويق', 'عمولة التحصيل', 'commissions'], icon: BadgeDollarSign,
  },
  {
    id: 'financial-deposits', title: 'المال — تأمينات المستأجرين', category: 'financial', canonicalRoute: '/financials',
    search: { section: 'funds', view: 'deposits' }, permission: 'financial.deposits.view',
    keywords: ['التأمينات', 'الأمانات', 'الودائع', 'deposits', 'custody'], icon: FileCheck,
  },
  {
    id: 'financial-owner-settlements', title: 'المال — مستحقات وتسويات الملاك', category: 'financial', canonicalRoute: '/financials',
    search: { section: 'funds', view: 'owner_settlements' }, permission: 'financial.owner_settlements.view',
    keywords: ['تسويات الملاك', 'حساب الملاك', 'المستحقات', 'settlements'], icon: HandCoins,
  },
  {
    id: 'financial-bank-reconciliation', title: 'المال — البنوك والمطابقة', category: 'financial', canonicalRoute: '/financials',
    search: { section: 'banking', view: 'bank_reconciliation' }, permission: 'financial.bank_reconciliation.view',
    keywords: ['البنوك', 'المطابقة البنكية', 'كشف الحساب', 'reconciliation', 'banking'], icon: Landmark,
  },
  {
    id: 'maintenance', title: 'الخدمات — الصيانة', category: 'operational', canonicalRoute: '/maintenance',
    search: { section: 'maintenance' }, permission: 'maintenance.view',
    keywords: ['الخدمات', 'الصيانة', 'الأعطال', 'طلبات الصيانة', 'maintenance', 'services'], icon: Wrench,
  },
  {
    id: 'service-providers', title: 'الخدمات — مزودو الخدمات', category: 'operational', canonicalRoute: '/maintenance',
    search: { section: 'service_providers' }, permission: 'service_providers.view',
    keywords: ['مزودو الخدمات', 'المزودين', 'الفنيين', 'service providers', 'vendors'], icon: BriefcaseBusiness,
  },
  {
    id: 'utilities', title: 'الخدمات — المرافق والعدادات', category: 'operational', canonicalRoute: '/maintenance',
    search: { section: 'utilities' }, permission: null,
    keywords: ['المرافق', 'العدادات', 'الكهرباء', 'المياه', 'utilities', 'meters'], icon: Zap,
  },
  {
    id: 'documents', title: 'الخدمات — المستندات التشغيلية', category: 'operational', canonicalRoute: '/maintenance',
    search: { section: 'documents_vault' }, permission: null,
    keywords: ['المستندات', 'الوثائق', 'المرفقات', 'documents', 'vault'], icon: FolderKanban,
  },
  {
    id: 'reports', title: 'التقارير والكشوف', category: 'navigation', canonicalRoute: '/reports',
    permission: 'financial.reports.view',
    keywords: ['التقارير', 'المحاسبة', 'الأستاذ العام', 'كشف الحساب', 'reports', 'accounting'], icon: BarChart3,
  },
  {
    id: 'settings', title: 'الإعدادات', category: 'system', canonicalRoute: '/settings', permission: null,
    keywords: ['الإعدادات', 'إعدادات النظام', 'settings', 'configuration'], icon: Settings,
  },
  {
    id: 'automation', title: 'الإعدادات — الأتمتة', category: 'system', canonicalRoute: '/settings',
    search: { section: 'automation' }, permission: 'automation.view',
    keywords: ['الأتمتة', 'التنبيهات', 'automation', 'rules'], icon: Settings2,
  },
];
