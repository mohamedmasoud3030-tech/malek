import { getReportWorkspace, getReportWorkspaceSubView, type ReportWorkspaceId } from './report-workspaces';
import type { ReportViewId } from './report-view-registry';

export type ActiveReportMeta = Readonly<{
  title: string;
  description: string;
}>;

/**
 * Resolve the one compact report header for the open workspace. Title and
 * description come from the workspace registry (task/decision language), never
 * from internal section labels or implementation categories.
 */
export function getActiveReportMeta(workspaceId: ReportWorkspaceId, view: ReportViewId): ActiveReportMeta {
  const workspace = getReportWorkspace(workspaceId);
  if (!workspace) return { title: 'تقرير', description: '' };

  const subView = getReportWorkspaceSubView(workspace, view);
  if (subView) {
    return { title: subView.label, description: subView.description ?? workspace.description };
  }
  return { title: workspace.label, description: workspace.description };
}
