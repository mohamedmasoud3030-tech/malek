import { DataRefreshAlert } from '@/components/data-refresh-alert';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { ReportsFilterState } from '../reports-workspace-filters';
import type { ReportViewId } from '../report-view-registry';
import type { ReportSectionId } from '../reports-page.sections';
import { ReportsShell } from './ReportsShell';
import { ReportsViewPanel } from './ReportsViewPanel';

type ReportsWorkspaceProps = Readonly<{
  model: ReportsWorkspaceModel;
  filters: ReportsFilterState;
  canExportReports: boolean;
  activeSection: ReportSectionId;
  activeView: ReportViewId;
  onSectionViewChange: (section: ReportSectionId, view: ReportViewId) => void;
  onFiltersChange: (filters: ReportsFilterState) => void;
  onResetCurrentMonth: () => void;
}>;

/**
 * Reports workspace composition root.
 *
 * Owner-facing navigation is intentionally task/report-first. The legacy
 * accounting/statements/analytics section ids remain internal routing
 * contracts only, so deep links and authoritative report adapters keep
 * working without exposing implementation-oriented categories to the user.
 */
export function ReportsWorkspace({
  model,
  filters,
  canExportReports,
  activeSection,
  activeView,
  onSectionViewChange,
  onFiltersChange,
  onResetCurrentMonth,
}: ReportsWorkspaceProps) {
  return (
    <div className="min-w-0 space-y-3">
      <ReportsShell
        model={model}
        filters={filters}
        activeSection={activeSection}
        activeView={activeView}
        onFiltersChange={onFiltersChange}
        onResetCurrentMonth={onResetCurrentMonth}
        onSectionViewChange={onSectionViewChange}
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
        />
      </div>
    </div>
  );
}

export type { ReportsWorkspaceProps };
