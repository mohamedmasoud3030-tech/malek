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
  Zap,
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
  | 'follow_up'
  | 'collection_movement'
  | 'expenses'
  | 'property_analytics'
  | 'occupancy'
  | 'expiring'
  | 'maintenance_analytics'
  | 'operations_overview'
  | 'services';

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
  { id: 'overview', label: 'أداء المكتب', icon: LayoutDashboard, showInPrimaryNavigation: true },
  { id: 'collections', label: 'ملخص الفترة', icon: Receipt, showInPrimaryNavigation: true },
  { id: 'overdue', label: 'المتأخرات والأعمار', icon: AlertTriangle, showInPrimaryNavigation: true },
  { id: 'follow_up', label: 'المتابعة', icon: AlertTriangle, showInPrimaryNavigation: true },
  { id: 'collection_movement', label: 'حركة التحصيل', icon: Receipt, showInPrimaryNavigation: true },
  { id: 'expenses', label: 'المصروفات', icon: ClipboardList, showInPrimaryNavigation: true },
  { id: 'property_analytics', label: 'أداء العقارات والوحدات', icon: Building2, showInPrimaryNavigation: true },
  { id: 'occupancy', label: 'الإشغال والشغور', icon: Building2, showInPrimaryNavigation: true },
  { id: 'expiring', label: 'العقود القريبة من الانتهاء', icon: Building2, showInPrimaryNavigation: true },
  { id: 'maintenance_analytics', label: 'الصيانة', icon: Wrench, showInPrimaryNavigation: true },
  { id: 'operations_overview', label: 'نظرة تشغيلية', icon: Wrench, showInPrimaryNavigation: true },
  { id: 'services', label: 'الخدمات والمرافق', icon: Zap, showInPrimaryNavigation: false },
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