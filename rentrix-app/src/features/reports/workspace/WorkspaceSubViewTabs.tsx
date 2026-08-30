import { cn } from '@/lib/utils';
import type { ReportViewId } from '../report-view-registry';
import { getReportWorkspace, type ReportWorkspaceId } from '../report-workspaces';

type WorkspaceSubViewTabsProps = Readonly<{
  activeWorkspace: ReportWorkspaceId;
  activeView: ReportViewId;
  onOpen: (workspace: ReportWorkspaceId, view: ReportViewId) => void;
}>;

type WorkspaceTab = Readonly<{
  workspace: ReportWorkspaceId;
  view: ReportViewId;
  label: string;
}>;

function getWorkspaceTabs(activeWorkspace: ReportWorkspaceId): WorkspaceTab[] {
  const workspaceIds: readonly ReportWorkspaceId[] = activeWorkspace === 'properties' || activeWorkspace === 'leasing'
    ? ['properties', 'leasing']
    : [activeWorkspace];

  return workspaceIds.flatMap((workspaceId) => {
    const workspace = getReportWorkspace(workspaceId);
    if (!workspace) return [];
    if (workspace.subViews.length === 0) {
      return [{ workspace: workspace.id, view: workspace.defaultView, label: workspace.label }];
    }
    return workspace.subViews.map((subView) => ({
      workspace: workspace.id,
      view: subView.id,
      label: subView.label,
    }));
  });
}

/**
 * Compact segmented control for a workspace's sub-views. A workspace with a
 * single view renders no tabs — the header already names it. Kept outside the
 * shell so the shell stays small and this navigation surface never competes
 * with the report body for attention.
 */
export function WorkspaceSubViewTabs({ activeWorkspace, activeView, onOpen }: WorkspaceSubViewTabsProps) {
  const tabs = getWorkspaceTabs(activeWorkspace);
  if (tabs.length <= 1) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="tablist"
      aria-label="تفاصيل التقرير"
      data-workspace-subview-tabs
    >
      {tabs.map((tab) => {
        const active = tab.workspace === activeWorkspace && tab.view === activeView;
        return (
          <button
            key={`${tab.workspace}:${tab.view}`}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onOpen(tab.workspace, tab.view)}
            className={cn(
              'inline-flex min-h-11 items-center rounded-lg border px-2.5 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              active
                ? 'border-primary/35 bg-primary/10 text-primary'
                : 'border-border/70 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
