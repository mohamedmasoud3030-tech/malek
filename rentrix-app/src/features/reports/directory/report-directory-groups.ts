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
  | 'finance'
  | 'leases'
  | 'maintenance'
  | 'owners'
  | 'properties'
  | 'analytics';

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
 * Owner-facing report library. Accounting books deliberately do not appear
 * here: they remain an internal source of truth behind these outcomes.
 */
export const reportGroups: readonly ReportGroup[] = [
  {
    id: 'analytics',
    title: 'أداء المكتب',
    description: 'دخل المكتب ومصروفاته وصافي النتيجة والتحصيل مقارنة بالفترة السابقة.',
    icon: BarChart3,
    section: 'analytics',
    view: 'overview',
    matches: ['overview'],
    shortcuts: [
      { label: 'أداء المكتب', description: 'خلاصة واضحة للمؤشرات والاتجاهات خلال الفترة.', section: 'analytics', view: 'overview' },
    ],
  },
  {
    id: 'finance',
    title: 'التحصيل والمتأخرات',
    description: 'المحصل والمتبقي والمتأخرات والمصروفات التي تحتاج متابعة.',
    icon: Receipt,
    section: 'analytics',
    view: 'collections',
    matches: ['collections', 'overdue', 'expenses'],
    shortcuts: [
      { label: 'التحصيل والمتبقي', description: 'الإيجارات المحصلة والمتبقية خلال الفترة.', section: 'analytics', view: 'collections' },
      { label: 'المتأخرات', description: 'المبالغ المتأخرة والمدد والحالات ذات الأولوية.', section: 'analytics', view: 'overdue' },
      { label: 'المصروفات', description: 'المصروفات حسب الفترة والتصنيف والعقار والوحدة.', section: 'analytics', view: 'expenses' },
    ],
  },
  {
    id: 'leases',
    title: 'العقود والإشغال والشغور',
    description: 'العقود القريبة من الانتهاء ونسب الإشغال والشواغر ومتابعة التجديد.',
    icon: FileText,
    section: 'analytics',
    view: 'occupancy',
    matches: ['occupancy'],
    shortcuts: [
      { label: 'العقود والتجديدات', description: 'متابعة العقود ضمن نوافذ 30/60/90 يوم وقرارات التجديد.', section: 'analytics', view: 'occupancy' },
      { label: 'الإشغال والشغور', description: 'الوحدات المشغولة والشاغرة واتجاه الإشغال.', section: 'analytics', view: 'occupancy' },
    ],
  },
  {
    id: 'maintenance',
    title: 'المصروفات والصيانة والخدمات',
    description: 'طلبات الصيانة وتكلفتها وحالاتها وما يرتبط بها من تشغيل ومرافق.',
    icon: Wrench,
    section: 'analytics',
    view: 'maintenance_analytics',
    matches: ['maintenance_analytics', 'expenses'],
    shortcuts: [
      { label: 'المصروفات والصيانة', description: 'الحالات والأولويات والتكلفة حسب العقار والوحدة.', section: 'analytics', view: 'maintenance_analytics' },
      { label: 'مصروفات التشغيل', description: 'تفصيل المصروفات حسب الفترة والتصنيف والنطاق.', section: 'analytics', view: 'expenses' },
    ],
  },
  {
    id: 'owners',
    title: 'كشوف الملاك والمستأجرين',
    description: 'كشف مفهوم للحركة والمستحقات والمدفوعات والاستقطاعات والرصيد.',
    icon: UsersRound,
    section: 'statements',
    view: '',
    matches: [],
    shortcuts: [
      { label: 'كشف المالك', description: 'الحركة والمستحقات والاستقطاعات وصافي المستحق للفترة.', section: 'statements', view: '' },
      { label: 'كشف المستأجر', description: 'الفواتير والمدفوعات والرصيد والحركة المرتبطة بالعقد.', section: 'statements', view: '' },
    ],
  },
  {
    id: 'properties',
    title: 'أداء العقارات والوحدات',
    description: 'الإشغال والتحصيل والمصروفات والصيانة لكل عقار ووحدة.',
    icon: Building2,
    section: 'analytics',
    view: 'property_analytics',
    matches: ['property_analytics', 'occupancy'],
    shortcuts: [
      { label: 'أداء العقار', description: 'خلاصة تشغيلية ومالية للعقار المحدد ثم تفاصيله.', section: 'analytics', view: 'property_analytics' },
      { label: 'أداء الوحدات والإشغال', description: 'الإشغال والشواغر على مستوى العقار والوحدات.', section: 'analytics', view: 'occupancy' },
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
