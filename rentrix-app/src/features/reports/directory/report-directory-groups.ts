import type { ComponentType } from 'react';
import {
  BarChart3,
  Building2,
  FileText,
  Receipt,
  ShieldCheck,
  UsersRound,
  Wrench,
} from 'lucide-react';
import type { ReportSectionId } from '../reports-page.sections';
import type { ReportViewId } from '../report-view-registry';

export type ReportShortcut = Readonly<{
  label: string;
  description: string;
  section: ReportSectionId;
  view: ReportViewId;
}>;

export type ReportGroupId =
  | 'finance'
  | 'leases'
  | 'maintenance'
  | 'owners'
  | 'properties'
  | 'analytics'
  | 'control';

export type ReportGroup = Readonly<{
  id: ReportGroupId;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  section: ReportSectionId;
  view: ReportViewId;
  matches: readonly ReportViewId[];
  shortcuts: readonly ReportShortcut[];
}>;

export const reportGroups: readonly ReportGroup[] = [
  {
    id: 'finance',
    title: 'المالية والتحصيل',
    description: 'التحصيل، المتأخرات، المصروفات والأرصدة والقوائم المالية.',
    icon: Receipt,
    section: 'analytics',
    view: 'collections',
    matches: ['collections', 'overdue', 'expenses'],
    shortcuts: [
      { label: 'كشف التحصيل', description: 'الإيجارات المحصلة والمتبقية خلال الفترة.', section: 'analytics', view: 'collections' },
      { label: 'المتأخرات والأرصدة', description: 'تعتيق الذمم والمبالغ المتأخرة والمدد.', section: 'analytics', view: 'overdue' },
      { label: 'المصروفات', description: 'المصروفات حسب الفترة والتصنيف والنطاق.', section: 'analytics', view: 'expenses' },
      { label: 'القوائم المحاسبية', description: 'ميزان المراجعة والقوائم من المصدر المحاسبي المعتمد.', section: 'accounting', view: 'accounting_reports' },
    ],
  },
  {
    id: 'leases',
    title: 'التأجير والإشغال',
    description: 'العقود النشطة والمنتهية قريبًا والشواغر ونسب الإشغال.',
    icon: FileText,
    section: 'analytics',
    view: 'occupancy',
    matches: ['occupancy'],
    shortcuts: [
      { label: 'انتهاء العقود والتجديد', description: 'متابعة العقود ضمن نوافذ 30/60/90 يوم.', section: 'analytics', view: 'occupancy' },
      { label: 'الشواغر والإشغال', description: 'الوحدات المشغولة والشاغرة ونسبة الإشغال.', section: 'analytics', view: 'occupancy' },
    ],
  },
  {
    id: 'maintenance',
    title: 'الصيانة والمرافق',
    description: 'حجم طلبات الصيانة وتكلفتها وأداء الإغلاق حسب العقار والوحدة.',
    icon: Wrench,
    section: 'analytics',
    view: 'maintenance_analytics',
    matches: ['maintenance_analytics'],
    shortcuts: [
      { label: 'تقرير الصيانة', description: 'الطلبات والحالات والأولويات والتكلفة حسب النطاق.', section: 'analytics', view: 'maintenance_analytics' },
    ],
  },
  {
    id: 'owners',
    title: 'تقارير الملاك',
    description: 'كشف حساب المالك والحركة والاستقطاعات وصافي المستحق.',
    icon: UsersRound,
    section: 'statements',
    view: '',
    matches: [],
    shortcuts: [
      { label: 'كشف حساب المالك', description: 'حركة المالك للفترة مع المستحقات والاستقطاعات والرصيد.', section: 'statements', view: '' },
      { label: 'كشف حساب المستأجر', description: 'الفواتير والمدفوعات والرصيد والحركة المرتبطة بالعقد.', section: 'statements', view: '' },
    ],
  },
  {
    id: 'properties',
    title: 'العقارات والوحدات',
    description: 'أداء كل عقار ووحداته والإشغال والتحصيل والمصروفات والصيانة.',
    icon: Building2,
    section: 'analytics',
    view: 'property_analytics',
    matches: ['property_analytics'],
    shortcuts: [
      { label: 'تقرير أداء العقار', description: 'ملخص تشغيلي ومالي للعقار المحدد.', section: 'analytics', view: 'property_analytics' },
      { label: 'الإشغال حسب العقار', description: 'نسب الإشغال والشواغر على مستوى العقار.', section: 'analytics', view: 'occupancy' },
    ],
  },
  {
    id: 'analytics',
    title: 'التحليلات المتقدمة',
    description: 'صورة أداء مجمعة واتجاهات التحصيل والإشغال والمصروفات.',
    icon: BarChart3,
    section: 'analytics',
    view: 'overview',
    matches: ['overview'],
    shortcuts: [
      { label: 'نظرة عامة على الأداء', description: 'أهم مؤشرات الأداء خلال الفترة المحددة.', section: 'analytics', view: 'overview' },
    ],
  },
  {
    id: 'control',
    title: 'الرقابة والمطابقة',
    description: 'دفتر الأستاذ، التسويات والرقابة على الأرصدة والحركة المحاسبية.',
    icon: ShieldCheck,
    section: 'accounting',
    view: 'general_ledger',
    matches: ['accounting_reports', 'general_ledger', 'deferred_revenue'],
    shortcuts: [
      { label: 'دفتر الأستاذ', description: 'الحركة المحاسبية التفصيلية حسب الحساب والفترة.', section: 'accounting', view: 'general_ledger' },
      { label: 'تسوية الإيرادات', description: 'مراجعة الإيرادات المؤجلة وتسويتها.', section: 'accounting', view: 'deferred_revenue' },
    ],
  },
];

export const REPORT_DIRECTORY_ENTRY_COUNT = reportGroups.reduce(
  (total, group) => total + group.shortcuts.length,
  0,
);

export function filterReportGroups(groups: readonly ReportGroup[], query: string): readonly ReportGroup[] {
  const normalized = normalizeArabicQuery(query);
  if (!normalized) return groups;
  return groups.filter(
    (group) =>
      normalizeArabicQuery(group.title).includes(normalized)
      || normalizeArabicQuery(group.description).includes(normalized)
      || group.shortcuts.some((shortcut) =>
        normalizeArabicQuery(`${shortcut.label} ${shortcut.description}`).includes(normalized),
      ),
  );
}

function normalizeArabicQuery(value: string): string {
  return value
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLowerCase();
}
