import type { ReportsWorkspaceModel } from '../../use-reports-workspace';
import type { ReportsFilterState } from '../../reports-workspace-filters';
import type { ReportViewId } from '../../report-view-registry';
import type { ReportDrillHandler } from '../../report-workspaces';

/**
 * WP-C — the single props interface every report adapter implements.
 *
 * The workspace router therefore treats accounting, statements and analytics
 * identically: it hands each adapter the same read model, the same scope, the
 * same export capability and the same drill-through handler, and the adapter
 * decides which body to render. Adding a report family means adding an
 * adapter, not editing the router.
 */
export type ReportAdapterProps = Readonly<{
  view: ReportViewId;
  model: ReportsWorkspaceModel;
  filters: ReportsFilterState;
  canExportReports: boolean;
  onDrill: ReportDrillHandler;
}>;
