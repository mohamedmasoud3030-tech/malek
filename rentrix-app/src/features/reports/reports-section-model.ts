import { reportSections, type ReportSectionId } from './reports-page.sections';

/** `?section=` is the deep-link contract for the reports workspace. */
export const REPORTS_SECTION_SEARCH_KEY = 'section';

export const DEFAULT_REPORT_SECTION: ReportSectionId = 'accounting';

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
export function resolveReportView(requestedSection: unknown, requestedView: unknown): string {
  const sec = typeof requestedSection === 'string' ? requestedSection.toLowerCase().trim() : '';
  const vi = typeof requestedView === 'string' ? requestedView.toLowerCase().trim() : '';

  // 1. Direct legacy mapping: if section contains a legacy report name, that is the view
  if (['overview', 'collections', 'overdue', 'expenses', 'property_analytics', 'occupancy', 'maintenance_analytics'].includes(sec)) {
    return sec;
  }
  if (sec === 'general_ledger' || sec === 'deferred_revenue') {
    return sec;
  }
  if (sec === 'accounting') {
    return vi || 'accounting_reports';
  }

  // 2. Standard resolution under macro sections
  if (sec === 'analytics') {
    const validViews = ['overview', 'collections', 'overdue', 'expenses', 'property_analytics', 'occupancy', 'maintenance_analytics'];
    return validViews.includes(vi) ? vi : 'overview';
  }
  if (sec === 'accounting') {
    const validViews = ['accounting_reports', 'general_ledger', 'deferred_revenue'];
    return validViews.includes(vi) ? vi : 'accounting_reports';
  }

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
