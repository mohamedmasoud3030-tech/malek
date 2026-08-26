import { lazy } from 'react';
import type { ReportAdapterProps } from './report-adapter-contract';

/**
 * WP-C — each report body stays its own lazily-loaded chunk (C.4). Importing the
 * bodies statically here would pull every accounting report into a single
 * adapter chunk, so opening one report would download all three.
 */
const AccountingReportsSection = lazy(() =>
  import('../../components/AccountingReportsSection').then((m) => ({ default: m.AccountingReportsSection })),
);
const GeneralLedgerCoreSection = lazy(() =>
  import('../../components/GeneralLedgerCoreSection').then((m) => ({ default: m.GeneralLedgerCoreSection })),
);
const DeferredRevenueReportSection = lazy(() =>
  import('../../components/DeferredRevenueReportSection').then((m) => ({ default: m.DeferredRevenueReportSection })),
);

/**
 * WP-C adapter — maps the workspace read model onto the accounting section
 * bodies.
 *
 * It holds no data of its own: trial balance, P&L, balance sheet and the
 * subledger↔GL reconciliation readiness are produced by the Accounting
 * authority (via `use-reports-workspace` and `accounting-report-authority`) and
 * rendered verbatim. This adapter never re-derives an accounting figure.
 */
export function AccountingReportsAdapter({ view, model, canExportReports }: ReportAdapterProps) {
  if (view === 'general_ledger') {
    return <GeneralLedgerCoreSection />;
  }

  if (view === 'deferred_revenue') {
    return <DeferredRevenueReportSection {...model.sections.deferredRevenue} canExportReports={canExportReports} />;
  }

  return <AccountingReportsSection {...model.sections.accounting} />;
}
