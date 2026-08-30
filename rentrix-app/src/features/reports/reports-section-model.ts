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
import {
  WORKSPACE_SEARCH_KEY,
  getReportWorkspace,
  getWorkspaceForReportLocation,
  type ReportWorkspaceId,
} from './report-workspaces';

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

export type ResolvedReportLocation = ReportLocation & Readonly<{
  workspace: ReportWorkspaceId;
}>;

/**
 * Resolve the active workspace from the user-facing `?workspace=` key, with a
 * full legacy fallback for `?section=&view=` bookmarks. Unknown workspace
 * values fall through to legacy resolution (which itself defaults to the
 * office launchpad), so malformed URLs always land somewhere useful.
 */
export function resolveWorkspaceLocation(
  requestedWorkspace: unknown,
  requestedView: unknown,
  requestedSection: unknown,
): ResolvedReportLocation {
  const workspaceParam = typeof requestedWorkspace === 'string' ? requestedWorkspace.toLowerCase().trim() : '';
  const workspace = getReportWorkspace(workspaceParam);
  if (workspace) {
    const viewParam = typeof requestedView === 'string' ? requestedView.toLowerCase().trim() : '';
    const subView = workspace.subViews.find((candidate) => candidate.id === viewParam);
    const view = (subView ? subView.id : workspace.defaultView) as ReportViewId;
    return { workspace: workspace.id, section: workspace.defaultSection, view };
  }

  const legacy = resolveReportLocation(requestedSection, requestedView);
  return {
    workspace: getWorkspaceForReportLocation(legacy.section, legacy.view),
    section: legacy.section,
    view: legacy.view,
  };
}

/**
 * Build the search object for user-facing workspace navigation. The legacy
 * `section` key is removed so new URLs stay canonical, while every unrelated
 * search parameter (e.g. entity scope carried into the page) is preserved.
 */
export function buildWorkspaceSearch(
  previous: Record<string, unknown>,
  workspace: ReportWorkspaceId,
  view?: ReportViewId,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...previous, [WORKSPACE_SEARCH_KEY]: workspace };
  if (view) next.view = view;
  else delete next.view;
  delete next[REPORTS_SECTION_SEARCH_KEY];
  return next;
}
