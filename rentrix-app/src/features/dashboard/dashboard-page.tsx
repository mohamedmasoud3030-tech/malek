import { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/components/ui/error-state';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionHeader } from '@/components/ui/section-header';
import { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import { useAuth } from '@/hooks/use-auth';
import { OnboardingChecklist } from '@/features/onboarding/OnboardingChecklist';
import type { OnboardingProgress } from '@/features/onboarding/useOnboarding';
import { listBankStatementLines } from '@/features/financials/reconciliation/bankReconciliationService';
import { fetchIntegrityWarningsCount, fetchPendingSettlementsCount } from '@/services/action-center-counts';
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
      hasProperty: (snapshot?.operational.properties ?? 0) > 0,
      hasUnit: (snapshot?.operational.units ?? 0) > 0,
      hasContract: (snapshot?.operational.activeContracts ?? 0) > 0,
      hasInvoice: (snapshot?.financial.invoicesCount ?? 0) > 0,
    }),
    [snapshot],
  );

  const expiringContracts = useMemo(
    () => buildExpiringContracts(snapshot?.activeContracts, now),
    [snapshot?.activeContracts, now],
  );
  const overdueRows = useMemo(
    () => buildOverdueTenantRows(snapshot?.arrears.overdueInvoices),
    [snapshot?.arrears.overdueInvoices],
  );

  const unmatchedLinesQuery = useQuery({
    queryKey: ['bank-reconciliation', 'unmatched-count'],
    queryFn: () => listBankStatementLines({ bankAccountId: 'all', status: 'unmatched', from: '', to: '' }),
    retry: false,
  });

  const pendingSettlementsQuery = useQuery({
    queryKey: ['owner-settlements', 'ready-count'],
    queryFn: () => fetchPendingSettlementsCount(),
    retry: false,
  });

  const integrityWarningsQuery = useQuery({
    queryKey: ['data-integrity', 'audit-count'],
    queryFn: () => fetchIntegrityWarningsCount(),
    retry: false,
  });

  // Honest partial data: a failed auxiliary query is reported as unavailable
  // (undefined), never silently converted into a fake zero count.
  const unmatchedBankTxCount = unmatchedLinesQuery.isError ? undefined : (unmatchedLinesQuery.data?.length ?? 0);
  const pendingSettlementsCount = pendingSettlementsQuery.isError ? undefined : (pendingSettlementsQuery.data ?? 0);
  const integrityWarningsCount = integrityWarningsQuery.isError ? undefined : (integrityWarningsQuery.data ?? 0);

  const hasQuickActions = filterQuickActionsByPermission(canAccess).length > 0;
  const showAnalytics = (snapshot?.arrears.totalOverdue ?? 0) > 0;
  const hasDashboardError = isError || isRefetchError;
  const snapshotUnavailable = hasDashboardError && !snapshot;

  return (
    <PageLayout className="dashboard-page-shell pb-8">
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
            <section data-dashboard-section="priorities" aria-label="الأولوية الآن">
              <AlertCenter
                expiringContracts={snapshot?.activeContracts ?? []}
                overdueInvoices={(snapshot?.arrears.overdueInvoices ?? []).map((invoice) => ({
                  id: invoice.invoiceId,
                  amount: invoice.remainingAmount,
                  paid_amount: 0,
                  due_date: invoice.dueDate,
                  tenant_name: invoice.tenantName,
                }))}
                urgentMaintenance={snapshot?.maintenance?.urgentRequests ?? []}
                vacantUnitsCount={snapshot?.operational.vacantUnits ?? 0}
                unmatchedBankTxCount={unmatchedBankTxCount}
                pendingSettlementsCount={pendingSettlementsCount}
                integrityWarningsCount={integrityWarningsCount}
              />
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
                <ExpiringContractsSection rows={expiringContracts} isLoading={isLoading} settings={settings} />
                <OverdueSection rows={overdueRows} isLoading={isLoading} settings={settings} />
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
