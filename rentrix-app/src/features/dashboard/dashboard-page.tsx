import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/components/ui/error-state';
import { PageLayout } from '@/components/layout/page-layout';
import { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import { OnboardingChecklist } from '@/features/onboarding/OnboardingChecklist';
import type { OnboardingProgress } from '@/features/onboarding/useOnboarding';
import { getDashboardSnapshot } from './dashboard-snapshot';
import { HeroBanner } from './components/hero-banner';
import { KpiGrid } from './components/kpi-grid';
import { QuickActions } from './components/quick-actions';
import { ExpiringContractsSection } from './components/expiring-contracts-section';
import { OverdueSection } from './components/overdue-section';
import { FinancialSummary } from './components/financial-summary';
import { ArrearsBreakdown } from './components/arrears-breakdown';
import { DashboardCharts } from './components/dashboard-charts';
import { AlertCenter } from './components/alert-center';
import { buildExpiringContracts, buildOverdueTenantRows, toDateInputValue } from './dashboard-utils';
import type { ContractListItem } from '@/features/contracts/services/contractService';

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
    <PageLayout className="space-y-5">
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

      {/* Alert Center - Critical alerts for managers */}
      <AlertCenter
        expiringContracts={(snapshot?.activeContracts ?? []) as ContractListItem[]}
        overdueInvoices={(snapshot?.arrears.overdueInvoices ?? []).map((invoice) => ({
          id: invoice.invoiceId,
          amount: invoice.remainingAmount,
          paid_amount: 0,
          due_date: invoice.dueDate,
          tenant_name: invoice.tenantName,
        }))}
        urgentMaintenance={snapshot?.maintenance?.urgentRequests ?? []}
      />

      <KpiGrid snapshot={snapshot} isLoading={isLoading} settings={settings} />
      <QuickActions />
      <DashboardCharts snapshot={snapshot} isLoading={isLoading} settings={settings} />

      <div className="grid gap-5 lg:grid-cols-2">
        <ExpiringContractsSection rows={expiringContracts} isLoading={isLoading} settings={settings} />
        <OverdueSection rows={overdueRows} isLoading={isLoading} settings={settings} />
      </div>

      <FinancialSummary snapshot={snapshot} isLoading={isLoading} settings={settings} />
      <ArrearsBreakdown snapshot={snapshot} settings={settings} />
    </PageLayout>
  );
}
