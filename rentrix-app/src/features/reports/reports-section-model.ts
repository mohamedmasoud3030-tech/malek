import { reportSections, type ReportSectionId } from './reports-page.sections';

/** `?section=` is the deep-link contract for the reports workspace. */
export const REPORTS_SECTION_SEARCH_KEY = 'section';

export const DEFAULT_REPORT_SECTION: ReportSectionId = 'overview';

/**
 * Resolve the active report section from an unknown URL value.
 *
 * - Missing or unknown values fail safely to the default section.
 * - The section must be one of the registered report sections; anything else
 *   (including hand-edited or stale bookmarks) can never render an empty pane.
 */
export function resolveReportSection(requested: unknown): ReportSectionId {
  if (
    typeof requested === 'string' &&
    reportSections.some((section) => section.id === requested)
  ) {
    return requested as ReportSectionId;
  }
  return DEFAULT_REPORT_SECTION;
}

/**
 * Return a new search object with the report section set, preserving every
 * unrelated search parameter the current URL already carries. This is what the
 * router search updater applies when the user switches report sections, so
 * unrelated params (e.g. filters) survive tab switches and direct links.
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
