import type { FinancialReportStatus } from '@/features/financials/reports/financial-report-rows';
import { getCurrentMonthFilters, type FilterState } from './reports-page.helpers';

/** Global report filter fields that a workspace or premium product may expose. */
export type ReportFilterFieldId =
  | 'period'
  | 'asOf'
  | 'property'
  | 'unit'
  | 'tenant'
  | 'contract'
  | 'status'
  | 'costCenter'
  | 'owner';

/**
 * Wave 4 report-filter contract. The legacy FilterState stays source-compatible
 * for fixtures and helpers; the workspace adds the dimensions that users need
 * to narrow operational reports without changing any accounting calculation.
 */
export type ReportsFilterState = FilterState & Readonly<{
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  status?: FinancialReportStatus;
}>;

/**
 * Remove entity/status dimensions that the active product does not own.
 * Hidden filters must never keep affecting a report, export, or shared link.
 * Date dimensions are cleared unless the product exposes their exact semantic
 * field. This is especially important for contract-scoped account statements,
 * whose authoritative RPC does not accept a client-selected reporting period.
 */
export function scopeReportsFiltersToFields(
  filters: ReportsFilterState,
  visibleFields: readonly ReportFilterFieldId[],
): ReportsFilterState {
  const fields = new Set(visibleFields);
  return {
    ...filters,
    from: fields.has('period') ? filters.from : '',
    to: fields.has('period') ? filters.to : '',
    asOf: fields.has('asOf') ? filters.asOf : '',
    propertyId: fields.has('property') ? filters.propertyId : '',
    unitId: fields.has('unit') ? filters.unitId : '',
    tenantId: fields.has('tenant') ? filters.tenantId : '',
    ownerId: fields.has('owner') ? filters.ownerId : '',
    contractId: fields.has('contract') ? filters.contractId : '',
    costCenterId: fields.has('costCenter') ? filters.costCenterId : '',
    status: fields.has('status') ? filters.status : 'all',
  };
}

function readSearchString(search: Record<string, unknown> | undefined, key: string) {
  const value = search?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readSearchDate(search: Record<string, unknown> | undefined, key: string) {
  const value = readSearchString(search, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

/**
 * Build the initial workspace scope. Contextual links may preselect an entity
 * and/or period, but malformed URL values never replace the safe defaults.
 * The state remains locally editable after mount; section/view navigation
 * preserves these search parameters without re-deriving the filter state.
 */
export function getInitialReportsFilters(search?: Record<string, unknown>): ReportsFilterState {
  const defaults = getCurrentMonthFilters();
  const requestedFrom = readSearchDate(search, 'from');
  const requestedTo = readSearchDate(search, 'to');
  const requestedAsOf = readSearchDate(search, 'asOf');
  const hasValidRange = Boolean(requestedFrom && requestedTo && requestedFrom <= requestedTo);

  return {
    ...defaults,
    from: hasValidRange ? requestedFrom : defaults.from,
    to: hasValidRange ? requestedTo : defaults.to,
    asOf: requestedAsOf || (hasValidRange ? requestedTo : defaults.asOf),
    propertyId: readSearchString(search, 'propertyId'),
    unitId: readSearchString(search, 'unitId'),
    tenantId: readSearchString(search, 'tenantId'),
    costCenterId: readSearchString(search, 'costCenterId'),
    ownerId: readSearchString(search, 'ownerId'),
    contractId: readSearchString(search, 'contractId'),
    status: (readSearchString(search, 'status') as FinancialReportStatus) || 'all',
  };
}
