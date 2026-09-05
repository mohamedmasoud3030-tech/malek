import type { AppPermission } from '@/features/auth/permissions';
import {
  BarChart3,
  Building2,
  ClipboardList,
  DoorOpen,
  FileSpreadsheet,
  FileText,
  KeyRound,
  LayoutDashboard,
  PieChart,
  ReceiptText,
  Settings,
  UserRoundCog,
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
 * Static commands follow the routine task-centric IA. Concrete entity search
 * can still open a record directly; specialist registers are contextual/deep-link
 * capabilities rather than global navigation destinations.
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
    id: 'maintenance', title: 'الخدمات — الصيانة', category: 'operational', canonicalRoute: '/maintenance',
    search: { section: 'maintenance' }, permission: 'maintenance.view',
    keywords: ['الخدمات', 'الصيانة', 'الأعطال', 'طلبات الصيانة', 'maintenance', 'services'], icon: Wrench,
  },
  {
    id: 'utilities', title: 'الخدمات — المرافق والعدادات', category: 'operational', canonicalRoute: '/maintenance',
    search: { section: 'utilities' }, permission: null,
    keywords: ['المرافق', 'العدادات', 'الكهرباء', 'المياه', 'utilities', 'meters'], icon: Zap,
  },
  {
    id: 'reports', title: 'التقارير', category: 'navigation', canonicalRoute: '/reports',
    permission: 'financial.reports.view',
    keywords: ['التقارير', 'التحليلات', 'المحاسبة', 'الأستاذ العام', 'reports', 'accounting'], icon: BarChart3,
  },
  {
    id: 'settings', title: 'الإعدادات', category: 'system', canonicalRoute: '/settings', permission: null,
    keywords: ['الإعدادات', 'إعدادات النظام', 'settings', 'configuration'], icon: Settings,
  },
];