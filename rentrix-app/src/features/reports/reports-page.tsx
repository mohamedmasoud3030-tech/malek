import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { translateSharedLabel } from '@/lib/i18n';
import { getCurrentMonthFilters } from './reports-page.helpers';
import { getInitialReportsFilters, type ReportsFilterState } from './reports-workspace-filters';
import {
  REPORTS_SECTION_SEARCH_KEY,
  buildWorkspaceSearch,
  diffReportFiltersFromSearch,
  resolveWorkspaceLocation,
} from './reports-section-model';
import type { ReportViewId } from './report-view-registry';
import { WORKSPACE_SEARCH_KEY, type ReportDrillHandler, type ReportWorkspaceId } from './report-workspaces';
import { ReportsCatalog } from './components/ReportsCatalog';
import { ReportsPrimaryNavigation } from './workspace/ReportsPrimaryNavigation';
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

  const { workspace: activeWorkspace, section: activeSection, view: activeView } = resolveWorkspaceLocation(
    search[WORKSPACE_SEARCH_KEY],
    search.view,
    search[REPORTS_SECTION_SEARCH_KEY],
  );
  const reportsTitle = translateSharedLabel('financialsSectionReports');
  const pageDescription = translateSharedLabel('reportsPageDescription');

  /**
   * The /reports landing is the premium catalog: exactly the five report
   * products, no KPI numbers, charts, financial totals or filter chrome.
   * The consolidated workspace below remains the compatibility surface for
   * every existing `?workspace=`/`?section=`/`?view=` deep link (and the
   * drill-through / legacy-URL targets), so nothing that used to be
   * reachable can be lost by removing the landing analytics.
   */
  const legacyLocationRequested = WORKSPACE_SEARCH_KEY in search
    || REPORTS_SECTION_SEARCH_KEY in search
    || 'view' in search;

  const handleOpenReport = useCallback(
    (nextWorkspace: ReportWorkspaceId, nextView?: ReportViewId) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => buildWorkspaceSearch(previous, nextWorkspace, nextView),
      });
    },
    [navigate],
  );

  const lastSearchRef = useRef<Record<string, unknown>>(search);
  useEffect(() => {
    const previous = lastSearchRef.current;
    if (previous === search) return;
    lastSearchRef.current = search;
    const patch = diffReportFiltersFromSearch(previous, search);
    if (patch) setFilters((current) => ({ ...current, ...patch }));
  }, [search]);

  const handleDrill: ReportDrillHandler = useCallback(
    (targetWorkspace, targetView, filterPatch) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => buildWorkspaceSearch(previous, targetWorkspace, targetView, filterPatch),
      });
    },
    [navigate],
  );

  const handleResetCurrentMonth = useCallback(() => {
    setFilters((current) => ({
      ...current,
      ...getCurrentMonthFilters(),
    }));
  }, []);

  if (!canViewReports) {
    return <AccessDenied message="عرض التقارير متاح فقط للصلاحيات المخولة." />;
  }

  if (!legacyLocationRequested) {
    return (
      <PageLayout dir="rtl" lang="ar" size="wide">
        <PageHeader title={reportsTitle} description={pageDescription} />
        <div data-reports-catalog-landing data-report-landing dir="rtl" lang="ar" className="min-w-0">
          <ReportsCatalog />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <PageHeader title={reportsTitle} description={pageDescription} />

      <div data-finance-root className="min-w-0 space-y-3">
        <ReportsPrimaryNavigation activeWorkspace={activeWorkspace} onOpen={handleOpenReport} />

        <div id="reports-workspace-panel" className="min-w-0" data-active-report-workspace data-report-landing>
          <OpenReportWorkspace
            filters={filters}
            canExportReports={canExportReports}
            activeWorkspace={activeWorkspace}
            activeSection={activeSection}
            activeView={activeView}
            onOpenView={(view) => handleOpenReport(activeWorkspace, view)}
            onOpenReport={handleOpenReport}
            onDrill={handleDrill}
            onFiltersChange={setFilters}
            onResetCurrentMonth={handleResetCurrentMonth}
          />
        </div>
      </div>
    </PageLayout>
  );
}

type OpenReportWorkspaceProps = Readonly<{
  filters: ReportsFilterState;
  canExportReports: boolean;
  activeWorkspace: ReportWorkspaceId;
  activeSection: Parameters<typeof useReportsWorkspace>[1]['section'];
  activeView: ReportViewId;
  onOpenView: (view: ReportViewId) => void;
  onOpenReport: (workspace: ReportWorkspaceId, view: ReportViewId) => void;
  onDrill: ReportDrillHandler;
  onFiltersChange: (filters: ReportsFilterState) => void;
  onResetCurrentMonth: () => void;
}>;

function OpenReportWorkspace({
  filters,
  canExportReports,
  activeWorkspace,
  activeSection,
  activeView,
  onOpenView,
  onOpenReport,
  onDrill,
  onFiltersChange,
  onResetCurrentMonth,
}: OpenReportWorkspaceProps) {
  const workspace = useReportsWorkspace(filters, { section: activeSection, view: activeView });

  return (
    <ReportsWorkspace
      model={workspace}
      filters={filters}
      canExportReports={canExportReports}
      activeWorkspace={activeWorkspace}
      activeSection={activeSection}
      activeView={activeView}
      onOpenView={onOpenView}
      onOpenReport={onOpenReport}
      onDrill={onDrill}
      onFiltersChange={onFiltersChange}
      onResetCurrentMonth={onResetCurrentMonth}
    />
  );
}
