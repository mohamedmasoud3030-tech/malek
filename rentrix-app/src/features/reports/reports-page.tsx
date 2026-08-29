import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { useCallback, useState } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { translateSharedLabel } from '@/lib/i18n';
import { ReportDirectory } from './directory/ReportDirectory';
import { getCurrentMonthFilters } from './reports-page.helpers';
import { getInitialReportsFilters, type ReportsFilterState } from './reports-workspace-filters';
import type { ReportSectionId } from './reports-page.sections';
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
  const hasExplicitSection = typeof search[REPORTS_SECTION_SEARCH_KEY] === 'string'
    && search[REPORTS_SECTION_SEARCH_KEY].trim().length > 0;
  const hasExplicitView = typeof search.view === 'string' && search.view.trim().length > 0;
  const isReportOpen = hasExplicitSection || hasExplicitView;

  const reportsTitle = translateSharedLabel('financialsSectionReports');
  const pageDescription = translateSharedLabel('reportsPageDescription');

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

  const handleBackToDirectory = useCallback(() => {
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => {
        const next = { ...previous };
        delete next[REPORTS_SECTION_SEARCH_KEY];
        delete next.view;
        return next;
      },
      replace: true,
    });
  }, [navigate]);

  const handleResetCurrentMonth = useCallback(() => {
    setFilters((current) => ({
      ...current,
      ...getCurrentMonthFilters(),
    }));
  }, []);

  if (!canViewReports) {
    return <AccessDenied message="عرض التقارير متاح فقط للصلاحيات المخولة." />;
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro" className="pb-8">
      <PageHeader title={reportsTitle} description={pageDescription} />

      <div data-finance-root className="min-w-0 space-y-3 sm:space-y-4">
        {isReportOpen ? (
          <>
            <div className="flex items-center" data-report-back-navigation>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 gap-2 px-2.5 text-sm font-black"
                onClick={handleBackToDirectory}
              >
                <ArrowRight className="size-4" aria-hidden="true" />
                كل التقارير
              </Button>
            </div>
            <OpenReportWorkspace
              filters={filters}
              canExportReports={canExportReports}
              activeSection={activeSection}
              activeView={activeView}
              onSectionViewChange={handleSectionViewChange}
              onFiltersChange={setFilters}
              onResetCurrentMonth={handleResetCurrentMonth}
            />
          </>
        ) : (
          <ReportDirectory
            activeSection={activeSection}
            activeView={activeView}
            scope={{ ownerId: filters.ownerId, tenantId: filters.tenantId, contractId: filters.contractId }}
            onOpen={handleSectionViewChange}
          />
        )}
      </div>
    </PageLayout>
  );
}

type OpenReportWorkspaceProps = Readonly<{
  filters: ReportsFilterState;
  canExportReports: boolean;
  activeSection: ReportSectionId;
  activeView: ReportViewId;
  onSectionViewChange: (section: ReportSectionId, view: ReportViewId) => void;
  onFiltersChange: (filters: ReportsFilterState) => void;
  onResetCurrentMonth: () => void;
}>;

function OpenReportWorkspace({
  filters,
  canExportReports,
  activeSection,
  activeView,
  onSectionViewChange,
  onFiltersChange,
  onResetCurrentMonth,
}: OpenReportWorkspaceProps) {
  const workspace = useReportsWorkspace(filters, { section: activeSection, view: activeView });

  return (
    <ReportsWorkspace
      model={workspace}
      filters={filters}
      canExportReports={canExportReports}
      activeSection={activeSection}
      activeView={activeView}
      onSectionViewChange={onSectionViewChange}
      onFiltersChange={onFiltersChange}
      onResetCurrentMonth={onResetCurrentMonth}
    />
  );
}
