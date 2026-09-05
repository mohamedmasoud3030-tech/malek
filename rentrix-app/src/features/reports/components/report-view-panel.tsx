import { lazy, Suspense } from 'react';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionTabPanel } from '@/components/ui/section-tabs';
import type { ReportsFilterState } from '../reports-workspace-filters';
import type {
  ReportSectionId,
  ReportViewId,
  StatementProductFocus,
} from '../report-products';
import type { ReportDrillHandler } from '../report-route';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';

const AccountingReportsSection = lazy(() =>
  import('./AccountingReportsSection').then((m) => ({
    default: m.AccountingReportsSection,
  })),
);
const GeneralLedgerCoreSection = lazy(() =>
  import('./GeneralLedgerCoreSection').then((m) => ({
    default: m.GeneralLedgerCoreSection,
  })),
);
const DeferredRevenueReportSection = lazy(() =>
  import('./DeferredRevenueReportSection').then((m) => ({
    default: m.DeferredRevenueReportSection,
  })),
);
const StatementsSection = lazy(() =>
  import('./StatementsSection').then((m) => ({ default: m.StatementsSection })),
);
const OverviewSection = lazy(() =>
  import('./OverviewSection').then((m) => ({ default: m.OverviewSection })),
);
const CollectionsSection = lazy(() =>
  import('./CollectionsSection').then((m) => ({
    default: m.CollectionsSection,
  })),
);
const OverdueSection = lazy(() =>
  import('./OverdueSection').then((m) => ({ default: m.OverdueSection })),
);
const FollowUpSection = lazy(() =>
  import('./FollowUpSection').then((m) => ({ default: m.FollowUpSection })),
);
const CollectionMovementSection = lazy(() =>
  import('./CollectionMovementSection').then((m) => ({
    default: m.CollectionMovementSection,
  })),
);
const ExpensesSection = lazy(() =>
  import('./ExpensesSection').then((m) => ({ default: m.ExpensesSection })),
);
const PropertyAnalyticsSection = lazy(() =>
  import('./PropertyAnalyticsSection').then((m) => ({
    default: m.PropertyAnalyticsSection,
  })),
);
const OccupancySection = lazy(() =>
  import('./OccupancySection').then((m) => ({ default: m.OccupancySection })),
);
const ExpiringContractsSection = lazy(() =>
  import('./ExpiringContractsSection').then((m) => ({
    default: m.ExpiringContractsSection,
  })),
);
const MaintenanceReportSection = lazy(() =>
  import('./MaintenanceReportSection').then((m) => ({
    default: m.MaintenanceReportSection,
  })),
);
const OperationsOverviewSection = lazy(() =>
  import('./OperationsOverviewSection').then((m) => ({
    default: m.OperationsOverviewSection,
  })),
);
const ServicesReportSection = lazy(() =>
  import('./ServicesReportSection').then((m) => ({
    default: m.ServicesReportSection,
  })),
);

const SectionFallback = () => (
  <LoadingState variant="section" label="جارٍ تحميل التقرير..." />
);

type ReportViewPanelProps = Readonly<{
  activeSection: ReportSectionId;
  activeView: ReportViewId;
  model: ReportsWorkspaceModel;
  filters: ReportsFilterState;
  canExportReports: boolean;
  onDrill: ReportDrillHandler;
  statementFocus?: StatementProductFocus;
}>;

/**
 * The one canonical report-body dispatcher. Product targets select a body;
 * bodies retain their own lazy chunk and authoritative read-model inputs.
 */
export function ReportViewPanel({
  activeSection,
  activeView,
  model,
  filters,
  canExportReports,
  onDrill,
  statementFocus,
}: ReportViewPanelProps) {
  let body: React.ReactNode;

  if (activeSection === 'accounting') {
    if (activeView === 'general_ledger') {
      body = <GeneralLedgerCoreSection />;
    } else if (activeView === 'deferred_revenue') {
      body = (
        <DeferredRevenueReportSection
          {...model.sections.deferredRevenue}
          canExportReports={canExportReports}
        />
      );
    } else {
      body = <AccountingReportsSection {...model.sections.accounting} />;
    }
  } else if (activeSection === 'statements') {
    body = (
      <StatementsSection
        {...model.sections.statements}
        filters={filters}
        focus={statementFocus}
      />
    );
  } else {
    switch (activeView) {
      case 'collections':
        body = (
          <CollectionsSection
            {...model.sections.collections}
            canExportReports={canExportReports}
          />
        );
        break;
      case 'overdue':
        body = (
          <OverdueSection
            {...model.sections.overdue}
            canExportReports={canExportReports}
          />
        );
        break;
      case 'follow_up':
        body = (
          <FollowUpSection
            rows={model.sections.overdue.rows}
            isLoading={model.sections.overdue.isLoading}
            canExportReports={canExportReports}
          />
        );
        break;
      case 'collection_movement': {
        const collections = model.sections.collections;
        body = (
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
        break;
      }
      case 'expenses':
        body = (
          <ExpensesSection
            {...model.sections.expenses}
            from={filters.from}
            to={filters.to}
            onDrill={onDrill}
            canExportReports={canExportReports}
          />
        );
        break;
      case 'property_analytics':
        body = (
          <PropertyAnalyticsSection
            occupancyRows={model.sections.occupancy.occupancyRows}
            expenseRows={model.sections.expenses.report?.byProperty ?? []}
            performanceRows={model.sections.propertyPerformance?.rows ?? []}
            isLoading={
              model.sections.propertyPerformance?.isLoading ??
              (model.sections.occupancy.isLoading ||
                model.sections.expenses.isLoading)
            }
            onDrill={onDrill}
            model={model}
            filters={filters}
            executive={model.sections.propertyPerformance?.executive}
            comparison={model.sections.propertyPerformance?.comparison}
            benchmark={model.sections.propertyPerformance?.benchmark}
            insights={model.sections.propertyPerformance?.insights}
            previousPeriod={
              model.sections.propertyPerformance?.previousPeriod ?? null
            }
          />
        );
        break;
      case 'occupancy':
        body = (
          <OccupancySection
            {...model.sections.occupancy}
            canExportReports={canExportReports}
          />
        );
        break;
      case 'expiring':
        body = (
          <ExpiringContractsSection
            expiringRows={model.sections.occupancy.expiringRows}
            vacancyAnalytics={model.sections.occupancy.vacancyAnalytics}
            canExportReports={canExportReports}
            isLoading={model.sections.occupancy.isLoading}
          />
        );
        break;
      case 'maintenance_analytics':
        body = (
          <MaintenanceReportSection
            {...model.sections.maintenance}
            canExportReports={canExportReports}
          />
        );
        break;
      case 'operations_overview':
        body = (
          <OperationsOverviewSection
            expenseReport={model.sections.expenses.report}
            maintenanceRows={model.sections.maintenance.rows}
            maintenanceSummary={model.sections.maintenance.summary}
            isLoading={
              model.sections.expenses.isLoading ||
              model.sections.maintenance.isLoading
            }
            onDrill={onDrill}
          />
        );
        break;
      case 'services':
        body = (
          <ServicesReportSection
            filters={filters}
            canExportReports={canExportReports}
          />
        );
        break;
      case 'overview':
      default:
        body = (
          <OverviewSection
            summary={model.sections.overview.summary}
            collectionSummary={model.sections.overview.collectionSummary}
            collectionRate={model.sections.collections.collectionRate}
            occupancyRows={model.sections.occupancy.occupancyRows}
            expiringRows={model.sections.occupancy.expiringRows}
            expenseRows={model.sections.expenses.report?.byProperty ?? []}
            overdueSummary={model.sections.overdue.summary}
            maintenanceSummary={model.sections.maintenance.summary}
            from={filters.from}
            to={filters.to}
            canExportReports={canExportReports}
            isLoading={
              model.sections.overview.isLoading ||
              model.sections.collections.isLoading ||
              model.sections.occupancy.isLoading ||
              model.sections.overdue.isLoading ||
              model.sections.maintenance.isLoading
            }
            onDrill={onDrill}
          />
        );
    }
  }

  return (
    <div className="min-w-0" key={activeSection}>
      <Suspense fallback={<SectionFallback />}>
        <SectionTabPanel id={activeSection} activeId={activeSection}>
          {body}
        </SectionTabPanel>
      </Suspense>
    </div>
  );
}
