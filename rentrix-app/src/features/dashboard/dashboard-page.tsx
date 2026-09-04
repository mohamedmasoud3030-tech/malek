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
import { OfficePulse } from './components/office-pulse';
import { FinancialPerformanceSection } from './components/financial-performance-section';
import { NeedsAttentionSection } from './components/needs-attention-section';
import { OccupancySection } from './components/occupancy-section';
import { CollectionsSection } from './components/collections-section';
import { buildNeedsAttentionSignal } from './needs-attention-signal';
import { buildMaintenanceFollowUpSignal } from './maintenance-follow-up-signal';
import { useMaintenance } from '@/features/maintenance/use-maintenance';
import { buildUtilityObligationsSignal } from './utility-obligations-signal';
import { toDateInputValue } from './dashboard-utils';
import { buildMonthlyCashflowChartRows, getFinancialPerformanceRange, type FinancialPerformanceWindow } from './financial-performance';

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
  eyebrow?: string;
  title?: string;
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
      {showHeader && eyebrow && title ? (
        <div className="flex min-w-0 items-end gap-2.5 border-b border-border/45 pb-1.5" data-dashboard-group-header>
          <span className="mb-0.5 h-5 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <SectionHeader eyebrow={eyebrow} title={title} className="mb-0 min-w-0 flex-1 px-0" />
        </div>
      ) : null}
      {children}
    </section>
  );
});

/**
 * MALEK Property Office Command Center.
 *
 * This surface is deliberately decision-first and compact. Detailed maintenance,
 * contract-expiry, property-health, utility and owner-settlement registers live
 * in their canonical workspaces and are represented here only when they require
 * attention. The dashboard must not duplicate those full detail surfaces.
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

  const supplementalEnabled = Boolean(snapshot);

  const [performanceWindow, setPerformanceWindow] = useState<FinancialPerformanceWindow>('six_months');
  const performanceRange = useMemo(
    () => getFinancialPerformanceRange(performanceWindow, now),
    [performanceWindow, now],
  );
  const cashflowQuery = useFinancialCashflowReport({
    dateFrom: performanceRange.dateFrom,
    dateTo: performanceRange.dateTo,
  }, { enabled: supplementalEnabled });
  const chartRows = useMemo(
    () => buildMonthlyCashflowChartRows(cashflowQuery.data?.rows),
    [cashflowQuery.data],
  );
  const retryCashflow = useCallback(() => {
    cashflowQuery.refetch().catch(() => undefined);
  }, [cashflowQuery]);

  const utilityBillsQuery = useUtilityBills(undefined, { enabled: supplementalEnabled });
  const utilityObligations = useMemo(
    () => buildUtilityObligationsSignal(utilityBillsQuery.data, today),
    [utilityBillsQuery.data, today],
  );

  const needsVacancyDetails = supplementalEnabled && (snapshot?.occupancy.vacantUnits ?? 0) > 0;
  const unitsQuery = useAllUnits({ enabled: needsVacancyDetails });
  const contractsQuery = useAllContracts('all', { enabled: needsVacancyDetails });
  const propertyTitlesQuery = useQuery({
    queryKey: ['dashboard', 'property-titles'],
    queryFn: listPropertyTitles,
    retry: false,
    enabled: needsVacancyDetails,
  });
  const propertyTitleMap = useMemo(
    () => new Map((propertyTitlesQuery.data ?? []).map((row) => [row.id, row.title])),
    [propertyTitlesQuery.data],
  );
  const vacancyAnalytics = useMemo(
    () => buildVacancyAnalytics(unitsQuery.data, contractsQuery.data?.rows, propertyTitleMap, today),
    [contractsQuery.data?.rows, propertyTitleMap, today, unitsQuery.data],
  );
  const vacancyDetailsUnavailable = needsVacancyDetails
    && (unitsQuery.isError || contractsQuery.isError || propertyTitlesQuery.isError || Boolean(contractsQuery.data?.truncated));

  const maintenanceQuery = useMaintenance('all', '', { enabled: supplementalEnabled });
  const maintenanceFollowUp = useMemo(
    () => buildMaintenanceFollowUpSignal(maintenanceQuery.data, today),
    [maintenanceQuery.data, today],
  );

  const attentionSourcesLoading = supplementalEnabled && (
    utilityBillsQuery.isLoading
    || maintenanceQuery.isLoading
    || (needsVacancyDetails && (unitsQuery.isLoading || contractsQuery.isLoading || propertyTitlesQuery.isLoading))
  );
  const attentionSourcesComplete = supplementalEnabled
    && !attentionSourcesLoading
    && !(isError || isRefetchError)
    && !(needsVacancyDetails && (unitsQuery.isError || contractsQuery.isError || propertyTitlesQuery.isError))
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

  const hasDashboardError = isError || isRefetchError;
  const snapshotUnavailable = hasDashboardError && !snapshot;
  const hasSupplementalError = utilityBillsQuery.isError
    || (needsVacancyDetails && (unitsQuery.isError || contractsQuery.isError || propertyTitlesQuery.isError))
    || maintenanceQuery.isError;
  const supplementalIsFetching = utilityBillsQuery.isFetching
    || (needsVacancyDetails && (unitsQuery.isFetching || contractsQuery.isFetching || propertyTitlesQuery.isFetching))
    || maintenanceQuery.isFetching;
  const retrySupplemental = () => {
    void Promise.all([
      utilityBillsQuery.refetch(),
      maintenanceQuery.refetch(),
      ...(needsVacancyDetails ? [
        unitsQuery.refetch(),
        contractsQuery.refetch(),
        propertyTitlesQuery.refetch(),
      ] : []),
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
                <DashboardGroup ariaLabel="الحالات التي تحتاج انتباهاً" sectionId="needs-attention" priority="attention" showHeader={false}>
                  <NeedsAttentionSection
                    signal={needsAttention}
                    isLoading={isLoading || attentionSourcesLoading}
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
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-5">
                <DashboardGroup ariaLabel="التحصيل والمتأخرات" sectionId="collections" showHeader={false}>
                  <CollectionsSection
                    snapshot={snapshot}
                    isLoading={isLoading}
                    settings={settings}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-7">
                <DashboardGroup ariaLabel="الإشغال والشغور" sectionId="occupancy" showHeader={false}>
                  <OccupancySection
                    snapshot={snapshot}
                    analytics={vacancyAnalytics}
                    isLoading={isLoading || (needsVacancyDetails && (unitsQuery.isLoading || contractsQuery.isLoading || propertyTitlesQuery.isLoading))}
                    isError={needsVacancyDetails && unitsQuery.isError && !unitsQuery.data}
                    detailsUnavailable={vacancyDetailsUnavailable}
                    settings={settings}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-12">
                <DashboardGroup ariaLabel="الأداء المالي" sectionId="financial-performance" showHeader={false}>
                  <FinancialPerformanceSection
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
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
