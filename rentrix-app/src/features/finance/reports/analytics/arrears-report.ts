/**
 * Finance Operational Reports — Arrears Report
 *
 * Operational arrears reports (aging, overdue, summaries).
 * NOT accounting statements — those live in accounting/reports/.
 */

import type { ArrearsReportFilters } from '@/features/financials/reports/arrears-reports-service';
import type {
  AgedReceivablesReport,
  ArrearsSummaryReport,
  DashboardArrearsReports,
  OverdueInvoicesReport,
} from './report-types';

export type { ArrearsReportFilters };
export type { AgedReceivablesReport, ArrearsSummaryReport, DashboardArrearsReports, OverdueInvoicesReport };

// Re-export from arrears-reports-service
export {
  getOverdueInvoicesReport,
  getAgedReceivablesReport,
  getArrearsSummaryReport,
  getDashboardArrearsReports,
  calculateDaysOverdue,
  filterInvoicesForArrearsReport,
  getAgingBucketKey,
  summarizeAgedReceivablesReport,
  summarizeArrearsSummaryReport,
  summarizeOverdueInvoicesReport,
} from '@/features/financials/reports/arrears-reports-service';