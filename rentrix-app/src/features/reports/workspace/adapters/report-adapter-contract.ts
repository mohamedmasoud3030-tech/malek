import type { ReportsWorkspaceModel } from '../../use-reports-workspace';
import type { ReportsFilterState } from '../../reports-workspace-filters';
import type { ReportViewId } from '../../report-view-registry';

/**
 * WP-C — the single props interface every report adapter implements.
 *
 * The workspace router therefore treats accounting, statements and analytics
 * identically: it hands each adapter the same read model, the same scope and
 * the same export capability, and the adapter decides which section body to
 * render. Adding a report family means adding an adapter, not editing the
 * router.
 */
export type ReportAdapterProps = Readonly<{
  view: ReportViewId;
  model: ReportsWorkspaceModel;
  filters: ReportsFilterState;
  canExportReports: boolean;
}>;
