import { useNavigate, useSearch } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { translateSharedLabel } from '@/lib/i18n';
import { ReportDirectory } from './directory/ReportDirectory';
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
   * Deliberate user navigation between workspaces/sub-views pushes browser
   * history so Back walks the natural chain: أداء المكتب → المتأخرات →
   * عقار محدد → Back → المتأخرات → Back → أداء المكتب. Normalization of
   * malformed URLs never rewrites the address; it only renders a default.
   */
  const handleOpenReport = useCallback(
    (nextWorkspace: ReportWorkspaceId, nextView?: ReportViewId) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => buildWorkspaceSearch(previous, nextWorkspace, nextView),
      });
    },
    [navigate],
  );

  /**
   * URL↔state synchronization. The URL is the authority for contextual
   * drill-through scope: navigation writes the filter patch into the search
   * object (via buildWorkspaceSearch) and this effect mirrors only the keys
   * that changed into local state. Back/Forward/refresh therefore restore
   * the report scope from the URL, while keys the URL never carried (e.g.
   * locally edited dates) keep their local values.
   */
  const lastSearchRef = useRef<Record<string, unknown>>(search);
  useEffect(() => {
    const previous = lastSearchRef.current;
    if (previous === search) return;
    lastSearchRef.current = search;
    const patch = diffReportFiltersFromSearch(previous, search);
    if (patch) setFilters((current) => ({ ...current, ...patch }));
  }, [search]);

  /**
   * Contextual drill-through: the filter patch is serialized into the target
   * URL so the scope survives refresh, share links, and Back/Forward. The
   * resulting search state carries workspace + view + the patched filter keys.
   */
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

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
      <PageHeader title={reportsTitle} description={pageDescription} />

      <div data-finance-root className="min-w-0 grid gap-4 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:items-start">
        {/* Semi-persistent report explorer on desktop. Never duplicated by the
            mobile chooser, which is the single "Choose report" control. */}
        <aside className="hidden min-w-0 lg:block" data-report-explorer-pane>
          <div className="lg:sticky lg:top-[calc(var(--app-header-height,4.5rem)+1rem)]">
            <ReportDirectory
              activeWorkspace={activeWorkspace}
              activeView={activeView}
              onOpen={handleOpenReport}
            />
          </div>
        </aside>

        <div className="min-w-0" data-active-report-workspace data-report-landing>
          {/* No empty landing state: with no URL selection, the office
              performance launchpad opens immediately. */}
          <div className="mb-2 lg:hidden">
            <MobileReportChooser
              activeWorkspace={activeWorkspace}
              activeView={activeView}
              onOpen={handleOpenReport}
            />
          </div>
          <OpenReportWorkspace
            filters={filters}
            canExportReports={canExportReports}
            activeWorkspace={activeWorkspace}
            activeSection={activeSection}
            activeView={activeView}
            onOpenView={(view) => handleOpenReport(activeWorkspace, view)}
            onDrill={handleDrill}
            onFiltersChange={setFilters}
            onResetCurrentMonth={handleResetCurrentMonth}
          />
        </div>
      </div>
    </PageLayout>
  );
}

type MobileReportChooserProps = Readonly<{
  activeWorkspace: ReportWorkspaceId;
  activeView: ReportViewId;
  onOpen: (workspace: ReportWorkspaceId, view: ReportViewId) => void;
}>;

function MobileReportChooser({ activeWorkspace, activeView, onOpen }: MobileReportChooserProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="اختر تقريرًا من المستكشف"
        data-mobile-report-chooser
        className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 text-sm font-black text-foreground transition-colors hover:border-primary/30 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <span className="min-w-0 truncate">اختر تقريرًا</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="اختر التقرير" className="max-h-[min(92dvh,52rem)]">
        <ReportDirectory
          activeWorkspace={activeWorkspace}
          activeView={activeView}
          onOpen={(workspace, view) => {
            setOpen(false);
            onOpen(workspace, view);
          }}
        />
      </BottomSheet>
    </>
  );
}

type OpenReportWorkspaceProps = Readonly<{
  filters: ReportsFilterState;
  canExportReports: boolean;
  activeWorkspace: ReportWorkspaceId;
  activeSection: Parameters<typeof useReportsWorkspace>[1]['section'];
  activeView: ReportViewId;
  onOpenView: (view: ReportViewId) => void;
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
      onDrill={onDrill}
      onFiltersChange={onFiltersChange}
      onResetCurrentMonth={onResetCurrentMonth}
    />
  );
}
