import type { ComponentType } from 'react';
import {
  Building2,
  FileText,
  Receipt,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import type { ReportSectionId } from '../reports-page.sections';
import type { ReportViewId } from '../report-view-registry';

/**
 * WP-C — the report directory model, separated from its presentation.
 *
 * This is a navigation index only: each entry names a `(section, view)` pair
 * owned by the report view registry. It contains no data queries, no monetary
 * values and no report bodies — opening an entry navigates, it never fetches.
 */
export type ReportShortcut = Readonly<{
  label: string;
  section: ReportSectionId;
  view: ReportViewId;
}>;

export type ReportGroup = Readonly<{
  id: 'finance' | 'leases' | 'owners' | 'tenants' | 'properties' | 'control';
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
    description: 'التحصيل، المتأخرات، المصروفات وملخص الأداء المالي للفترة.',
    icon: Receipt,
    section: 'analytics',
    view: 'collections',
    matches: ['overview', 'collections', 'overdue', 'expenses'],
    shortcuts: [
      { label: 'ملخص الأداء', section: 'analytics', view: 'overview' },
      { label: 'التحصيل', section: 'analytics', view: 'collections' },
      { label: 'المتأخرات', section: 'analytics', view: 'overdue' },
      { label: 'المصروفات', section: 'analytics', view: 'expenses' },
    ],
  },
  {
    id: 'leases',
    title: 'العقود والإيجارات',
    description: 'الإشغال، العقود النشطة والقريبة من الانتهاء والوحدات الشاغرة.',
    icon: FileText,
    section: 'analytics',
    view: 'occupancy',
    matches: ['occupancy'],
    shortcuts: [
      { label: 'الإشغال والشواغر', section: 'analytics', view: 'occupancy' },
      { label: 'العقود القريبة من الانتهاء', section: 'analytics', view: 'occupancy' },
    ],
  },
  {
    id: 'owners',
    title: 'الملاك',
    description: 'كشف المالك، الحركة، الاستقطاعات وصافي المستحق للفترة.',
    icon: UsersRound,
    section: 'statements',
    view: '',
    matches: [],
    shortcuts: [
      { label: 'كشف المالك', section: 'statements', view: '' },
    ],
  },
  {
    id: 'tenants',
    title: 'المستأجرون',
    description: 'كشف المستأجر، الفواتير، الرصيد والحركات المرتبطة بالعقد.',
    icon: UserRound,
    section: 'statements',
    view: '',
    matches: [],
    shortcuts: [
      { label: 'كشف المستأجر', section: 'statements', view: '' },
      { label: 'متأخرات المستأجرين', section: 'analytics', view: 'overdue' },
    ],
  },
  {
    id: 'properties',
    title: 'العقارات والوحدات',
    description: 'أداء العقار، الإشغال والمصروفات والصيانة عبر النطاق المحدد.',
    icon: Building2,
    section: 'analytics',
    view: 'property_analytics',
    matches: ['property_analytics', 'maintenance_analytics'],
    shortcuts: [
      { label: 'أداء العقار', section: 'analytics', view: 'property_analytics' },
      { label: 'الإشغال', section: 'analytics', view: 'occupancy' },
      { label: 'الصيانة', section: 'analytics', view: 'maintenance_analytics' },
      { label: 'المصروفات', section: 'analytics', view: 'expenses' },
    ],
  },
  {
    id: 'control',
    title: 'الرقابة والمطابقة',
    description: 'ميزان المراجعة، الأستاذ العام، التسويات والرقابة المحاسبية.',
    icon: ShieldCheck,
    section: 'accounting',
    view: 'accounting_reports',
    matches: ['accounting_reports', 'general_ledger', 'deferred_revenue'],
    shortcuts: [
      { label: 'القوائم المحاسبية', section: 'accounting', view: 'accounting_reports' },
      { label: 'دفتر الأستاذ', section: 'accounting', view: 'general_ledger' },
      { label: 'تسوية الإيرادات', section: 'accounting', view: 'deferred_revenue' },
    ],
  },
];

/** Total number of directly-openable report entries across all groups. */
export const REPORT_DIRECTORY_ENTRY_COUNT = reportGroups.reduce(
  (total, group) => total + group.shortcuts.length,
  0,
);

/**
 * Arabic-tolerant directory search: matches a group title, its description or
 * any of its shortcut labels. Diacritics and tatweel are stripped so that a
 * partially-vocalised query still finds its report.
 */
export function filterReportGroups(groups: readonly ReportGroup[], query: string): readonly ReportGroup[] {
  const normalized = normalizeArabicQuery(query);
  if (!normalized) return groups;
  return groups.filter(
    (group) =>
      normalizeArabicQuery(group.title).includes(normalized)
      || normalizeArabicQuery(group.description).includes(normalized)
      || group.shortcuts.some((shortcut) => normalizeArabicQuery(shortcut.label).includes(normalized)),
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
