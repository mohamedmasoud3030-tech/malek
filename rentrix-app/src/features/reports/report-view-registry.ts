import type { ComponentType } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Layers,
  Receipt,
  Scale,
  Wrench,
} from 'lucide-react';

/**
 * Single registry for every report view. `showInPrimaryNavigation` separates
 * daily report choices from specialist reports without deleting deep links.
 */
export type AccountingReportViewId = 'accounting_reports' | 'general_ledger' | 'deferred_revenue';

export type AnalyticsReportViewId =
  | 'overview'
  | 'collections'
  | 'overdue'
  | 'expenses'
  | 'property_analytics'
  | 'occupancy'
  | 'maintenance_analytics';

/** `''` is the statements section, which has no sub-views. */
export type ReportViewId = AccountingReportViewId | AnalyticsReportViewId | '';

export type ReportViewMeta = Readonly<{
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  showInPrimaryNavigation: boolean;
}>;

/**
 * Raw accounting output remains available to specialists and existing deep
 * links, but none of it competes with the owner-facing report directory.
 */
export const ACCOUNTING_REPORT_VIEWS = [
  { id: 'accounting_reports', label: 'ميزان المراجعة والقوائم', icon: Scale, showInPrimaryNavigation: false },
  { id: 'general_ledger', label: 'دفتر الأستاذ والشجرة', icon: BookOpenCheck, showInPrimaryNavigation: false },
  { id: 'deferred_revenue', label: 'تسوية الإيرادات', icon: Layers, showInPrimaryNavigation: false },
] as const satisfies readonly ReportViewMeta[];

export const ANALYTICS_REPORT_VIEWS = [
  { id: 'overview', label: 'نظرة عامة على الأداء', icon: LayoutDashboard, showInPrimaryNavigation: true },
  { id: 'collections', label: 'تحليلات التحصيل', icon: Receipt, showInPrimaryNavigation: true },
  { id: 'overdue', label: 'تعتيق المتأخرات', icon: AlertTriangle, showInPrimaryNavigation: true },
  { id: 'expenses', label: 'تحليلات المصروفات', icon: ClipboardList, showInPrimaryNavigation: true },
  { id: 'property_analytics', label: 'تحليلات العقارات', icon: Building2, showInPrimaryNavigation: false },
  { id: 'occupancy', label: 'تحليلات الإشغال', icon: Building2, showInPrimaryNavigation: false },
  { id: 'maintenance_analytics', label: 'تحليلات الصيانة', icon: Wrench, showInPrimaryNavigation: false },
] as const satisfies readonly ReportViewMeta[];

const ACCOUNTING_VIEW_IDS: readonly string[] = ACCOUNTING_REPORT_VIEWS.map((view) => view.id);
const ANALYTICS_VIEW_IDS: readonly string[] = ANALYTICS_REPORT_VIEWS.map((view) => view.id);

export const DEFAULT_ACCOUNTING_VIEW: AccountingReportViewId = 'accounting_reports';
export const DEFAULT_ANALYTICS_VIEW: AnalyticsReportViewId = 'overview';

export function isAccountingReportViewId(value: string): value is AccountingReportViewId {
  return ACCOUNTING_VIEW_IDS.includes(value);
}

export function isAnalyticsReportViewId(value: string): value is AnalyticsReportViewId {
  return ANALYTICS_VIEW_IDS.includes(value);
}

/** Every supported report view, including specialist/deep-link views. */
export function getReportSubViews(section: 'accounting' | 'statements' | 'analytics'): readonly ReportViewMeta[] {
  if (section === 'accounting') return ACCOUNTING_REPORT_VIEWS;
  if (section === 'analytics') return ANALYTICS_REPORT_VIEWS;
  return [];
}

/** Daily report choices shown as routine tabs. */
export function getVisibleReportSubViews(section: 'accounting' | 'statements' | 'analytics'): readonly ReportViewMeta[] {
  return getReportSubViews(section).filter((view) => view.showInPrimaryNavigation);
}

export function getReportSubViewLabel(section: string, view: string): string | undefined {
  return getReportSubViews(section as 'accounting' | 'statements' | 'analytics').find((item) => item.id === view)?.label;
}

/** Every supported id stays resolvable so old bookmarks and directory entries keep working. */
export const REPORT_VIEW_SECTION_INDEX: Readonly<Record<string, 'accounting' | 'analytics'>> = Object.freeze({
  ...Object.fromEntries(ACCOUNTING_VIEW_IDS.map((id) => [id, 'accounting' as const])),
  ...Object.fromEntries(ANALYTICS_VIEW_IDS.map((id) => [id, 'analytics' as const])),
});
