import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { BarChart3, WalletCards } from 'lucide-react';
import { useCallback, useState } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { translateSharedLabel } from '@/lib/i18n';
import { ReportDirectory } from './directory/ReportDirectory';
import { getCurrentMonthFilters } from './reports-page.helpers';
import { getInitialReportsFilters } from './reports-workspace-filters';
import { reportSections, type ReportSectionId } from './reports-page.sections';
import { getReportSubViewLabel } from './report-view-registry';
import {
  REPORTS_SECTION_SEARCH_KEY,
  resolveReportLocation,
  type ReportViewId,
} from './reports-section-model';
import { ReportsWorkspace } from './workspace/ReportsWorkspace';
import { useReportsWorkspace } from './use-reports-workspace';

export { escapeCsvValue } from '@/lib/csvExport';
export { buildReportCsvFilename, getTodayLocalDateString, toDateInputValue } from './reports-page.helpers';

export function ReportsPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const [filters, setFilters] = useState(() => getInitialReportsFilters(search));
  const { authorization } = useAuth();
  const canExportReports = canAccess(authorization, financialOperationPermissions.exportReports);
  const canViewReports = canAccess(authorization, financialOperationPermissions.viewReports);

  const { section: activeSection, view: activeView } = resolveReportLocation(
    search[REPORTS_SECTION_SEARCH_KEY],
    search.view,
  );
  const workspace = useReportsWorkspace(filters, { section: activeSection, view: activeView });

  const reportsTitle = translateSharedLabel('financialsSectionReports');
  const pageDescription = translateSharedLabel('reportsPageDescription');
  const activeSectionMeta = reportSections.find((section) => section.id === activeSection) ?? reportSections[0];
  const activeViewLabel = getReportSubViewLabel(activeSection, activeView);
  const activeReportLabel = activeViewLabel ?? activeSectionMeta.label;

  const handleSectionViewChange = useCallback(
    (nextSection: ReportSectionId, nextView: ReportViewId) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => {
          const next: Record<string, unknown> = {
            ...previous,
            [REPORTS_SECTION_SEARCH_KEY]: nextSection,
          };
          if (nextView) next.view = nextView;
          else delete next.view;
          return next;
        },
        replace: true,
      });
    },
    [navigate],
  );

  const handleSectionChange = useCallback(
    (nextSection: ReportSectionId) => {
      let defaultView: ReportViewId = '';
      if (nextSection === 'accounting') defaultView = 'accounting_reports';
      else if (nextSection === 'analytics') defaultView = 'overview';
      handleSectionViewChange(nextSection, defaultView);
    },
    [handleSectionViewChange],
  );

  if (!canViewReports) {
    return <AccessDenied message="عرض المحاسبة والتقارير متاح فقط للصلاحيات المالية المخولة." />;
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro" className="pb-8">
      <div data-finance-root className="min-w-0 space-y-3 sm:space-y-4">
        <section
          aria-labelledby="reports-center-title"
          className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card"
          data-reports-cockpit
          data-reports-center-header
        >
          <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:size-12">
                <BarChart3 className="size-5 sm:size-5.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-primary">مركز التقارير</p>
                <h1 id="reports-center-title" className="mt-0.5 text-xl font-black sm:text-2xl lg:text-[1.7rem]">
                  {reportsTitle}
                </h1>
                <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-muted-foreground sm:text-sm sm:leading-6">
                  {pageDescription}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <div className="rounded-xl border border-border/65 bg-muted/30 px-3 py-2 text-xs font-bold text-muted-foreground">
                المفتوح الآن: <span className="text-foreground">{activeReportLabel}</span>
              </div>
              <Button variant="outline" asChild className="min-h-10">
                <Link to="/financials">
                  <WalletCards className="me-2 size-4" aria-hidden="true" />
                  العمليات المالية
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <ReportDirectory
          activeSection={activeSection}
          activeView={activeView}
          scope={{ ownerId: filters.ownerId, tenantId: filters.tenantId, contractId: filters.contractId }}
          onOpen={handleSectionViewChange}
        />

        <section className="space-y-2" aria-labelledby="active-report-title" data-active-report-workspace>
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[11px] font-black text-primary">التقرير المفتوح</p>
              <h2 id="active-report-title" className="mt-0.5 text-lg font-black sm:text-xl">{activeReportLabel}</h2>
            </div>
            <p className="hidden text-xs font-semibold text-muted-foreground sm:block">الفلاتر والجداول والتصدير أدناه</p>
          </div>

          <ReportsWorkspace
            model={workspace}
            filters={filters}
            canExportReports={canExportReports}
            activeSection={activeSection}
            activeView={activeView}
            onSectionChange={handleSectionChange}
            onSectionViewChange={handleSectionViewChange}
            onFiltersChange={setFilters}
            onResetCurrentMonth={() => setFilters((current) => ({
              ...current,
              ...getCurrentMonthFilters(),
            }))}
          />
        </section>
      </div>
    </PageLayout>
  );
}
