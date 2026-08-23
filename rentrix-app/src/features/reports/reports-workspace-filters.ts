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

export function getInitialReportsFilters(): ReportsFilterState {
  return {
    ...getCurrentMonthFilters(),
    propertyId: '',
    unitId: '',
    tenantId: '',
    status: 'all',
  };
}
