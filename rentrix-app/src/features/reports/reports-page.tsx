import { useNavigate, useSearch } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import { useCallback, useState } from 'react';
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
              activeSection={activeSection}
              activeView={activeView}
              scope={{ ownerId: filters.ownerId, tenantId: filters.tenantId, contractId: filters.contractId }}
              onOpen={handleSectionViewChange}
            />
          </div>
        </aside>

        <div className="min-w-0" data-active-report-workspace data-report-landing>
          {/* No empty landing state: with no URL selection, resolveReportLocation
              opens the decision-first office performance report immediately. */}
          <div className="mb-2 lg:hidden">
            <MobileReportChooser
              activeSection={activeSection}
              activeView={activeView}
              scope={{ ownerId: filters.ownerId, tenantId: filters.tenantId, contractId: filters.contractId }}
              onOpen={handleSectionViewChange}
            />
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
        </div>
      </div>
    </PageLayout>
  );
}

type MobileReportChooserProps = Readonly<{
  activeSection: ReportSectionId;
  activeView: ReportViewId;
  scope?: Readonly<{ ownerId?: string; tenantId?: string; contractId?: string }>;
  onOpen: (section: ReportSectionId, view: ReportViewId) => void;
}>;

function MobileReportChooser({ activeSection, activeView, scope, onOpen }: MobileReportChooserProps) {
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
          activeSection={activeSection}
          activeView={activeView}
          scope={scope}
          onOpen={(section, view) => {
            setOpen(false);
            onOpen(section, view);
          }}
        />
      </BottomSheet>
    </>
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
