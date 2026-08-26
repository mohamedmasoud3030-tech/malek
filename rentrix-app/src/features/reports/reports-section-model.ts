import { reportSections, type ReportSectionId } from './reports-page.sections';
import {
  DEFAULT_ACCOUNTING_VIEW,
  DEFAULT_ANALYTICS_VIEW,
  REPORT_VIEW_SECTION_INDEX,
  isAccountingReportViewId,
  isAnalyticsReportViewId,
  type AccountingReportViewId,
  type AnalyticsReportViewId,
  type ReportViewId,
} from './report-view-registry';

export type { AccountingReportViewId, AnalyticsReportViewId, ReportViewId };

/** `?section=` is the deep-link contract for the reports workspace. */
export const REPORTS_SECTION_SEARCH_KEY = 'section';

export const DEFAULT_REPORT_SECTION: ReportSectionId = 'accounting';

export interface ReportLocation {
  section: ReportSectionId;
  view: ReportViewId;
}

/**
 * Resolve the active report section and view from unknown URL values.
 * Maps legacy section IDs and handles malformed fallbacks cleanly and atomically.
 *
 * The legacy `?section=<viewId>` aliases are derived from the report view
 * registry, so a newly registered view is automatically bookmarkable under its
 * own legacy name without touching this resolver.
 */
export function resolveReportLocation(requestedSection: unknown, requestedView: unknown): ReportLocation {
  const sec = typeof requestedSection === 'string' ? requestedSection.toLowerCase().trim() : '';
  const vi = typeof requestedView === 'string' ? requestedView.toLowerCase().trim() : '';

  // 1. Direct legacy mapping: if section contains a legacy report name
  const legacySection = REPORT_VIEW_SECTION_INDEX[sec];
  if (legacySection) {
    return { section: legacySection, view: sec as AccountingReportViewId | AnalyticsReportViewId };
  }
  if (sec === 'statements') {
    return { section: 'statements', view: '' };
  }

  // 2. Standard resolution under macro categories (when ?section is already analytics or accounting)
  if (sec === 'accounting') {
    return { section: 'accounting', view: isAccountingReportViewId(vi) ? vi : DEFAULT_ACCOUNTING_VIEW };
  }
  if (sec === 'analytics') {
    return { section: 'analytics', view: isAnalyticsReportViewId(vi) ? vi : DEFAULT_ANALYTICS_VIEW };
  }

  // 3. Fallbacks for missing/unknown/garbage sections
  return { section: DEFAULT_REPORT_SECTION, view: DEFAULT_ACCOUNTING_VIEW };
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
