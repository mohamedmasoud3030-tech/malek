import { lazy } from 'react';
import type { ReportAdapterProps } from './report-adapter-contract';
import type { AnalyticsReportViewId } from '../../report-view-registry';
import { isAnalyticsReportViewId } from '../../report-view-registry';

/**
 * WP-C — one lazy chunk per analytics report body. The overview alone carries
 * the charting dependency, so eager imports here would force every analytics
 * view to download it.
 */
const OverviewSection = lazy(() =>
  import('../../components/OverviewSection').then((m) => ({ default: m.OverviewSection })),
);
const CollectionsSection = lazy(() =>
  import('../../components/CollectionsSection').then((m) => ({ default: m.CollectionsSection })),
);
const OverdueSection = lazy(() =>
  import('../../components/OverdueSection').then((m) => ({ default: m.OverdueSection })),
);
const ExpensesSection = lazy(() =>
  import('../../components/ExpensesSection').then((m) => ({ default: m.ExpensesSection })),
);
const PropertyAnalyticsSection = lazy(() =>
  import('../../components/PropertyAnalyticsSection').then((m) => ({ default: m.PropertyAnalyticsSection })),
);
const OccupancySection = lazy(() =>
  import('../../components/OccupancySection').then((m) => ({ default: m.OccupancySection })),
);
const MaintenanceReportSection = lazy(() =>
  import('../../components/MaintenanceReportSection').then((m) => ({ default: m.MaintenanceReportSection })),
);
const ServicesReportSection = lazy(() =>
  import('../../components/ServicesReportSection').then((m) => ({ default: m.ServicesReportSection })),
);

const DEFAULT_ANALYTICS_BODY: AnalyticsReportViewId = 'overview';

/**
 * Unknown or missing views fall back to the overview body instead of a blank
 * panel. The parameter is a plain string on purpose: view ids reach this code
 * from the URL, so the guard has to accept values outside the union.
 */
export function resolveAnalyticsReportView(view: string): AnalyticsReportViewId {
  return isAnalyticsReportViewId(view) ? view : DEFAULT_ANALYTICS_BODY;
}

/**
 * WP-C adapter — operational analytics section.
 *
 * These are operating indicators, never accounting statements: the adapter
 * forwards Finance/operational read models and never computes a profit, a
 * balance, or a GL-backed figure of its own.
 */
export function AnalyticsReportsAdapter({ view, model, filters, canExportReports }: ReportAdapterProps) {
  switch (resolveAnalyticsReportView(view)) {
    case 'collections':
      return <CollectionsSection {...model.sections.collections} canExportReports={canExportReports} />;
    case 'overdue':
      return <OverdueSection {...model.sections.overdue} canExportReports={canExportReports} />;
    case 'expenses':
      return <ExpensesSection {...model.sections.expenses} canExportReports={canExportReports} />;
    case 'property_analytics':
      return (
        <PropertyAnalyticsSection
          occupancyRows={model.sections.occupancy.occupancyRows}
          expenseRows={model.sections.expenses.report?.byProperty ?? []}
          isLoading={model.sections.occupancy.isLoading || model.sections.expenses.isLoading}
        />
      );
    case 'occupancy':
      return <OccupancySection {...model.sections.occupancy} canExportReports={canExportReports} />;
    case 'maintenance_analytics':
      return <MaintenanceReportSection {...model.sections.maintenance} canExportReports={canExportReports} />;
    case 'services':
      return <ServicesReportSection filters={filters} canExportReports={canExportReports} />;
    case 'overview':
    default:
      return (
        <OverviewSection
          {...model.sections.overview}
          receiptRows={model.sections.collections.receiptRows}
          occupancyRows={model.sections.occupancy.occupancyRows}
          canExportReports={canExportReports}
          isLoading={
            model.sections.overview.isLoading
            || model.sections.collections.isLoading
            || model.sections.occupancy.isLoading
          }
        />
      );
  }
}