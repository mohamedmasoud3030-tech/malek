import { reportSections, type ReportSectionId } from './reports-page.sections';

/** `?section=` is the deep-link contract for the reports workspace. */
export const REPORTS_SECTION_SEARCH_KEY = 'section';

export const DEFAULT_REPORT_SECTION: ReportSectionId = 'accounting';

export type AccountingReportViewId = 'accounting_reports' | 'general_ledger' | 'deferred_revenue';

export type AnalyticsReportViewId =
  | 'overview'
  | 'collections'
  | 'overdue'
  | 'expenses'
  | 'property_analytics'
  | 'occupancy'
  | 'maintenance_analytics';

export type ReportViewId = AccountingReportViewId | AnalyticsReportViewId | '';

export interface ReportLocation {
  section: ReportSectionId;
  view: ReportViewId;
}

/**
 * Resolve the active report section and view from unknown URL values.
 * Maps legacy section IDs and handles malformed fallbacks cleanly and atomically.
 */
export function resolveReportLocation(requestedSection: unknown, requestedView: unknown): ReportLocation {
  const sec = typeof requestedSection === 'string' ? requestedSection.toLowerCase().trim() : '';
  const vi = typeof requestedView === 'string' ? requestedView.toLowerCase().trim() : '';

  // 1. Direct legacy mapping: if section contains a legacy report name
  if (sec === 'overview') {
    return { section: 'analytics', view: 'overview' };
  }
  if (sec === 'collections') {
    return { section: 'analytics', view: 'collections' };
  }
  if (sec === 'overdue') {
    return { section: 'analytics', view: 'overdue' };
  }
  if (sec === 'expenses') {
    return { section: 'analytics', view: 'expenses' };
  }
  if (sec === 'property_analytics') {
    return { section: 'analytics', view: 'property_analytics' };
  }
  if (sec === 'occupancy') {
    return { section: 'analytics', view: 'occupancy' };
  }
  if (sec === 'maintenance_analytics') {
    return { section: 'analytics', view: 'maintenance_analytics' };
  }
  if (sec === 'general_ledger') {
    return { section: 'accounting', view: 'general_ledger' };
  }
  if (sec === 'deferred_revenue') {
    return { section: 'accounting', view: 'deferred_revenue' };
  }
  if (sec === 'statements') {
    return { section: 'statements', view: '' };
  }

  // 2. Standard resolution under macro categories (when ?section is already analytics or accounting)
  if (sec === 'accounting') {
    if (['accounting_reports', 'general_ledger', 'deferred_revenue'].includes(vi)) {
      return { section: 'accounting', view: vi as AccountingReportViewId };
    }
    return { section: 'accounting', view: 'accounting_reports' };
  }
  if (sec === 'analytics') {
    if (['overview', 'collections', 'overdue', 'expenses', 'property_analytics', 'occupancy', 'maintenance_analytics'].includes(vi)) {
      return { section: 'analytics', view: vi as AnalyticsReportViewId };
    }
    return { section: 'analytics', view: 'overview' };
  }

  // 3. Fallbacks for missing/unknown/garbage sections
  return { section: 'accounting', view: 'accounting_reports' };
}

/**
 * Return a new search object with the report section set, preserving every
 * unrelated search parameter the current URL already carries.
 */
export function mergeReportSectionIntoSearch(
  previous: Record<string, unknown>,
  nextSection: ReportSectionId,
): Record<string, unknown> {
  return {
    ...previous,
    [REPORTS_SECTION_SEARCH_KEY]: nextSection,
  };
}
