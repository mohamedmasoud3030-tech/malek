import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { useMemo } from 'react';
import { CrossRouteHint } from '@/components/layout/cross-route-hint';
import { PageHeader } from '@/components/layout/page-header';
import { useAuth } from '@/hooks/use-auth';
import {
  canAccess,
  canAccessRoute,
  financialOperationPermissions,
} from '@/features/auth/permissions';
import { PageLayout } from '@/components/layout/page-layout';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { FinancialReportsPreviewSection } from './components/financial-reports-preview-section';
import { getTodayLocalDateString } from './financials-date-utils';
import { useCollectionSummaryReport } from './reports/useFinancialReports';
import { financialWorkflowGroups } from './financials-workflow-groups';

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
 * /financials is a stable operational finance summary, not a directory that
 * duplicates destinations already available in the finance navigation. It keeps
 * a fixed page identity and H1, a compact month summary, and a small number of
 * workflow groups that open the correct finance hub route directly. It does not
 * embed duplicate lists (receipts, invoices, ...) that belong to the dedicated
 * destination workspaces.
 */
export function FinancialsPage() {
  const { authorization } = useAuth();
  const { language, direction } = getAppLanguageState();
  const reportFilters = useMemo(() => getCurrentMonthReportRange(), []);
  const collectionReport = useCollectionSummaryReport(reportFilters);
  const canViewReports = canAccess(authorization, financialOperationPermissions.exportReports);

  // Permission-filtered workflow groups. A group is shown only if the user can
  // reach its finance hub route; within it, only accessible sub-destinations
  // are listed as descriptive chips (never as duplicate card grids).
  const visibleGroups = useMemo(
    () =>
      financialWorkflowGroups
        .map((group) => ({
          ...group,
          visibleDestinations: group.destinations.filter(({ permission }) =>
            canAccessRoute(authorization, permission),
          ),
        }))
        .filter(
          (group) =>
            canAccessRoute(authorization, group.permission) &&
            group.visibleDestinations.length > 0,
        ),
    [authorization],
  );

  return (
    <PageLayout dir={direction} size="wide" visualVariant="malek-pro">
      <div data-finance-root className="space-y-5">
        {/* 1. Page context */}
        <div data-finance-header>
          <PageHeader
            title={translateSharedLabel('financialsSectionSummary', language)}
            description={translateSharedLabel('financialsPageDescription', language)}
          />
        </div>

        {/* 2. Critical alerts - none for this hub, but hint acts as secondary guidance */}
        {/* 3. Summary KPIs — compact preview */}
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

        {/* 5. Main workflow list — acts as hub navigation */}
        <section data-finance-section aria-label="مسارات العمل المالية" className="space-y-3">
        <div>
          <h2 className="text-base font-bold">مسارات العمل المالية</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            مجموعات عمل مُختصرة تفتح مساحة العمل المالية المناسبة مباشرة.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleGroups.map((group) => (
            <Link
              key={group.id}
              to={group.route}
              aria-label={group.title}
              className="group flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 text-right shadow-card transition hover:border-primary/25 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <group.icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{group.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    {group.description}
                  </span>
                </div>
                <ChevronLeft
                  className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary"
                  aria-hidden="true"
                />
              </div>
              <div className="flex flex-wrap gap-1.5" aria-label="أقسام هذا المسار">
                {group.visibleDestinations.map(({ label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
      </div>
    </PageLayout>
  );
}

export default FinancialsPage;
