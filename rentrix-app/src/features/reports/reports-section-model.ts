import type { ReportSectionId } from './reports-page.sections';
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
import type { ReportsFilterState } from './reports-workspace-filters';

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
 * Filter fields with a canonical URL representation. These are the exact keys
 * `getInitialReportsFilters` reads from the search object — drill-through and
 * deep links share one naming scheme, never a parallel one.
 */
export const REPORT_FILTER_SEARCH_KEYS = [
  'from',
  'to',
  'asOf',
  'propertyId',
  'unitId',
  'tenantId',
  'ownerId',
  'contractId',
  'costCenterId',
  'status',
] as const;

export type ReportFilterSearchKey = (typeof REPORT_FILTER_SEARCH_KEYS)[number];

/**
 * Mutable contextual filter patch for URL serialization. Deliberately not
 * `Partial<ReportsFilterState>`: the filter state is readonly and a patch is
 * a working object the search builder and the diff helper assign into.
 */
export type ReportFilterPatch = {
  from?: string;
  to?: string;
  asOf?: string;
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  ownerId?: string;
  contractId?: string;
  costCenterId?: string;
  status?: ReportsFilterState['status'];
};

const REPORT_DATE_KEYS: readonly ReportFilterSearchKey[] = ['from', 'to', 'asOf'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readRawSearchValue(search: Record<string, unknown>, key: ReportFilterSearchKey): string | undefined {
  const value = search[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Apply a contextual filter patch onto a search object. Patch semantics:
 *
 *   - field absent (`undefined`) → leave the existing search value untouched,
 *   - field cleared (`''` / `null`) → remove the key from the search,
 *   - field set → write the canonical URL key.
 *
 * Setting a broader scope cascades like the filter panel: an explicit
 * property clears stale unit/tenant/contract scope (and so on down the
 * chain) unless those fields are themselves explicitly present in the patch.
 */
function applyReportFilterPatch(search: Record<string, unknown>, patch: ReportFilterPatch): void {
  const patchHas = (key: ReportFilterSearchKey) => patch[key] !== undefined;

  for (const key of REPORT_FILTER_SEARCH_KEYS) {
    if (!patchHas(key)) continue;
    const value = patch[key];
    if (value === '' || value == null) delete search[key];
    else search[key] = String(value);
  }

  const clearStaleDependents = (dependents: readonly ReportFilterSearchKey[]) => {
    for (const dependent of dependents) {
      if (!patchHas(dependent)) delete search[dependent];
    }
  };

  if (patchHas('propertyId')) clearStaleDependents(['unitId', 'tenantId', 'contractId']);
  if (patchHas('unitId')) clearStaleDependents(['tenantId', 'contractId']);
  if (patchHas('tenantId')) clearStaleDependents(['contractId']);
}

/**
 * Build the search object for user-facing workspace navigation. The legacy
 * `section` key is removed so new URLs stay canonical, while every unrelated
 * search parameter (e.g. a bookmark's own scope) is preserved. An optional
 * contextual filter patch is serialized into the same canonical keys the
 * initial-filter reader consumes, so drill-through scope is URL-backed.
 */
export function buildWorkspaceSearch(
  previous: Record<string, unknown>,
  workspace: ReportWorkspaceId,
  view?: ReportViewId,
  filterPatch?: ReportFilterPatch,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...previous, [WORKSPACE_SEARCH_KEY]: workspace };
  if (view) next.view = view;
  else delete next.view;
  delete next[REPORTS_SECTION_SEARCH_KEY];
  if (filterPatch) applyReportFilterPatch(next, filterPatch);
  return next;
}

/**
 * Diff two search objects over the canonical filter keys and return the
 * filter-state patch that mirrors the URL change. The URL is the authority
 * for scope fields (added → set, removed → cleared), while date fields are
 * only applied when the new URL carries a valid value — dropping a date from
 * the URL never clobbers locally edited dates, and reload reconstruction
 * remains owned by `getInitialReportsFilters`.
 */
export function diffReportFiltersFromSearch(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): ReportFilterPatch | null {
  const patch: ReportFilterPatch = {};

  for (const key of REPORT_FILTER_SEARCH_KEYS) {
    const before = readRawSearchValue(previous, key);
    const after = readRawSearchValue(next, key);
    if (before === after) continue;

    if (REPORT_DATE_KEYS.includes(key)) {
      if (after && DATE_PATTERN.test(after)) patch[key] = after;
      continue;
    }

    if (key === 'status') {
      patch.status = (after ?? 'all') as ReportsFilterState['status'];
      continue;
    }

    patch[key] = after;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
