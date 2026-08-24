import { translateSharedLabel } from '@/lib/i18n';
import { useCallback, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { AccessDenied } from '@/components/layout/access-denied';
import { CrossRouteHint } from '@/components/layout/cross-route-hint';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { WorkspaceHint } from '@/components/layout/workspace-hint';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { ReportDirectory } from './components/ReportDirectory';
import { ReportsWorkspace } from './components/ReportsWorkspace';
import { getCurrentMonthFilters } from './reports-page.helpers';
import { getInitialReportsFilters } from './reports-workspace-filters';
import type { ReportSectionId } from './reports-page.sections';
import {
  REPORTS_SECTION_SEARCH_KEY,
  resolveReportLocation,
  type ReportViewId,
} from './reports-section-model';
import { useReportsWorkspace } from './use-reports-workspace';

export { escapeCsvValue } from '@/lib/csvExport';
export { buildReportCsvFilename, getTodayLocalDateString, toDateInputValue } from './reports-page.helpers';

export function ReportsPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const [filters, setFilters] = useState(() => getInitialReportsFilters(search));
  const { authorization } = useAuth();
  // R5: view and export are separate capabilities — viewing a report never
  // implies the right to export it, and export never gates viewing.
  const canExportReports = canAccess(authorization, financialOperationPermissions.exportReports);
  const canViewReports = canAccess(authorization, financialOperationPermissions.viewReports);

  const { section: activeSection, view: activeView } = resolveReportLocation(
    search[REPORTS_SECTION_SEARCH_KEY],
    search.view
  );
  // R6: the workspace fetches ONLY the open report (Open tab → fetch report).
  const workspace = useReportsWorkspace(filters, { section: activeSection, view: activeView });

  const reportsLabel = translateSharedLabel('financialsSectionReports');
  const pageDescription = translateSharedLabel('reportsPageDescription');
  const pageHint = translateSharedLabel('reportsPageHint');

  const handleSectionViewChange = useCallback(
    (nextSection: ReportSectionId, nextView: ReportViewId) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => {
          const next: Record<string, unknown> = {
            ...previous,
            [REPORTS_SECTION_SEARCH_KEY]: nextSection,
          };
          if (nextView) {
            next.view = nextView;
          } else {
            delete next.view;
          }
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
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro" className="space-y-5 pb-8">
      <div data-finance-root className="space-y-5">
        <div data-finance-header>
          <PageHeader
            title="المحاسبة والتقارير"
            description={pageDescription}
          />
        </div>

        {pageHint ? (
          <WorkspaceHint>
            {pageHint} (كشف {reportsLabel})
          </WorkspaceHint>
        ) : null}

        <div data-finance-cluster>
          <CrossRouteHint
            message="للعمليات اليومية مثل التحصيل والمصروفات والتسويات استخدم صفحة المالية."
            action={{ to: '/financials', label: 'فتح المالية' }}
          />
        </div>

        <ReportDirectory
          activeSection={activeSection}
          activeView={activeView}
          onOpen={handleSectionViewChange}
        />

        <section data-finance-section aria-label="مساحة المحاسبة والتقارير">
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
