import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { FinanceExceptionsSection } from './components/finance-exceptions-section';
import { UtilityObligationsSection } from './components/utility-obligations-section';
import { buildNeedsAttentionSignal } from './needs-attention-signal';
import { buildMaintenanceDashboardSummary } from './maintenance-dashboard-summary';
import { buildPropertyHealthRows } from './property-health-signal';
import {
  buildMaintenanceFollowUpSignal,
  EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL,
} from './maintenance-follow-up-signal';
import { useMaintenance } from '@/features/maintenance/use-maintenance';
import { buildUtilityObligationsSignal, EMPTY_UTILITY_OBLIGATIONS_SIGNAL } from './utility-obligations-signal';
import { buildExpiringContracts, toDateInputValue } from './dashboard-utils';
import { buildMonthlyCashflowChartRows, getFinancialPerformanceRange, type FinancialPerformanceWindow } from './financial-performance';

function DashboardGroup({
  eyebrow,
  title,
  ariaLabel,
  sectionId,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  ariaLabel: string;
  sectionId: string;
  children: ReactNode;
}>) {
  return (
    <section className="min-w-0 space-y-2.5" aria-label={ariaLabel} data-dashboard-section={sectionId}>
      <SectionHeader eyebrow={eyebrow} title={title} className="mb-0 px-0.5" />
      {children}
    </section>
  );
}

/**
 * MALEK Property Office Command Center.
 *
 * Financial and operational truth remains server-authoritative through
 * rpt_dashboard_snapshot; the monthly cash series comes from the canonical
 * Reports cashflow service and the daily collection sparkline from
 * rpt_daily_collection. The page composes those read models into nine
 * decision sections:
 *
 *   pulse → financial performance → needs attention → occupancy →
 *   collections → maintenance → contracts → property health → owner obligations.
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

  // Daily collection sparkline — authoritative server aggregate for the month.
  const periodStart = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  const dailySeriesQuery = useDailyCollectionSeries(periodStart, today);

  // Financial performance — canonical Reports monthly cashflow service.
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
    () => (utilityBillsQuery.isError ? EMPTY_UTILITY_OBLIGATIONS_SIGNAL : buildUtilityObligationsSignal(utilityBillsQuery.data, today)),
    [utilityBillsQuery.data, utilityBillsQuery.isError, today],
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
    () => (maintenanceQuery.isError
      ? EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL
      : buildMaintenanceFollowUpSignal(maintenanceQuery.data, today, propertyTitleMap, unitNumberMap)),
    [maintenanceQuery.data, maintenanceQuery.isError, today, propertyTitleMap, unitNumberMap],
  );
  const maintenanceSummary = useMemo(
    () => buildMaintenanceDashboardSummary(maintenanceQuery.data, today, snapshot?.maintenance.urgentOpen),
    [maintenanceQuery.data, snapshot?.maintenance.urgentOpen, today],
  );

  const needsAttention = useMemo(
    () => buildNeedsAttentionSignal({
      snapshot,
      vacancyAnalytics,
      utilityObligations,
      maintenanceFollowUp,
    }),
    [snapshot, vacancyAnalytics, utilityObligations, maintenanceFollowUp],
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

  return (
    <PageLayout size="wide" className="pb-8" visualVariant="malek-pro">
      <PageHeader title="لوحة التحكم" />

      <div className="space-y-5 lg:space-y-6">
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

        {snapshotUnavailable ? null : (
          <>
            {canManageSetup ? (
              <div data-dashboard-onboarding-slot>
                <OnboardingChecklist progress={progress} canManageSetup />
              </div>
            ) : null}

            {/*
              One intentional 12-column workspace. DOM order is the mobile
              priority (pulse → needs attention → collections → occupancy →
              financial trend → maintenance → contracts → property health →
              owner obligations); xl:order restores the desktop hierarchy and
              col-spans set the 7/5 · 8/4 relationships.
            */}
            <div className="grid min-w-0 grid-cols-1 gap-5 lg:gap-6 xl:grid-cols-12 xl:items-start">
              <div className="min-w-0 xl:col-span-12 xl:order-1">
                <DashboardGroup eyebrow="الآن" title="نبض المكتب" ariaLabel="نبض المكتب" sectionId="office-pulse">
                  <OfficePulse
                    snapshot={snapshot}
                    isLoading={isLoading}
                    settings={settings}
                    dailySeries={dailySeriesQuery.data}
                    dailySeriesLoading={dailySeriesQuery.isLoading}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-12 xl:order-3">
                <DashboardGroup eyebrow="أولويات" title="يحتاج انتباهك" ariaLabel="الحالات التي تحتاج انتباهاً" sectionId="needs-attention">
                  <NeedsAttentionSection
                    signal={needsAttention}
                    isLoading={isLoading}
                    isError={hasDashboardError}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-5 xl:order-5">
                <DashboardGroup eyebrow="تحصيل" title="التحصيل والمتأخرات" ariaLabel="التحصيل والمتأخرات" sectionId="collections">
                  <CollectionsSection
                    snapshot={snapshot}
                    isLoading={isLoading}
                    isError={hasDashboardError}
                    settings={settings}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-7 xl:order-4">
                <DashboardGroup eyebrow="المحفظة" title="الإشغال والشغور" ariaLabel="الإشغال والشغور" sectionId="occupancy">
                  <OccupancySection
                    snapshot={snapshot}
                    analytics={vacancyAnalytics}
                    isLoading={isLoading || unitsQuery.isLoading || (hasVacantUnit && contractsQuery.isLoading)}
                    isError={unitsQuery.isError}
                    detailsUnavailable={vacancyDetailsUnavailable}
                    settings={settings}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-12 xl:order-2">
                <DashboardGroup eyebrow="الأداء المالي" title="أداء المكتب" ariaLabel="الأداء المالي" sectionId="financial-performance">
                  <FinancialPerformanceSection
                    snapshot={snapshot}
                    vacancyAnalytics={vacancyAnalytics}
                    vacancyDetailsUnavailable={vacancyDetailsUnavailable}
                    settings={settings}
                    window={performanceWindow}
                    onWindowChange={setPerformanceWindow}
                    chartRows={chartRows}
                    chartIsLoading={cashflowQuery.isLoading}
                    chartIsError={cashflowQuery.isError}
                    onChartRetry={retryCashflow}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-12 xl:order-6">
                <DashboardGroup eyebrow="خدمات" title="الصيانة والخدمات" ariaLabel="الصيانة والخدمات" sectionId="maintenance">
                  <div className="grid min-w-0 gap-3 xl:grid-cols-12 xl:items-start">
                    <div className="min-w-0 xl:col-span-7">
                      <MaintenanceSection
                        summary={maintenanceSummary}
                        urgentRows={snapshot?.queues.urgentMaintenance ?? []}
                        followUp={maintenanceFollowUp}
                        isLoading={isLoading}
                        isError={hasDashboardError}
                        maintenanceIsLoading={maintenanceQuery.isLoading}
                        maintenanceIsError={maintenanceQuery.isError}
                      />
                    </div>
                    <div className="min-w-0 xl:col-span-5">
                      <UtilityObligationsSection
                        signal={utilityObligations}
                        isLoading={utilityBillsQuery.isLoading}
                        isError={utilityBillsQuery.isError}
                        settings={settings}
                      />
                    </div>
                  </div>
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-7 xl:order-7">
                <DashboardGroup eyebrow="عقود" title="العقود القادمة" ariaLabel="العقود القريبة من الانتهاء" sectionId="upcoming-contracts">
                  <UpcomingContractsSection
                    rows={expiringContracts}
                    expiring30={snapshot?.contracts.expiring30}
                    expiring60={snapshot?.contracts.expiring60}
                    expiring90={snapshot?.contracts.expiring90}
                    isLoading={isLoading}
                    isError={hasDashboardError}
                    settings={settings}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-5 xl:order-8">
                <DashboardGroup eyebrow="المحفظة" title="صحة العقارات" ariaLabel="صحة العقارات" sectionId="property-health">
                  <PropertyHealthSection
                    rows={propertyHealthRows}
                    isLoading={unitsQuery.isLoading || maintenanceQuery.isLoading}
                    isError={unitsQuery.isError || maintenanceQuery.isError}
                  />
                </DashboardGroup>
              </div>

              <div className="min-w-0 xl:col-span-12 xl:order-9">
                <div className="grid min-w-0 gap-3 xl:grid-cols-12 xl:items-start" data-dashboard-closing-row>
                  <section className="min-w-0 xl:col-span-7" aria-label="مستحقات الملاك" data-dashboard-section="owner-obligations">
                    <SectionHeader eyebrow="ملاك" title="مستحقات الملاك" className="mb-2.5 px-0.5" />
                    <OwnerObligationsSection snapshot={snapshot} isLoading={isLoading} settings={settings} />
                  </section>

                  <section className="min-w-0 xl:col-span-5" aria-label="استثناءات مالية" data-dashboard-section="finance-exceptions">
                    <SectionHeader eyebrow="التزامات" title="استثناءات مالية" className="mb-2.5 px-0.5" />
                    <FinanceExceptionsSection snapshot={snapshot} isLoading={isLoading} />
                  </section>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
