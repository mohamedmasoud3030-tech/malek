import type { ComponentType } from 'react';
import {
  BarChart3,
  Building2,
  FileText,
  Receipt,
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
  | 'office'
  | 'collections'
  | 'leases'
  | 'maintenance'
  | 'owners'
  | 'properties';

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

/**
 * Owner-facing report library. It is deliberately organised by the decision
 * the office wants to make, not by the accounting/analytics adapter that
 * serves the report underneath.
 */
export const reportGroups: readonly ReportGroup[] = [
  {
    id: 'office',
    title: 'أداء المكتب',
    description: 'تحصيل مقابل المستحق، المتأخر، الإشغال، الشغور، العقود المعرضة للانتهاء، وأهم 5 تنبيهات.',
    icon: BarChart3,
    section: 'analytics',
    view: 'overview',
    matches: ['overview'],
    shortcuts: [
      { label: 'أداء المكتب', description: 'أهم مؤشرات الفترة واتجاهاتها بدون دفاتر أو قيود خام.', section: 'analytics', view: 'overview' },
    ],
  },
  {
    id: 'collections',
    title: 'التحصيل والمتأخرات',
    description: 'قائمة متابعة تنفيذية مرتبة حسب الخطر والقيمة والمسؤول، لا مجرد أرقام تعتيق.',
    icon: Receipt,
    section: 'analytics',
    view: 'collections',
    matches: ['collections', 'overdue', 'expenses'],
    shortcuts: [
      { label: 'التحصيل', description: 'الإيجارات المحصلة والمتبقية خلال الفترة.', section: 'analytics', view: 'collections' },
      { label: 'المتأخرات', description: 'المبالغ المتأخرة ومدد التأخير والحالات التي تحتاج متابعة.', section: 'analytics', view: 'overdue' },
      { label: 'المصروفات', description: 'المصروفات حسب الفترة والتصنيف والنطاق.', section: 'analytics', view: 'expenses' },
    ],
  },
  {
    id: 'leases',
    title: 'العقود والإشغال والشغور',
    description: 'Forecast للتجديدات والشغور: المنتهي قريبًا، احتمالية الشغور، وقيمة الإيجار المعرضة للخطر.',
    icon: FileText,
    section: 'analytics',
    view: 'occupancy',
    matches: ['occupancy'],
    shortcuts: [
      { label: 'العقود والتجديدات', description: 'العقود التي تقترب من الانتهاء وتحتاج قرار تجديد.', section: 'analytics', view: 'occupancy' },
      { label: 'الإشغال والشغور', description: 'الوحدات المشغولة والشاغرة ونسبة الإشغال.', section: 'analytics', view: 'occupancy' },
    ],
  },
  {
    id: 'maintenance',
    title: 'المصروفات والصيانة',
    description: 'طلبات الصيانة وحالاتها وتكلفتها وأداء الإغلاق والخدمات المرتبطة بالتشغيل.',
    icon: Wrench,
    section: 'analytics',
    view: 'maintenance_analytics',
    matches: ['maintenance_analytics', 'services'],
    shortcuts: [
      { label: 'الصيانة', description: 'الطلبات والحالات والأولويات والتكلفة حسب النطاق.', section: 'analytics', view: 'maintenance_analytics' },
      { label: 'الخدمات والمرافق', description: 'فواتير الخدمات، جهة التحمل، المدفوع والمتبقي وإثباتات الدفع.', section: 'analytics', view: 'services' },
      { label: 'مصروفات التشغيل', description: 'المصروفات المرتبطة بالتشغيل خلال الفترة.', section: 'analytics', view: 'expenses' },
    ],
  },
  {
    id: 'owners',
    title: 'الملاك والمستأجرون',
    description: 'كشوف واضحة للحركة والرصيد والاستقطاعات والمدفوعات والتسويات لكل طرف.',
    icon: UsersRound,
    section: 'statements',
    view: '',
    matches: [],
    shortcuts: [
      { label: 'كشف المالك', description: 'حركة المالك للفترة مع المستحقات والاستقطاعات والرصيد.', section: 'statements', view: '' },
      { label: 'كشف المستأجر', description: 'الفواتير والمدفوعات والرصيد والحركة المرتبطة بالعقد.', section: 'statements', view: '' },
      { label: 'التسويات', description: 'راجع تسويات الأطراف ضمن نفس الكشف بدل فتح دفتر محاسبي منفصل.', section: 'statements', view: '' },
    ],
  },
  {
    id: 'properties',
    title: 'العقارات والوحدات',
    description: 'أداء العقار والوحدات من ناحية الإشغال والتحصيل والمصروفات والصيانة.',
    icon: Building2,
    section: 'analytics',
    view: 'property_analytics',
    matches: ['property_analytics'],
    shortcuts: [
      { label: 'أداء العقار', description: 'ملخص تشغيلي ومالي للعقار المحدد.', section: 'analytics', view: 'property_analytics' },
      { label: 'أداء الوحدة', description: 'الوحدات داخل العقار ومؤشرات الإشغال والتحصيل المرتبطة بها من نفس مصدر التقرير.', section: 'analytics', view: 'property_analytics' },
      { label: 'الإشغال حسب العقار', description: 'نسب الإشغال والشواغر على مستوى العقار ووحداته.', section: 'analytics', view: 'occupancy' },
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