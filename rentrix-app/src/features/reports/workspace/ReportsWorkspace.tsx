import { DataRefreshAlert } from '@/components/data-refresh-alert';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { ReportsFilterState } from '../reports-workspace-filters';
import type { ReportViewId } from '../report-view-registry';
import type { ReportSectionId } from '../reports-page.sections';
import type { ReportDrillHandler, ReportWorkspaceId } from '../report-workspaces';
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
  onDrill: ReportDrillHandler;
  onFiltersChange: (filters: ReportsFilterState) => void;
  onResetCurrentMonth: () => void;
}>;

/**
 * Reports workspace composition root.
 *
 * Owner-facing navigation is workspace-first: the directory opens one of the
 * seven business workspaces and the shell presents its sub-views. The legacy
 * accounting/statements/analytics section ids remain internal routing
 * contracts only, so deep links and authoritative report adapters keep
 * working without exposing implementation categories to the user.
 */
export function ReportsWorkspace({
  model,
  filters,
  canExportReports,
  activeWorkspace,
  activeSection,
  activeView,
  onOpenView,
  onDrill,
  onFiltersChange,
  onResetCurrentMonth,
}: ReportsWorkspaceProps) {
  return (
    <div className="min-w-0 space-y-3">
      <ReportsShell
        model={model}
        filters={filters}
        activeWorkspace={activeWorkspace}
        activeView={activeView}
        onOpenView={onOpenView}
        onFiltersChange={onFiltersChange}
        onResetCurrentMonth={onResetCurrentMonth}
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
        />
      </div>
    </div>
  );
}

export type { ReportsWorkspaceProps };
