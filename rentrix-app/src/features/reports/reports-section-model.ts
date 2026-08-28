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

/**
 * The office-owner landing experience starts from understandable performance
 * outcomes. Accounting remains addressable through legacy/deep links but is no
 * longer the default face of the reports center.
 */
export const DEFAULT_REPORT_SECTION: ReportSectionId = 'analytics';

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

  const legacySection = REPORT_VIEW_SECTION_INDEX[sec];
  if (legacySection) {
    return { section: legacySection, view: sec as AccountingReportViewId | AnalyticsReportViewId };
  }
  if (sec === 'statements') {
    return { section: 'statements', view: '' };
  }

  if (sec === 'accounting') {
    return { section: 'accounting', view: isAccountingReportViewId(vi) ? vi : DEFAULT_ACCOUNTING_VIEW };
  }
  if (sec === 'analytics') {
    return { section: 'analytics', view: isAnalyticsReportViewId(vi) ? vi : DEFAULT_ANALYTICS_VIEW };
  }

  return { section: DEFAULT_REPORT_SECTION, view: DEFAULT_ANALYTICS_VIEW };
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
