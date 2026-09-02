import { DataRefreshAlert } from '@/components/data-refresh-alert';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { ReportsFilterState } from '../reports-workspace-filters';
import type { ReportViewId } from '../report-view-registry';
import type { ReportSectionId } from '../reports-page.sections';
import type { ReportDrillHandler, ReportWorkspaceId } from '../report-workspaces';
import type { StatementProductFocus } from '../report-products';
import { ReportsShell } from './ReportsShell';
import { ReportsViewPanel } from './ReportsViewPanel';

type ReportsWorkspaceProps = Readonly<{
  model: ReportsWorkspaceModel;
  filters: ReportsFilterState;
  canExportReports: boolean;
  activeWorkspace: ReportWorkspaceId;
  activeSection: ReportSectionId;
  activeView: ReportViewId;
  onOpenView: (view: ReportViewId) => void;
  onOpenReport?: (workspace: ReportWorkspaceId, view: ReportViewId) => void;
  onDrill: ReportDrillHandler;
  onFiltersChange: (filters: ReportsFilterState) => void;
  onResetCurrentMonth: () => void;
  /** Premium products own their own internal navigation, so legacy workspace tabs stay hidden. */
  hideWorkspaceNavigation?: boolean;
  /** Focuses the shared statements data source without duplicating its loaders. */
  statementFocus?: StatementProductFocus;
}>;

/**
 * Reports workspace composition root.
 *
 * The legacy workspace registry remains a compatibility/read-model boundary.
 * Premium report products may reuse it with their own navigation while keeping
 * the same filters, loaders, permission checks and authoritative data paths.
 */
export function ReportsWorkspace({
  model,
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
  hideWorkspaceNavigation = false,
  statementFocus,
}: ReportsWorkspaceProps) {
  return (
    <div className="min-w-0 space-y-3">
      <ReportsShell
        model={model}
        filters={filters}
        activeWorkspace={activeWorkspace}
        activeView={activeView}
        onOpenView={onOpenView}
        onOpenReport={onOpenReport}
        onFiltersChange={onFiltersChange}
        onResetCurrentMonth={onResetCurrentMonth}
        hideWorkspaceNavigation={hideWorkspaceNavigation}
      />

      {model.isIncomplete ? (
        <DataRefreshAlert
          title="نتائج التقرير غير مكتملة"
          description="تعذر تحديث مصدر واحد أو أكثر. قد تبقى النتائج السابقة ظاهرة للمراجعة، لكن الطباعة والتصدير متوقفان حتى ينجح تحديث جميع المصادر."
          onRetry={() => { void model.retryFailedSources(); }}
        />
      ) : null}

      <div
        data-stale-report-content={model.isIncomplete ? 'true' : undefined}
        aria-label={model.isIncomplete ? 'نتائج تقرير غير مكتملة للقراءة فقط' : undefined}
      >
        <ReportsViewPanel
          activeSection={activeSection}
          activeView={activeView}
          model={model}
          filters={filters}
          canExportReports={canExportReports && !model.isIncomplete}
          onDrill={onDrill}
          statementFocus={statementFocus}
        />
      </div>
    </div>
  );
}

export type { ReportsWorkspaceProps };
