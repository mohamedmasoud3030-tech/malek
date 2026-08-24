import type { FinancialReportStatus } from '@/features/financials/reports/financial-report-rows';
import { getCurrentMonthFilters, type FilterState } from './reports-page.helpers';

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
    status: 'all',
  };
}
