import {
  getReportProduct,
  getReportProductTarget,
  getReportProductTargetForLocation,
  type ReportProduct,
  type ReportProductTarget,
  type ReportSectionId,
  type ReportViewId,
} from './report-products';
import type { ReportsFilterState } from './reports-workspace-filters';

/** The retained body renderer location; it has no workspace-navigation meaning. */
export type ReportLocation = Readonly<{
  section: ReportSectionId;
  view: ReportViewId;
}>;

/** Legacy URL keys are read only at the route boundary and never written. */
export const LEGACY_REPORTS_SECTION_SEARCH_KEY = 'section';
export const LEGACY_REPORTS_WORKSPACE_SEARCH_KEY = 'workspace';

/** Filter keys shared by the report filter surface, drill-through and share URLs. */
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

/** Bodies can drill only to an explicit canonical renderer location. */
export type ReportDrillHandler = (
  section: ReportSectionId,
  view: ReportViewId,
  filterPatch?: ReportFilterPatch,
) => void;

const REPORT_DATE_KEYS: readonly ReportFilterSearchKey[] = [
  'from',
  'to',
  'asOf',
];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const FILTER_FIELD_SEARCH_KEYS = {
  period: ['from', 'to'],
  asOf: ['asOf'],
  property: ['propertyId'],
  unit: ['unitId'],
  tenant: ['tenantId'],
  owner: ['ownerId'],
  contract: ['contractId'],
  costCenter: ['costCenterId'],
  status: ['status'],
} as const satisfies Record<string, readonly ReportFilterSearchKey[]>;

function readRawSearchValue(
  search: Record<string, unknown>,
  key: ReportFilterSearchKey,
): string | undefined {
  const value = search[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function applyReportFilterPatch(
  search: Record<string, unknown>,
  patch: ReportFilterPatch,
): void {
  const patchHas = (key: ReportFilterSearchKey) => patch[key] !== undefined;

  for (const key of REPORT_FILTER_SEARCH_KEYS) {
    if (!patchHas(key)) continue;
    const value = patch[key];
    if (value === '' || value == null) delete search[key];
    else search[key] = String(value);
  }

  const clearStaleDependents = (
    dependents: readonly ReportFilterSearchKey[],
  ) => {
    for (const dependent of dependents) {
      if (!patchHas(dependent)) delete search[dependent];
    }
  };

  if (patchHas('propertyId'))
    clearStaleDependents(['unitId', 'tenantId', 'contractId']);
  if (patchHas('unitId')) clearStaleDependents(['tenantId', 'contractId']);
  if (patchHas('tenantId')) clearStaleDependents(['contractId']);
}

function targetFilterKeys(
  target: ReportProductTarget,
): ReadonlySet<ReportFilterSearchKey> {
  return new Set(
    target.visibleFilterFields.flatMap(
      (field) => FILTER_FIELD_SEARCH_KEYS[field] ?? [],
    ),
  );
}

function removeUnsupportedFilters(
  search: Record<string, unknown>,
  target: ReportProductTarget,
): void {
  const allowed = targetFilterKeys(target);
  for (const key of REPORT_FILTER_SEARCH_KEYS) {
    if (!allowed.has(key)) delete search[key];
  }
  if (search.status === 'all') delete search.status;
}

function writeFilters(
  search: Record<string, unknown>,
  filters: ReportsFilterState,
): void {
  for (const key of REPORT_FILTER_SEARCH_KEYS) {
    delete search[key];
    const value = filters[key];
    if (value && !(key === 'status' && value === 'all'))
      search[key] = String(value);
  }
}

/**
 * Produce the one canonical report-product search shape. It strips every
 * retired route key, serializes the target ID as `view`, and only retains
 * filters whose target explicitly exposes them.
 */
export function buildReportProductSearch(
  previous: Record<string, unknown>,
  target: ReportProductTarget,
  filters?: ReportsFilterState,
  filterPatch?: ReportFilterPatch,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...previous };
  delete next[LEGACY_REPORTS_WORKSPACE_SEARCH_KEY];
  delete next[LEGACY_REPORTS_SECTION_SEARCH_KEY];
  delete next.report;
  delete next.target;
  if (filters) writeFilters(next, filters);
  if (filterPatch) applyReportFilterPatch(next, filterPatch);
  removeUnsupportedFilters(next, target);
  next.view = target.id;
  return next;
}

/**
 * Diff URL filter keys into the same dependent-filter patch used by the
 * canonical filter surface. Dropped dates intentionally do not clobber local
 * in-progress period edits; contextual entity filters do clear when removed.
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
    patch[key] = after ?? '';
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

type LegacyProductLocation = Readonly<{
  product: ReportProduct;
  target: ReportProductTarget;
}>;

function legacyTarget(
  productId: Parameters<typeof getReportProduct>[0],
  targetId?: string,
): LegacyProductLocation | undefined {
  const product = getReportProduct(productId);
  if (!product) return undefined;
  return { product, target: getReportProductTarget(product, targetId) };
}

function normalized(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function targetForLegacyView(view: string): LegacyProductLocation | undefined {
  const locations: ReportLocation[] = [
    { section: 'analytics', view: view as ReportViewId },
    { section: 'accounting', view: view as ReportViewId },
  ];
  for (const location of locations) {
    const match = getReportProductTargetForLocation(
      location.section,
      location.view,
    );
    if (match) return match;
  }
  return undefined;
}

/**
 * Translates actual, previously shipped Reports URL shapes once at the route
 * boundary. It never returns a workspace renderer. A statement URL without a
 * party/account context is intentionally ambiguous and is sent to the catalog
 * rather than silently choosing an owner, tenant or financial statement.
 */
export function resolveLegacyReportLocation(
  search: Record<string, unknown>,
): LegacyProductLocation | undefined {
  const workspace = normalized(search[LEGACY_REPORTS_WORKSPACE_SEARCH_KEY]);
  const section = normalized(search[LEGACY_REPORTS_SECTION_SEARCH_KEY]);
  const view = normalized(search.view);
  if (!workspace && !section && !view) return undefined;

  const statementContext = () => {
    const hasOwner = Boolean(normalized(search.ownerId));
    const hasContract = Boolean(
      normalized(search.contractId) || normalized(search.tenantId),
    );
    if (hasOwner === hasContract) return undefined;
    return hasOwner
      ? legacyTarget('owner-comprehensive-statement')
      : legacyTarget('tenant-statement');
  };

  if (workspace === 'statements' || section === 'statements')
    return statementContext();

  if (view) {
    const byView = targetForLegacyView(view);
    if (byView) return byView;
  }
  if (section && section !== 'analytics' && section !== 'accounting') {
    const bySectionView = targetForLegacyView(section);
    if (bySectionView) return bySectionView;
  }

  switch (workspace || section) {
    case 'office':
    case 'analytics':
      return legacyTarget('portfolio-property-performance', 'office');
    case 'collections':
      return legacyTarget('collections-arrears-cheques', 'period');
    case 'leasing':
      return legacyTarget('portfolio-property-performance', 'occupancy');
    case 'operations':
      return legacyTarget('portfolio-property-performance', 'operations');
    case 'properties':
      return legacyTarget('portfolio-property-performance', 'property');
    case 'financial_review':
    case 'accounting':
      return legacyTarget('financial-settlement-pack', 'statements');
    default:
      return undefined;
  }
}

/** Direct product URLs from the first product release accepted `target` and body view IDs. */
export function resolveLegacyProductTarget(
  product: ReportProduct,
  value: unknown,
): ReportProductTarget | undefined {
  const requested = normalized(value);
  if (!requested || product.targets.some((target) => target.id === requested))
    return undefined;
  return product.targets.find((target) => target.view === requested);
}
