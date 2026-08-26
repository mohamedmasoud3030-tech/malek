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
 * WP-C — Single declarative registry of report views.
 *
 * Before WP-C the view identifiers were duplicated in four places: the URL
 * resolver (`reports-section-model.ts`), the sub-navigation tab lists
 * (`ReportsWorkspace.tsx`), the panel routing switch, and the deep-link
 * legacy aliases. Every list could drift independently, which is how a
 * bookmarkable view ends up rendering nothing.
 *
 * This module is now the only place a report view is declared. Navigation,
 * deep-link resolution and panel routing all derive from it, so a view that
 * is reachable by URL is always reachable by UI — and vice versa.
 *
 * Presentation-only: it declares labels, icons and routing keys. It never
 * touches money, GL, or any accounting calculation.
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
}>;

export const ACCOUNTING_REPORT_VIEWS = [
  { id: 'accounting_reports', label: 'ميزان المراجعة والقوائم', icon: Scale },
  { id: 'general_ledger', label: 'دفتر الأستاذ والشجرة', icon: BookOpenCheck },
  { id: 'deferred_revenue', label: 'تسوية الإيرادات', icon: Layers },
] as const satisfies readonly ReportViewMeta[];

export const ANALYTICS_REPORT_VIEWS = [
  { id: 'overview', label: 'نظرة عامة على الأداء', icon: LayoutDashboard },
  { id: 'collections', label: 'تحليلات التحصيل', icon: Receipt },
  { id: 'overdue', label: 'تعتيق المتأخرات', icon: AlertTriangle },
  { id: 'expenses', label: 'تحليلات المصروفات', icon: ClipboardList },
  { id: 'property_analytics', label: 'تحليلات العقارات', icon: Building2 },
  { id: 'occupancy', label: 'تحليلات الإشغال', icon: Building2 },
  { id: 'maintenance_analytics', label: 'تحليلات الصيانة', icon: Wrench },
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

/** Sub-navigation items for a section. `statements` intentionally has none. */
export function getReportSubViews(section: 'accounting' | 'statements' | 'analytics'): readonly ReportViewMeta[] {
  if (section === 'accounting') return ACCOUNTING_REPORT_VIEWS;
  if (section === 'analytics') return ANALYTICS_REPORT_VIEWS;
  return [];
}

export function getReportSubViewLabel(section: string, view: string): string | undefined {
  return getReportSubViews(section as 'accounting' | 'statements' | 'analytics').find((item) => item.id === view)?.label;
}

/**
 * Every view id owned by any section. Used by the deep-link resolver so that a
 * legacy `?section=<viewId>` bookmark keeps opening the same report.
 */
export const REPORT_VIEW_SECTION_INDEX: Readonly<Record<string, 'accounting' | 'analytics'>> = Object.freeze({
  ...Object.fromEntries(ACCOUNTING_VIEW_IDS.map((id) => [id, 'accounting' as const])),
  ...Object.fromEntries(ANALYTICS_VIEW_IDS.map((id) => [id, 'analytics' as const])),
});
