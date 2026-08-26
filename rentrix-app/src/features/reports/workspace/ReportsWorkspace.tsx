import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { ReportsFilterState } from '../reports-workspace-filters';
import type { ReportViewId } from '../report-view-registry';
import type { ReportSectionId } from '../reports-page.sections';
import { ReportsSectionTabs } from './ReportsSectionTabs';
import { ReportsShell } from './ReportsShell';
import { ReportsViewPanel } from './ReportsViewPanel';

type ReportsWorkspaceProps = Readonly<{
  model: ReportsWorkspaceModel;
  filters: ReportsFilterState;
  canExportReports: boolean;
  activeSection: ReportSectionId;
  activeView: ReportViewId;
  onSectionChange: (section: ReportSectionId) => void;
  onSectionViewChange: (section: ReportSectionId, view: ReportViewId) => void;
  onFiltersChange: (filters: ReportsFilterState) => void;
  onResetCurrentMonth: () => void;
}>;

/**
 * Reports workspace composition root.
 *
 * The user chooses the reporting context first, then narrows the scope, then
 * reads the active report. Keeping those three steps in that order prevents the
 * page from reading like a stack of unrelated dashboards — especially on
 * phones — while preserving the existing deep-link and authority contracts.
 * The active report deliberately remains the final, dominant visual block.
 */
export function ReportsWorkspace({
  model,
  filters,
  canExportReports,
  activeSection,
  activeView,
  onSectionChange,
  onSectionViewChange,
  onFiltersChange,
  onResetCurrentMonth,
}: ReportsWorkspaceProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <ReportsSectionTabs
        activeSection={activeSection}
        activeView={activeView}
        onSectionChange={onSectionChange}
        onSectionViewChange={onSectionViewChange}
      />

      <ReportsShell
        model={model}
        filters={filters}
        activeSection={activeSection}
        onFiltersChange={onFiltersChange}
        onResetCurrentMonth={onResetCurrentMonth}
        onSectionViewChange={onSectionViewChange}
      />

      <ReportsViewPanel
        activeSection={activeSection}
        activeView={activeView}
        model={model}
        filters={filters}
        canExportReports={canExportReports}
      />
    </div>
  );
}

export type { ReportsWorkspaceProps };
