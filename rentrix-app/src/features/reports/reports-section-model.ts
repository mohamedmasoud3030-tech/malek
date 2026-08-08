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

/**
 * Resolve the active report section from an unknown URL value.
 * Maps legacy section IDs to the three new macro categories.
 */
export function resolveReportSection(requested: unknown): ReportSectionId {
  if (typeof requested !== 'string') return DEFAULT_REPORT_SECTION;
  
  const req = requested.toLowerCase().trim();
  if (['accounting', 'general_ledger', 'deferred_revenue', 'accounting_reports'].includes(req)) {
    return 'accounting';
  }
  if (req === 'statements') {
    return 'statements';
  }
  if (
    [
      'analytics',
      'overview',
      'collections',
      'overdue',
      'expenses',
      'property_analytics',
      'occupancy',
      'maintenance_analytics',
    ].includes(req)
  ) {
    return 'analytics';
  }
  
  return DEFAULT_REPORT_SECTION;
}

/**
 * Resolve the active report view from the URL section and view parameters,
 * mapping legacy sections to their new nested view equivalents.
 */
export function resolveReportView(requestedSection: unknown, requestedView: unknown): ReportViewId {
  const sec = typeof requestedSection === 'string' ? requestedSection.toLowerCase().trim() : '';
  const vi = typeof requestedView === 'string' ? requestedView.toLowerCase().trim() : '';

  // 1. Resolve macro section accounting
  if (sec === 'accounting') {
    if (['accounting_reports', 'general_ledger', 'deferred_revenue'].includes(vi)) {
      return vi as AccountingReportViewId;
    }
    return 'accounting_reports';
  }

  // 2. Resolve macro section analytics
  if (sec === 'analytics') {
    if (['overview', 'collections', 'overdue', 'expenses', 'property_analytics', 'occupancy', 'maintenance_analytics'].includes(vi)) {
      return vi as AnalyticsReportViewId;
    }
    return 'overview';
  }

  // 3. Resolve legacy direct section parameters
  if (['general_ledger', 'deferred_revenue'].includes(sec)) {
    return sec as AccountingReportViewId;
  }

  if (['overview', 'collections', 'overdue', 'expenses', 'property_analytics', 'occupancy', 'maintenance_analytics'].includes(sec)) {
    return sec as AnalyticsReportViewId;
  }

  // 4. Statements / other macro categories have no internal views
  return '';
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
