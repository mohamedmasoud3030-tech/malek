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
 * WP-C — Reports workspace composition root (C.1).
 *
 * Three responsibilities, three components:
 *   - `ReportsShell`        scope/filter bar + decision board + error surface
 *   - `ReportsSectionTabs`  section + view navigation
 *   - `ReportsViewPanel`    lazy adapter routing for the active report
 *
 * This module deliberately owns no state, no fetch and no formatting: it only
 * wires the deep-link location to the shell and the panel.
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
    <div className="space-y-5">
      <ReportsShell
        model={model}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onResetCurrentMonth={onResetCurrentMonth}
        onSectionViewChange={onSectionViewChange}
      />

      <ReportsSectionTabs
        activeSection={activeSection}
        activeView={activeView}
        onSectionChange={onSectionChange}
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
