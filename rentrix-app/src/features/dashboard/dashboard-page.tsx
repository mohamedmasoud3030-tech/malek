import { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/components/ui/error-state';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionHeader } from '@/components/ui/section-header';
import { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import { useAuth } from '@/hooks/use-auth';
import { OnboardingChecklist } from '@/features/onboarding/OnboardingChecklist';
import type { OnboardingProgress } from '@/features/onboarding/useOnboarding';
import { useUtilityBills } from '@/features/utilities/use-utilities';
import { useAllUnits } from '@/features/units/use-units';
import { listPropertyTitles } from '@/features/properties/property-service';
import { getDashboardSnapshot } from './dashboard-snapshot';
import { DashboardVisualScope } from './dashboard-visual-scope';
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
import { buildUtilityObligationsSignal, EMPTY_UTILITY_OBLIGATIONS_SIGNAL } from './utility-obligations-signal';
import { buildExpiringContracts, buildOverdueTenantRows, toDateInputValue } from './dashboard-utils';
import { OwnerObligationsSection } from './components/owner-obligations-section';

/**
 * MALEK Today workspace.
 *
 * This page is an action queue, not a second reporting dashboard. Portfolio
 * performance, vacancy and trend analysis belong to Reports; Today only keeps
 * items that require a decision, follow-up or review from the office.
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

  // Today consumes the canonical utilities service and only surfaces bills
  // that need follow-up; it does not duplicate the utilities register.
  const utilityBillsQuery = useUtilityBills();
  const utilityObligations = useMemo(
    () => (utilityBillsQuery.isError ? EMPTY_UTILITY_OBLIGATIONS_SIGNAL : buildUtilityObligationsSignal(utilityBillsQuery.data, today)),
    [utilityBillsQuery.data, utilityBillsQuery.isError, today],
  );

  // Unit/property reads are used only to name stalled maintenance correctly.
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

  // Urgency is how a request was reported; this derives which maintenance
  // items actually stopped moving and therefore need an office decision.
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
            <section className="dashboard-section" aria-label="ما يحتاج إجراء اليوم" data-dashboard-section="today-intro">
              <SectionHeader eyebrow="اليوم" title="ما يحتاج إجراء" />
              <p className="max-w-3xl text-sm font-semibold leading-6 text-muted-foreground">
                هنا تظهر الحالات التي تحتاج قرارًا أو متابعة من المكتب. الأخبار التي حدثت بالفعل مكانها جرس التنبيهات، ومؤشرات الأداء مكانها التقارير.
              </p>
            </section>

            {canManageSetup ? (
              <div data-dashboard-onboarding-slot className="dashboard-section">
                <OnboardingChecklist progress={progress} canManageSetup />
              </div>
            ) : null}

            <section className="dashboard-section" aria-label="تحصيلات تحتاج متابعة" data-dashboard-section="collections">
              <SectionHeader eyebrow="1 · تحصيل" title="تحصيلات تحتاج متابعة" />
              <OverdueSection
                rows={overdueRows}
                totalCount={snapshot?.arrears.overdueCount}
                isLoading={isLoading}
                isError={hasDashboardError}
                settings={settings}
              />
            </section>

            <section className="dashboard-section" aria-label="صيانة ومرافق تحتاج قرار" data-dashboard-section="maintenance-problems">
              <SectionHeader eyebrow="2 · خدمات" title="صيانة ومرافق تحتاج قرار" />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-dashboard-maintenance-problems>
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
            </section>

            <section className="dashboard-section" aria-label="عقود تحتاج قرار تجديد" data-dashboard-section="expiring-contracts">
              <SectionHeader eyebrow="3 · عقود" title="عقود تحتاج قرار تجديد" />
              <ExpiringContractsSection
                rows={expiringContracts}
                totalCount={snapshot?.contracts.expiring30}
                isLoading={isLoading}
                isError={hasDashboardError}
                settings={settings}
              />
            </section>

            <section className="dashboard-section" aria-label="تسويات ملاك تحتاج مراجعة" data-dashboard-section="owner-obligations">
              <SectionHeader eyebrow="4 · ملاك" title="تسويات ملاك تحتاج مراجعة" />
              <OwnerObligationsSection snapshot={snapshot} isLoading={isLoading} settings={settings} />
            </section>
          </>
        )}
      </DashboardVisualScope>
    </PageLayout>
  );
}
