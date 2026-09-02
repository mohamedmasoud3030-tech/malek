import type { ReportsWorkspaceModel } from '../../use-reports-workspace';
import type { ReportsFilterState } from '../../reports-workspace-filters';
import type { ReportViewId } from '../../report-view-registry';
import type { ReportDrillHandler } from '../../report-workspaces';
import type { StatementProductFocus } from '../../report-products';

/**
 * Single props interface every report adapter implements. Premium products
 * may narrow the statements presentation while reusing the exact same read
 * model, filters and authoritative loaders.
 */
export type ReportAdapterProps = Readonly<{
  view: ReportViewId;
  model: ReportsWorkspaceModel;
  filters: ReportsFilterState;
  canExportReports: boolean;
  onDrill: ReportDrillHandler;
  statementFocus?: StatementProductFocus;
}>;
