import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/components/ui/error-state';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionHeader } from '@/components/ui/section-header';
import { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import { OnboardingChecklist } from '@/features/onboarding/OnboardingChecklist';
import type { OnboardingProgress } from '@/features/onboarding/useOnboarding';
import { getDashboardSnapshot } from './dashboard-snapshot';
import { HeroBanner } from './components/hero-banner';
import { KpiGrid } from './components/kpi-grid';
import { QuickActions } from './components/quick-actions';
import { ExpiringContractsSection } from './components/expiring-contracts-section';
import { OverdueSection } from './components/overdue-section';
import { ArrearsBreakdown } from './components/arrears-breakdown';
import { DashboardCharts } from './components/dashboard-charts';
import { AlertCenter } from './components/alert-center';
import { buildExpiringContracts, buildOverdueTenantRows, toDateInputValue } from './dashboard-utils';

export function DashboardPage() {
  const now = useMemo(() => new Date(), []);
  const settings = useCompanyFormatters();
  const today = toDateInputValue(now);

  const { data: snapshot, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard-snapshot', now.getMonth() + 1, now.getFullYear(), today],
    queryFn: () => getDashboardSnapshot(now),
  });

  const retryDashboard = useCallback(() => {
    refetch().catch(() => undefined);
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

  return (
    <PageLayout className="space-y-6 pb-8" data-dashboard-v2>
      <HeroBanner snapshot={snapshot} isLoading={isLoading} settings={settings} today={today} />

      <OnboardingChecklist progress={progress} />

      {isError ? (
        <ErrorState
          title="تعذر تحميل لوحة التحكم"
          description="لم نتمكن من جلب مؤشرات الأداء الحالية. تحقق من الاتصال ثم أعد المحاولة."
          error={error}
          onRetry={retryDashboard}
        />
      ) : null}

      <section className="space-y-3" aria-label="صورة الأداء" data-dashboard-section="kpis">
        <SectionHeader title="صورة الأداء" description="التحصيل والسيولة والمتأخرات للفترة الحالية" />
        <KpiGrid snapshot={snapshot} isLoading={isLoading} settings={settings} />
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]" data-dashboard-section="priorities">
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
        />
        <QuickActions />
      </div>

      <section className="space-y-4" aria-label="المحفظة والتحصيل" data-dashboard-section="trends">
        <SectionHeader title="المحفظة والتحصيل" description="قراءة سريعة تساعدك قبل فتح التقارير التفصيلية" />
        <DashboardCharts snapshot={snapshot} isLoading={isLoading} settings={settings} />
        <ArrearsBreakdown snapshot={snapshot} settings={settings} />
      </section>

      <section className="space-y-3" aria-label="قوائم العمل" data-dashboard-section="work-queues">
        <SectionHeader title="قوائم العمل" description="التفاصيل التي تحتاج متابعة بعد ترتيب الأولويات" />
        <div className="grid gap-5 lg:grid-cols-2">
          <ExpiringContractsSection rows={expiringContracts} isLoading={isLoading} settings={settings} />
          <OverdueSection rows={overdueRows} isLoading={isLoading} settings={settings} />
        </div>
      </section>
    </PageLayout>
  );
}
