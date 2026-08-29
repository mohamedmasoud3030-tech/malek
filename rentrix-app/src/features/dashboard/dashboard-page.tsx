import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
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
import { getDashboardSnapshot } from './dashboard-snapshot';
import { OfficePulse } from './components/office-pulse';
import { ExpiringContractsSection } from './components/expiring-contracts-section';
import { OverdueSection } from './components/overdue-section';
import { UrgentMaintenanceSection } from './components/urgent-maintenance-section';
import { MaintenanceFollowUpSection } from './components/maintenance-follow-up-section';
import {
  buildMaintenanceFollowUpSignal,
  EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL,
} from './maintenance-follow-up-signal';
import { useMaintenance } from '@/features/maintenance/use-maintenance';
import { UtilityObligationsSection } from './components/utility-obligations-section';
import { VacantUnitsSection } from './components/vacant-units-section';
import { buildUtilityObligationsSignal, EMPTY_UTILITY_OBLIGATIONS_SIGNAL } from './utility-obligations-signal';
import { buildExpiringContracts, buildOverdueTenantRows, toDateInputValue } from './dashboard-utils';
import { OwnerObligationsSection } from './components/owner-obligations-section';

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
 * MALEK command center.
 * Financial and operational truth remains server-authoritative through
 * rpt_dashboard_snapshot. The presentation is deliberately bounded and compact:
 * performance → vacancy/collection → problems → renewals/owner obligations.
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
  const overdueRows = useMemo(
    () => buildOverdueTenantRows(snapshot?.queues.overdueInvoices),
    [snapshot?.queues.overdueInvoices],
  );

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

            <DashboardGroup eyebrow="الآن" title="أداء المكتب" ariaLabel="أداء المكتب" sectionId="office-performance">
              <OfficePulse snapshot={snapshot} isLoading={isLoading} settings={settings} />
            </DashboardGroup>

            <div className="grid min-w-0 gap-3 xl:grid-cols-12 xl:items-start">
              <section className="min-w-0 xl:col-span-7" aria-label="الوحدات الفارغة" data-dashboard-section="vacant-units">
                <VacantUnitsSection
                  analytics={vacancyAnalytics}
                  isLoading={unitsQuery.isLoading || (hasVacantUnit && contractsQuery.isLoading)}
                  isError={unitsQuery.isError}
                  detailsUnavailable={vacancyDetailsUnavailable}
                  settings={settings}
                />
              </section>

              <section className="min-w-0 xl:col-span-5" aria-label="الفلوس المطلوب تحصيلها" data-dashboard-section="collections">
                <OverdueSection
                  rows={overdueRows}
                  totalCount={snapshot?.arrears.overdueCount}
                  isLoading={isLoading}
                  isError={hasDashboardError}
                  settings={settings}
                />
              </section>
            </div>

            <DashboardGroup eyebrow="خدمات" title="المشاكل والصيانة" ariaLabel="المشاكل والصيانة" sectionId="maintenance-problems">
              <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3" data-dashboard-maintenance-problems>
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
              </div>
            </DashboardGroup>

            <div className="grid min-w-0 gap-3 xl:grid-cols-12 xl:items-start" data-dashboard-closing-row>
              <section className="min-w-0 xl:col-span-7" aria-label="العقود القريبة من الانتهاء" data-dashboard-section="expiring-contracts">
                <ExpiringContractsSection
                  rows={expiringContracts}
                  totalCount={snapshot?.contracts.expiring30}
                  isLoading={isLoading}
                  isError={hasDashboardError}
                  settings={settings}
                />
              </section>

              <section className="min-w-0 xl:col-span-5" aria-label="مستحقات الملاك" data-dashboard-section="owner-obligations">
                <OwnerObligationsSection snapshot={snapshot} isLoading={isLoading} settings={settings} />
              </section>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
