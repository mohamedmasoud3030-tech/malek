import './dashboard-v2.css';
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataRefreshAlert } from '@/components/data-refresh-alert';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { ErrorState } from '@/components/ui/error-state';
import { SectionHeader } from '@/components/ui/section-header';
import { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import { useAuth } from '@/hooks/use-auth';
import { OnboardingChecklist } from '@/features/onboarding/OnboardingChecklist';
import type { OnboardingProgress } from '@/features/onboarding/useOnboarding';
import { useUtilityBills } from '@/features/utilities/use-utilities';
import { useAllContracts } from '@/features/contracts/useContracts';
import { useAllUnits } from '@/features/units/use-units';
import { buildVacancyAnalytics } from '@/features/units/vacancy-analytics';
import { listPropertyTitles } from '@/features/properties/property-service';
import { useFinancialCashflowReport } from '@/features/financials/reports/useFinancialReports';
import { getDashboardSnapshot } from './dashboard-snapshot';
import { useDailyCollectionSeries } from './daily-collection-series';
import { OfficePulse } from './components/office-pulse';
import { FinancialPerformanceSection } from './components/financial-performance-section';
import { NeedsAttentionSection } from './components/needs-attention-section';
import { OccupancySection } from './components/occupancy-section';
import { CollectionsSection } from './components/collections-section';
import { MaintenanceSection } from './components/maintenance-section';
import { UpcomingContractsSection } from './components/upcoming-contracts-section';
import { PropertyHealthSection } from './components/property-health-section';
import { OwnerObligationsSection } from './components/owner-obligations-section';
import { UtilityObligationsSection } from './components/utility-obligations-section';
import { buildNeedsAttentionSignal } from './needs-attention-signal';
import { buildMaintenanceDashboardSummary } from './maintenance-dashboard-summary';
import { buildPropertyHealthRows } from './property-health-signal';
import { buildMaintenanceFollowUpSignal } from './maintenance-follow-up-signal';
import { useMaintenance } from '@/features/maintenance/use-maintenance';
import { buildUtilityObligationsSignal } from './utility-obligations-signal';
import { buildExpiringContracts, toDateInputValue } from './dashboard-utils';
import { buildMonthlyCashflowChartRows, getFinancialPerformanceRange, type FinancialPerformanceWindow } from './financial-performance';

const dashboardGroupAccent: Record<string, string> = {
  'office-pulse': 'bg-primary',
  'financial-performance': 'bg-info',
  'needs-attention': 'bg-warning',
  occupancy: 'bg-info',
  collections: 'bg-success',
  maintenance: 'bg-warning',
  'upcoming-contracts': 'bg-primary',
  'property-health': 'bg-info',
  'owner-obligations': 'bg-success',
};

type DashboardGroupPriority = 'primary' | 'attention' | 'supporting';

const DashboardGroup = memo(function DashboardGroup({
  eyebrow,
  title,
  ariaLabel,
  sectionId,
  priority = 'supporting',
  showHeader = true,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  ariaLabel: string;
  sectionId: string;
  priority?: DashboardGroupPriority;
  showHeader?: boolean;
  children: ReactNode;
}>) {
  return (
    <section
      id={`dashboard-${sectionId}`}
      className="min-w-0 space-y-2"
      aria-label={ariaLabel}
      data-dashboard-section={sectionId}
      data-dashboard-priority={priority}
    >
      {showHeader ? (
        <div className="flex min-w-0 items-end gap-2.5 border-b border-border/45 pb-1.5" data-dashboard-group-header>
          <span
            className={`mb-0.5 h-5 w-1 shrink-0 rounded-full ${dashboardGroupAccent[sectionId] ?? 'bg-primary'}`}
            aria-hidden="true"
          />
          <SectionHeader eyebrow={eyebrow} title={title} className="mb-0 min-w-0 flex-1 px-0" />
        </div>
      ) : (
        <h2 className="sr-only">{title}</h2>
      )}
      {children}
    </section>
  );
});

/**
 * MALEK Property Office Command Center.
 *
 * The page is deliberately owner-first: one semantic reading order is shared by
 * mobile, desktop and assistive technology. The first section answers what needs
 * a decision now; the remaining sections explain the office state without a
 * second navigation rail or hidden dashboard-only disclosure layer.
 *
 * Financial and operational truth remains server-authoritative through
 * rpt_dashboard_snapshot; the monthly cash series comes from the canonical
 * Reports cashflow service and the daily collection sparkline from
 * rpt_daily_collection.
 */
export function DashboardPage() {
  const { authorization } = useAuth();
  const canManageSetup = authorization?.role === 'ADMIN' || authorization?.role === 'MANAGER';
  const now = useMemo(() => new Date(), []);
  const settings = useCompanyFormatters();
  const today = toDateInputValue(now);

  const {
    data: snapshot,
    isLoading,
    isError,
    error,
    refetch,
    isRefetchError,
  } = useQuery({
    queryKey: ['dashboard-snapshot', now.getMonth() + 1, now.getFullYear(), today],
    queryFn: () => getDashboardSnapshot(now),
    retry: false,
  });

  const retryDashboard = useCallback(() => {
    refetch().catch(() => undefined);
  }, [refetch]);

  useEffect(() => {
    if (!import.meta.env.VITE_E2E || typeof window === 'undefined') return;
    const handleE2ERefetch = () => {
      refetch().catch(() => undefined);
    };
    window.addEventListener('malek-dashboard-e2e-refetch', handleE2ERefetch);
    return () => window.removeEventListener('malek-dashboard-e2e-refetch', handleE2ERefetch);
  }, [refetch]);

  const progress = useMemo<OnboardingProgress>(
    () => ({
      hasProperty: (snapshot?.portfolio.properties ?? 0) > 0,
      hasUnit: (snapshot?.portfolio.units ?? 0) > 0,
      hasContract: (snapshot?.contracts.active ?? 0) > 0,
      hasInvoice: (snapshot?.billing.invoicesTotalCount ?? 0) > 0,
    }),
    [snapshot],
  );

  const expiringContracts = useMemo(
    () => buildExpiringContracts(snapshot?.queues.expiringContracts),
    [snapshot?.queues.expiringContracts],
  );

  const periodStart = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  const dailySeriesQuery = useDailyCollectionSeries(periodStart, today);

  const [performanceWindow, setPerformanceWindow] = useState<FinancialPerformanceWindow>('six_months');
  const performanceRange = useMemo(
    () => getFinancialPerformanceRange(performanceWindow, now),
    [performanceWindow, now],
  );
  const cashflowQuery = useFinancialCashflowReport({
    dateFrom: performanceRange.dateFrom,
    dateTo: performanceRange.dateTo,
  });
  const chartRows = useMemo(
    () => buildMonthlyCashflowChartRows(cashflowQuery.data?.rows),
    [cashflowQuery.data],
  );
  const retryCashflow = useCallback(() => {
    cashflowQuery.refetch().catch(() => undefined);
  }, [cashflowQuery]);

  const utilityBillsQuery = useUtilityBills();
  const utilityObligations = useMemo(
    () => buildUtilityObligationsSignal(utilityBillsQuery.data, today),
    [utilityBillsQuery.data, today],
  );

  const unitsQuery = useAllUnits();
  const hasVacantUnit = useMemo(
    () => (unitsQuery.data ?? []).some((unit) => String(unit.status).trim().toLowerCase() === 'available'),
    [unitsQuery.data],
  );
  const contractsQuery = useAllContracts('all', { enabled: hasVacantUnit });
  const propertyTitlesQuery = useQuery({
    queryKey: ['dashboard', 'property-titles'],
    queryFn: listPropertyTitles,
    retry: false,
  });
  const propertyTitleMap = useMemo(
    () => new Map((propertyTitlesQuery.data ?? []).map((row) => [row.id, row.title])),
    [propertyTitlesQuery.data],
  );
  const vacancyAnalytics = useMemo(
    () => buildVacancyAnalytics(unitsQuery.data, contractsQuery.data?.rows, propertyTitleMap, today),
    [contractsQuery.data?.rows, propertyTitleMap, today, unitsQuery.data],
  );
  const vacancyDetailsUnavailable = hasVacantUnit
    && (contractsQuery.isError || Boolean(contractsQuery.data?.truncated));

  const maintenanceQuery = useMaintenance('all', '');
  const unitNumberMap = useMemo(
    () => new Map((unitsQuery.data ?? []).map((unit) => [unit.id, unit.unit_number ?? ''])),
    [unitsQuery.data],
  );
  const maintenanceFollowUp = useMemo(
    () => buildMaintenanceFollowUpSignal(maintenanceQuery.data, today, propertyTitleMap, unitNumberMap),
    [maintenanceQuery.data, today, propertyTitleMap, unitNumberMap],
  );
  const maintenanceSummary = useMemo(
    () => buildMaintenanceDashboardSummary(maintenanceQuery.data, today, snapshot?.maintenance.urgentOpen),
    [maintenanceQuery.data, snapshot?.maintenance.urgentOpen, today],
  );

  const attentionSourcesComplete = !(isError || isRefetchError)
    && !unitsQuery.isError
    && !(hasVacantUnit && contractsQuery.isError)
    && !maintenanceQuery.isError
    && !utilityBillsQuery.isError;
  const needsAttention = useMemo(
    () => buildNeedsAttentionSignal({
      snapshot,
      vacancyAnalytics,
      utilityObligations,
      maintenanceFollowUp,
      isComplete: attentionSourcesComplete,
    }),
    [snapshot, vacancyAnalytics, utilityObligations, maintenanceFollowUp, attentionSourcesComplete],
  );

  const propertyHealthRows = useMemo(
    () => buildPropertyHealthRows({
      units: unitsQuery.data,
      vacantRows: vacancyAnalytics.vacantRows,
      maintenance: maintenanceQuery.data,
      propertyTitles: propertyTitleMap,
    }),
    [unitsQuery.data, vacancyAnalytics.vacantRows, maintenanceQuery.data, propertyTitleMap],
  );

  const hasDashboardError = isError || isRefetchError;
  const snapshotUnavailable = hasDashboardError && !snapshot;
  const hasSupplementalError = dailySeriesQuery.isError
    || cashflowQuery.isError
    || utilityBillsQuery.isError
    || unitsQuery.isError
    || (hasVacantUnit && contractsQuery.isError)
    || propertyTitlesQuery.isError
    || maintenanceQuery.isError;
  const supplementalIsFetching = dailySeriesQuery.isFetching
    || cashflowQuery.isFetching
    || utilityBillsQuery.isFetching
    || unitsQuery.isFetching
    || contractsQuery.isFetching
    || propertyTitlesQuery.isFetching
    || maintenanceQuery.isFetching;
  const retrySupplemental = () => {
    void Promise.all([
      dailySeriesQuery.refetch(),
      cashflowQuery.refetch(),
      utilityBillsQuery.refetch(),
      unitsQuery.refetch(),
      propertyTitlesQuery.refetch(),
      maintenanceQuery.refetch(),
      ...(hasVacantUnit ? [contractsQuery.refetch()] : []),
    ]);
  };

  return (
    <PageLayout size="wide">
      <PageHeader
        title="اليوم"
        description="قرارات اليوم وحالة المكتب بدون تعقيد."
        showTodayContext
      />

      <div data-dashboard-page className="space-y-3 lg:space-y-4">
        {hasDashboardError ? (
          <ErrorState
            title={snapshotUnavailable ? 'تعذر تحميل بيانات اليوم' : 'تعذر تحديث بيانات اليوم'}
            description={
              snapshotUnavailable
                ? 'لم نتمكن من جلب حالة العمل الحالية. تحقق من الاتصال ثم أعد المحاولة.'
                : 'المعروض أدناه آخر نسخة ناجحة من البيانات. تحقق من الاتصال ثم أعد المحاولة للتحديث.'
            }
            error={error}
            onRetry={retryDashboard}
          />
        ) : null}

        {!snapshotUnavailable && hasSupplementalError ? (
          <DataRefreshAlert
            title="بعض مؤشرات لوحة التحكم غير متاحة"
            description="المصادر التي نجحت ما زالت معروضة، لكن إجمالي الأولويات غير مكتمل حتى تنجح بقية القراءات."
            onRetry={retrySupplemental}
            isRefreshing={supplementalIsFetching}
          />
        ) : null}

        {snapshotUnavailable ? null : (
          <>
            {canManageSetup ? (
              <div data-dashboard-onboarding-slot>
                <OnboardingChecklist progress={progress} canManageSetup />
              </div>
            ) : null}

            <div className="grid min-w-0 grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-12 xl:items-start">
              <div className="min-w-0 xl:col-span-12">
                <DashboardGroup eyebrow="أولويات" title="يحتاج انتباهك" ariaLabel="الحالات التي تحتاج انتباهاً" sectionId="needs-attention" priority="attention" showHeader={false}>
                  <NeedsAttentionSection
                    signal={needsAttention}
                    isLoading={isLoading}
                    isError={hasDashboardError && !snapshot}
                    isPartial={!needsAttention.isComplete}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-12">
                <DashboardGroup eyebrow="الآن" title="نبض المكتب" ariaLabel="نبض المكتب" sectionId="office-pulse" priority="primary">
                  <OfficePulse
                    snapshot={snapshot}
                    isLoading={isLoading}
                    settings={settings}
                    dailySeries={dailySeriesQuery.data}
                    dailySeriesLoading={dailySeriesQuery.isLoading}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-5">
                <DashboardGroup eyebrow="تحصيل" title="التحصيل والمتأخرات" ariaLabel="التحصيل والمتأخرات" sectionId="collections" showHeader={false}>
                  <CollectionsSection
                    snapshot={snapshot}
                    isLoading={isLoading}
                    isError={hasDashboardError && !snapshot}
                    settings={settings}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-7">
                <DashboardGroup eyebrow="المحفظة" title="الإشغال والشغور" ariaLabel="الإشغال والشغور" sectionId="occupancy" showHeader={false}>
                  <OccupancySection
                    snapshot={snapshot}
                    analytics={vacancyAnalytics}
                    isLoading={isLoading || unitsQuery.isLoading || (hasVacantUnit && contractsQuery.isLoading)}
                    isError={unitsQuery.isError && !unitsQuery.data}
                    detailsUnavailable={vacancyDetailsUnavailable}
                    settings={settings}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-12">
                <DashboardGroup eyebrow="خدمات" title="الصيانة والخدمات" ariaLabel="الصيانة والخدمات" sectionId="maintenance" showHeader={false}>
                  <div className="grid min-w-0 gap-3 xl:grid-cols-12 xl:items-start">
                    <div className="min-w-0 xl:col-span-7">
                      <MaintenanceSection
                        summary={maintenanceSummary}
                        urgentRows={snapshot?.queues.urgentMaintenance ?? []}
                        followUp={maintenanceFollowUp}
                        isLoading={isLoading}
                        isError={hasDashboardError && !snapshot}
                        maintenanceIsLoading={maintenanceQuery.isLoading}
                        maintenanceIsError={maintenanceQuery.isError && !maintenanceQuery.data}
                      />
                    </div>
                    <div className="min-w-0 xl:col-span-5">
                      <UtilityObligationsSection
                        signal={utilityObligations}
                        isLoading={utilityBillsQuery.isLoading}
                        isError={utilityBillsQuery.isError && !utilityBillsQuery.data}
                        settings={settings}
                      />
                    </div>
                  </div>
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-7">
                <DashboardGroup eyebrow="عقود" title="العقود القادمة" ariaLabel="العقود القريبة من الانتهاء" sectionId="upcoming-contracts" showHeader={false}>
                  <UpcomingContractsSection
                    rows={expiringContracts}
                    expiring30={snapshot?.contracts.expiring30}
                    expiring60={snapshot?.contracts.expiring60}
                    expiring90={snapshot?.contracts.expiring90}
                    isLoading={isLoading}
                    isError={hasDashboardError && !snapshot}
                    settings={settings}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-5">
                <DashboardGroup eyebrow="المحفظة" title="صحة العقارات" ariaLabel="صحة العقارات" sectionId="property-health" showHeader={false}>
                  <PropertyHealthSection
                    rows={propertyHealthRows}
                    isLoading={unitsQuery.isLoading || maintenanceQuery.isLoading}
                    isError={(unitsQuery.isError && !unitsQuery.data) || (maintenanceQuery.isError && !maintenanceQuery.data)}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-7">
                <DashboardGroup eyebrow="الأداء المالي" title="أداء المكتب" ariaLabel="الأداء المالي" sectionId="financial-performance" priority="primary" showHeader={false}>
                  <FinancialPerformanceSection
                    snapshot={snapshot}
                    vacancyAnalytics={vacancyAnalytics}
                    vacancyDetailsUnavailable={vacancyDetailsUnavailable}
                    settings={settings}
                    window={performanceWindow}
                    onWindowChange={setPerformanceWindow}
                    chartRows={chartRows}
                    chartIsLoading={cashflowQuery.isLoading}
                    chartIsError={cashflowQuery.isError && !cashflowQuery.data}
                    onChartRetry={retryCashflow}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-5" data-dashboard-closing-row>
                <DashboardGroup eyebrow="ملاك" title="مستحقات الملاك" ariaLabel="مستحقات الملاك" sectionId="owner-obligations">
                  <OwnerObligationsSection snapshot={snapshot} isLoading={isLoading} settings={settings} />
                </DashboardGroup>
              </div>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
