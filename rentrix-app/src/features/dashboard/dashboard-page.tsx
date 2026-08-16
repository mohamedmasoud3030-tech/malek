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
import { getDashboardSnapshot } from './dashboard-snapshot';
import { DashboardVisualScope } from './dashboard-visual-scope';
import { HeroBanner } from './components/hero-banner';
import { KpiGrid } from './components/kpi-grid';
import { QuickActions, filterQuickActionsByPermission } from './components/quick-actions';
import { ExpiringContractsSection } from './components/expiring-contracts-section';
import { OverdueSection } from './components/overdue-section';
import { ArrearsBreakdown } from './components/arrears-breakdown';
import { DashboardCharts } from './components/dashboard-charts';
import { AlertCenter } from './components/alert-center';
import { buildExpiringContracts, buildOverdueTenantRows, toDateInputValue } from './dashboard-utils';

/**
 * R1 — Dashboard Truth.
 *
 * Every KPI on this page comes from the authoritative server read model
 * (rpt_dashboard_snapshot). The page never counts, filters, or sums datasets
 * to produce an operational or financial number; the only remaining auxiliary
 * query is the data-integrity audit count, which is a diagnostics feature
 * with its own service boundary.
 */
export function DashboardPage() {
  const { authorization, canAccess } = useAuth();
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
    dataUpdatedAt,
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

  const integrityWarningsQuery = useQuery({
    queryKey: ['data-integrity', 'audit-count'],
    queryFn: () => fetchIntegrityWarningsCount(),
    retry: false,
  });

  // Honest partial data: a failed auxiliary query is reported as unavailable
  // (undefined), never silently converted into a fake zero count.
  const integrityWarningsCount = integrityWarningsQuery.isError ? undefined : (integrityWarningsQuery.data ?? 0);

  const hasQuickActions = filterQuickActionsByPermission(canAccess).length > 0;
  const showAnalytics = (snapshot?.arrears.totalOverdue ?? 0) > 0;
  const hasDashboardError = isError || isRefetchError;
  const snapshotUnavailable = hasDashboardError && !snapshot;

  return (
    <PageLayout className="dashboard-page-shell pb-8" visualVariant="malek-pro">
      <DashboardVisualScope>
        <HeroBanner
          snapshot={snapshot}
          isLoading={isLoading}
          isRefreshing={isFetching && !isLoading}
          lastUpdatedAt={dataUpdatedAt || undefined}
          settings={settings}
          today={today}
        />

        {hasDashboardError ? (
          <ErrorState
            title={snapshotUnavailable ? 'تعذر تحميل لوحة التحكم' : 'تعذر تحديث لوحة التحكم'}
            description={
              snapshotUnavailable
                ? 'لم نتمكن من جلب مؤشرات الأداء الحالية. تحقق من الاتصال ثم أعد المحاولة.'
                : 'المعروض أدناه آخر نسخة ناجحة من البيانات. تحقق من الاتصال ثم أعد المحاولة للتحديث.'
            }
            error={error}
            onRetry={retryDashboard}
          />
        ) : null}

        {snapshotUnavailable ? null : (
          <>
            {/* Distinct label from the inner AlertCenter section («الأولوية الآن»)
                so the two nested landmarks do not collide (axe landmark-unique). */}
            <section data-dashboard-section="priorities" aria-label="متابعة الأولويات">
              {isLoading ? (
                /* While the snapshot is loading, counts are UNKNOWN — a
                   loading state is honest; rows of «غير متاح» would misread
                   as failed sources and pre-R1 zeros were fake. */
                <LoadingState variant="section" label="جارٍ تحميل أولويات المتابعة" />
              ) : (
              <AlertCenter
                expiringContractsCount={snapshot?.contracts.expiring30}
                overdueInvoicesCount={snapshot?.arrears.overdueCount}
                urgentMaintenanceCount={snapshot?.maintenance.urgentOpen}
                vacantUnitsCount={snapshot?.occupancy.vacantUnits}
                unmatchedBankTxCount={snapshot?.exceptions.unmatchedBankLines}
                pendingSettlementsCount={snapshot?.exceptions.pendingSettlements}
                integrityWarningsCount={integrityWarningsCount}
              />
              )}
            </section>

            <section className="dashboard-section" aria-label="صورة الأداء" data-dashboard-section="kpis">
              <SectionHeader title="صورة الأداء" description="أربع مؤشرات قرار مرتبطة بمصادرها التفصيلية" />
              <KpiGrid snapshot={snapshot} isLoading={isLoading} settings={settings} />
            </section>

            {hasQuickActions ? (
              <div data-dashboard-section="actions">
                <QuickActions />
              </div>
            ) : null}

            <section className="dashboard-section" aria-label="قوائم العمل" data-dashboard-section="work-queues">
              <SectionHeader title="قوائم العمل" description="متابعة مركزة للحالات الأعلى أولوية بعد قراءة المؤشرات" />
              <div className="dashboard-queues-grid">
                <ExpiringContractsSection
                  rows={expiringContracts}
                  totalCount={snapshot?.contracts.expiring30}
                  isLoading={isLoading}
                  settings={settings}
                />
                <OverdueSection
                  rows={overdueRows}
                  totalCount={snapshot?.arrears.overdueCount}
                  isLoading={isLoading}
                  settings={settings}
                />
              </div>
            </section>

            <section className="dashboard-section" aria-label="المحفظة والتحصيل" data-dashboard-section="trends">
              <SectionHeader title="المحفظة والتحصيل" description="ملخصات ثانوية للانتقال إلى التفاصيل، وليست جدولاً محاسبياً كثيفاً" />
              <DashboardCharts snapshot={snapshot} isLoading={isLoading} settings={settings} />
            </section>

            {showAnalytics ? (
              <section className="dashboard-section" aria-label="تحليلات مساندة" data-dashboard-section="analytics">
                <SectionHeader title="تحليلات مساندة" description="تفاصيل أعمار الذمم بعد ترتيب الأعمال العاجلة" />
                <ArrearsBreakdown snapshot={snapshot} settings={settings} />
              </section>
            ) : null}

            <OnboardingChecklist progress={progress} canManageSetup={canManageSetup} />
          </>
        )}
      </DashboardVisualScope>
    </PageLayout>
  );
}
