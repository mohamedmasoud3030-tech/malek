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
const FollowUpSection = lazy(() =>
  import('../../components/FollowUpSection').then((m) => ({ default: m.FollowUpSection })),
);
const CollectionMovementSection = lazy(() =>
  import('../../components/CollectionMovementSection').then((m) => ({ default: m.CollectionMovementSection })),
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
const ExpiringContractsSection = lazy(() =>
  import('../../components/ExpiringContractsSection').then((m) => ({ default: m.ExpiringContractsSection })),
);
const MaintenanceReportSection = lazy(() =>
  import('../../components/MaintenanceReportSection').then((m) => ({ default: m.MaintenanceReportSection })),
);
const OperationsOverviewSection = lazy(() =>
  import('../../components/OperationsOverviewSection').then((m) => ({ default: m.OperationsOverviewSection })),
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
 * balance, or a GL-backed figure of its own. Views grouped under one business
 * workspace keep their separate read models — the UI consolidates, the data
 * sources do not.
 */
export function AnalyticsReportsAdapter({ view, model, filters, canExportReports, onDrill }: ReportAdapterProps) {
  switch (resolveAnalyticsReportView(view)) {
    case 'collections':
      return <CollectionsSection {...model.sections.collections} canExportReports={canExportReports} />;
    case 'overdue':
      return <OverdueSection {...model.sections.overdue} canExportReports={canExportReports} />;
    case 'follow_up':
      return (
        <FollowUpSection
          rows={model.sections.overdue.rows}
          isLoading={model.sections.overdue.isLoading}
          canExportReports={canExportReports}
        />
      );
    case 'collection_movement': {
      const collections = model.sections.collections;
      return (
        <CollectionMovementSection
          summary={collections.summary}
          rows={collections.rows}
          receiptRows={collections.receiptRows}
          from={collections.from}
          to={collections.to}
          canExportReports={canExportReports}
          isLoading={collections.isLoading}
        />
      );
    }
    case 'expenses':
      return (
        <ExpensesSection
          {...model.sections.expenses}
          from={filters.from}
          to={filters.to}
          onDrill={onDrill}
          canExportReports={canExportReports}
        />
      );
    case 'property_analytics':
      return (
        <PropertyAnalyticsSection
          occupancyRows={model.sections.occupancy.occupancyRows}
          expenseRows={model.sections.expenses.report?.byProperty ?? []}
          performanceRows={model.sections.propertyPerformance?.rows ?? []}
          isLoading={model.sections.propertyPerformance?.isLoading ?? (model.sections.occupancy.isLoading || model.sections.expenses.isLoading)}
          onDrill={onDrill}
          model={model}
          filters={filters}
        />
      );
    case 'occupancy':
      return <OccupancySection {...model.sections.occupancy} canExportReports={canExportReports} />;
    case 'expiring':
      return (
        <ExpiringContractsSection
          expiringRows={model.sections.occupancy.expiringRows}
          vacancyAnalytics={model.sections.occupancy.vacancyAnalytics}
          canExportReports={canExportReports}
          isLoading={model.sections.occupancy.isLoading}
        />
      );
    case 'maintenance_analytics':
      return <MaintenanceReportSection {...model.sections.maintenance} canExportReports={canExportReports} />;
    case 'operations_overview':
      return (
        <OperationsOverviewSection
          expenseReport={model.sections.expenses.report}
          maintenanceRows={model.sections.maintenance.rows}
          maintenanceSummary={model.sections.maintenance.summary}
          isLoading={model.sections.expenses.isLoading || model.sections.maintenance.isLoading}
          onDrill={onDrill}
        />
      );
    case 'services':
      return <ServicesReportSection filters={filters} canExportReports={canExportReports} />;
    case 'overview':
    default:
      return (
        <OverviewSection
          summary={model.sections.overview.summary}
          collectionSummary={model.sections.overview.collectionSummary}
          collectionRate={model.sections.overview.collectionRate}
          cashflowRows={model.sections.overview.cashflowRows}
          receiptRows={model.sections.collections.receiptRows}
          occupancyRows={model.sections.occupancy.occupancyRows}
          expiringRows={model.sections.occupancy.expiringRows}
          expenseRows={model.sections.expenses.report?.byProperty ?? []}
          overdueSummary={model.sections.overdue.summary}
          maintenanceSummary={model.sections.maintenance.summary}
          canExportReports={canExportReports}
          isLoading={
            model.sections.overview.isLoading
            || model.sections.collections.isLoading
            || model.sections.occupancy.isLoading
            || model.sections.overdue.isLoading
            || model.sections.maintenance.isLoading
          }
          onDrill={onDrill}
        />
      );
  }
}
