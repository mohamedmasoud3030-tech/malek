import { useMemo } from 'react';
import { CrossRouteHint } from '@/components/layout/cross-route-hint';
import { PageHeader } from '@/components/layout/page-header';
import { useAuth } from '@/hooks/use-auth';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { PageLayout } from '@/components/layout/page-layout';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { FinancialReportsPreviewSection } from './components/financial-reports-preview-section';
import { getTodayLocalDateString } from './financials-date-utils';
import { useCollectionSummaryReport } from './reports/useFinancialReports';

function getCurrentMonthReportRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    dateFrom: getTodayLocalDateString(firstDay),
    dateTo: getTodayLocalDateString(lastDay),
    status: 'all' as const,
  };
}

/**
 * /financials — finance overview dashboard (IA 2026-08 decision: RETAIN as real overview)
 *
 * Structural decision: /financials is **retained** as a primary finance
 * overview because it provides operational value beyond navigation:
 * - monthly collection KPI preview (compact, not a duplicate table)
 * - cross-route hint to reports
 * It is **not** a decorative directory that only contains links users already
 * saw in the sidebar. Since finance 4 canonical hubs are now directly in the
 * primary sidebar (المالية → 5 entries), the overview does not need to duplicate
 * hub navigation. Workflow group cards that linked to the same 4 hubs were
 * removed (they duplicated sidebar primary). The overview now functions as a
 * real finance dashboard summary, not a required navigation hop.
 *
 * Navigation: Primary (finance overview or any of the 4 finance hubs) →
 * single SectionTabs (2 tabs per hub) → working screen (one secondary layer).
 * No duplicate lists (receipts/invoices/etc.) are embedded.
 */
export function FinancialsPage() {
  const { authorization } = useAuth();
  const { language, direction } = getAppLanguageState();
  const reportFilters = useMemo(() => getCurrentMonthReportRange(), []);
  const collectionReport = useCollectionSummaryReport(reportFilters);
  const canViewReports = canAccess(authorization, financialOperationPermissions.exportReports);

  return (
    <PageLayout dir={direction} size="wide" visualVariant="malek-pro">
      <div data-finance-root className="space-y-5">
        <div data-finance-header>
          <PageHeader
            title={translateSharedLabel('financialsSectionSummary', language)}
            description={translateSharedLabel('financialsPageDescription', language)}
          />
        </div>

        {/* Monthly collection KPI preview — operational value, not navigation */}
        <section data-finance-section aria-label="ملخص التحصيل الشهري" className="space-y-3">
          <FinancialReportsPreviewSection
            reportFilters={reportFilters}
            collectionSummary={collectionReport.data}
            isLoading={collectionReport.isLoading}
            isError={collectionReport.isError}
            error={collectionReport.error}
          />
        </section>

        <div data-finance-cluster>
          <CrossRouteHint
            message={translateSharedLabel('financialsPageHint', language)}
            action={
              canViewReports
                ? {
                    to: '/reports',
                    label: translateSharedLabel('financialsSectionReports', language),
                  }
                : undefined
            }
          />
        </div>

        {/* Finance hubs are directly in primary sidebar (5 entries), so no
            workflow-group navigation cards are rendered here — avoids
            duplicating sidebar primary destinations. */}
      </div>
    </PageLayout>
  );
}

export default FinancialsPage;
