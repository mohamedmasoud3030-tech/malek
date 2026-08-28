import { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionHeader } from '@/components/ui/section-header';
import { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import { useAuth } from '@/hooks/use-auth';
import { OnboardingChecklist } from '@/features/onboarding/OnboardingChecklist';
import type { OnboardingProgress } from '@/features/onboarding/useOnboarding';
import { fetchIntegrityWarningsCount } from '@/services/action-center-counts';
import { useUtilityBills } from '@/features/utilities/use-utilities';
import { useAllUnits } from '@/features/units/use-units';
import { listPropertyTitles } from '@/features/properties/property-service';
import { getDashboardSnapshot } from './dashboard-snapshot';
import { DashboardVisualScope } from './dashboard-visual-scope';
import { OfficePulse } from './components/office-pulse';
import { KpiGrid } from './components/kpi-grid';
import { ExpiringContractsSection } from './components/expiring-contracts-section';
import { OverdueSection } from './components/overdue-section';
import { UrgentMaintenanceSection } from './components/urgent-maintenance-section';
import { MaintenanceFollowUpSection } from './components/maintenance-follow-up-section';
import {
  buildMaintenanceFollowUpSignal,
  EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL,
} from './maintenance-follow-up-signal';
import { useMaintenance } from '@/features/maintenance/use-maintenance';
import { ArrearsBreakdown } from './components/arrears-breakdown';
import { DashboardCharts } from './components/dashboard-charts';
import { AlertCenter } from './components/alert-center';
import { UtilityObligationsSection } from './components/utility-obligations-section';
import { VacantUnitsSection } from './components/vacant-units-section';
import { buildUtilityObligationsSignal, EMPTY_UTILITY_OBLIGATIONS_SIGNAL } from './utility-obligations-signal';
import { buildVacantUnitsSignal, EMPTY_VACANT_UNITS_SIGNAL } from './vacant-units-signal';
import { buildExpiringContracts, buildOverdueTenantRows, toDateInputValue } from './dashboard-utils';

/**
 * MALEK command center.
 *
 * Financial and operational truth remains server-authoritative through
 * rpt_dashboard_snapshot. The page only changes presentation hierarchy:
 * urgent decisions → stable office pulse → bounded work queues → money and
 * obligations → operational health → deeper arrears analysis when needed.
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
    isFetching,
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
  const overdueRows = useMemo(
    () => buildOverdueTenantRows(snapshot?.queues.overdueInvoices),
    [snapshot?.queues.overdueInvoices],
  );

  // P3 — operational obligations. Today consumes the canonical utilities
  // service (complete paged read) and the shared obligation derivation instead
  // of inventing a second utilities authority.
  const utilityBillsQuery = useUtilityBills();
  const utilityObligations = useMemo(
    () => (utilityBillsQuery.isError ? EMPTY_UTILITY_OBLIGATIONS_SIGNAL : buildUtilityObligationsSignal(utilityBillsQuery.data, today)),
    [utilityBillsQuery.data, utilityBillsQuery.isError, today],
  );
  // A failed utilities read stays unknown rather than becoming a fake zero.
  const utilityObligationsCount = utilityBillsQuery.isError ? undefined : utilityObligations.actionableCount;

  // P3 — vacancy and out-of-service units. The vacant KPI stays the server
  // snapshot number; these reads only name the units behind it and surface the
  // maintenance-parked units the snapshot has no field for.
  const unitsQuery = useAllUnits();
  const propertyTitlesQuery = useQuery({
    queryKey: ['dashboard', 'property-titles'],
    queryFn: listPropertyTitles,
    retry: false,
  });
  const propertyTitleMap = useMemo(
    () => new Map((propertyTitlesQuery.data ?? []).map((row) => [row.id, row.title])),
    [propertyTitlesQuery.data],
  );
  const vacantUnits = useMemo(
    () => (unitsQuery.isError ? EMPTY_VACANT_UNITS_SIGNAL : buildVacantUnitsSignal(unitsQuery.data, propertyTitleMap)),
    [unitsQuery.data, unitsQuery.isError, propertyTitleMap],
  );

  // P3 — maintenance that stopped moving. Urgency is how a request was
  // reported; this reads what happened to it afterwards, through the same
  // derivation the Services register uses.
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

  const integrityWarningsQuery = useQuery({
    queryKey: ['data-integrity', 'audit-count'],
    queryFn: () => fetchIntegrityWarningsCount(),
    retry: false,
  });

  // A failed auxiliary source stays unknown. Never turn an unavailable count
  // into a reassuring fake zero on the user's action list.
  const integrityWarningsCount = integrityWarningsQuery.isError ? undefined : (integrityWarningsQuery.data ?? 0);

  const showAnalytics = (snapshot?.arrears.totalOverdue ?? 0) > 0;
  const hasDashboardError = isError || isRefetchError;
  const snapshotUnavailable = hasDashboardError && !snapshot;

  return (
    <PageLayout size="wide" className="dashboard-page-shell pb-8" visualVariant="malek-pro" onRefresh={retryDashboard} refreshing={isFetching && !isLoading}>
      <DashboardVisualScope>
        <h1 className="sr-only">اليوم</h1>
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
            <section className="dashboard-section" aria-label="مطلوب الآن" data-dashboard-section="work-now">
              {isLoading ? (
                <LoadingState variant="section" label="جارٍ تحميل الأعمال المطلوبة" />
              ) : (
                <AlertCenter
                  expiringContractsCount={snapshot?.contracts.expiring30}
                  overdueInvoicesCount={snapshot?.arrears.overdueCount}
                  urgentMaintenanceCount={snapshot?.maintenance.urgentOpen}
                  utilityObligationsCount={utilityObligationsCount}
                  vacantUnitsCount={snapshot?.occupancy.vacantUnits}
                  unmatchedBankTxCount={snapshot?.exceptions.unmatchedBankLines}
                  pendingSettlementsCount={snapshot?.exceptions.pendingSettlements}
                  integrityWarningsCount={integrityWarningsCount}
                />
              )}
            </section>

            {canManageSetup ? (
              <div data-dashboard-onboarding-slot className="dashboard-section">
                <OnboardingChecklist progress={progress} canManageSetup />
              </div>
            ) : null}

            <section className="dashboard-section" aria-label="نبض المكتب" data-dashboard-section="office-pulse">
              <SectionHeader eyebrow="الآن" title="نبض المكتب" />
              <OfficePulse snapshot={snapshot} isLoading={isLoading} settings={settings} />
            </section>

            <section className="dashboard-section" aria-label="العمل المنتظر" data-dashboard-section="work-queues">
              <SectionHeader eyebrow="متابعة" title="العمل المنتظر" />
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" data-dashboard-work-queues>
                <OverdueSection
                  rows={overdueRows}
                  totalCount={snapshot?.arrears.overdueCount}
                  isLoading={isLoading}
                  isError={hasDashboardError}
                  settings={settings}
                />
                <ExpiringContractsSection
                  rows={expiringContracts}
                  totalCount={snapshot?.contracts.expiring30}
                  isLoading={isLoading}
                  isError={hasDashboardError}
                  settings={settings}
                />
                <UrgentMaintenanceSection
                  rows={snapshot?.queues.urgentMaintenance ?? []}
                  totalCount={snapshot?.maintenance.urgentOpen}
                  isLoading={isLoading}
                  isError={hasDashboardError}
                />
                <MaintenanceFollowUpSection
                  signal={maintenanceFollowUp}
                  isLoading={maintenanceQuery.isLoading}
                  isError={maintenanceQuery.isError}
                />
                <UtilityObligationsSection
                  signal={utilityObligations}
                  isLoading={utilityBillsQuery.isLoading}
                  isError={utilityBillsQuery.isError}
                  settings={settings}
                />
                <VacantUnitsSection
                  signal={vacantUnits}
                  serverVacantCount={snapshot?.occupancy.vacantUnits}
                  isLoading={unitsQuery.isLoading}
                  isError={unitsQuery.isError}
                  settings={settings}
                />
              </div>
            </section>

            <section className="dashboard-section" aria-label="المال والالتزامات" data-dashboard-section="money-obligations">
              <SectionHeader eyebrow="مالي" title="المال والالتزامات" />
              <KpiGrid snapshot={snapshot} isLoading={isLoading} settings={settings} />
            </section>

            <section className="dashboard-section" aria-label="حالة التحصيل والمحفظة" data-dashboard-section="operational-health">
              <SectionHeader eyebrow="صورة تشغيلية" title="حالة التحصيل والمحفظة" />
              <DashboardCharts snapshot={snapshot} isLoading={isLoading} settings={settings} />
            </section>

            {showAnalytics ? (
              <section className="dashboard-section" aria-label="تحليل المتأخرات" data-dashboard-section="analytics">
                <SectionHeader eyebrow="تحليل" title="تحليل المتأخرات" />
                <ArrearsBreakdown snapshot={snapshot} settings={settings} />
              </section>
            ) : null}
          </>
        )}
      </DashboardVisualScope>
    </PageLayout>
  );
}
