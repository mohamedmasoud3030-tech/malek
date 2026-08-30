import { cn } from '@/lib/utils';
import type { ReportViewId } from '../report-view-registry';
import type { ReportWorkspace } from '../report-workspaces';

type WorkspaceSubViewTabsProps = Readonly<{
  workspace: ReportWorkspace;
  activeView: ReportViewId;
  onOpenView: (view: ReportViewId) => void;
}>;

/**
 * Compact segmented control for a workspace's sub-views. A workspace with a
 * single view renders no tabs — the header already names it. Kept outside the
 * shell so the shell stays small and this navigation surface never competes
 * with the report body for attention.
 */
export function WorkspaceSubViewTabs({ workspace, activeView, onOpenView }: WorkspaceSubViewTabsProps) {
  if (workspace.subViews.length <= 1) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="tablist"
      aria-label={`وجهات ${workspace.label}`}
      data-workspace-subview-tabs
    >
      {workspace.subViews.map((subView) => {
        const active = subView.id === activeView;
        return (
          <button
            key={subView.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onOpenView(subView.id)}
            className={cn(
              'inline-flex min-h-9 items-center rounded-lg border px-2.5 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              active
                ? 'border-primary/35 bg-primary/10 text-primary'
                : 'border-border/70 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            {subView.label}
          </button>
        );
      })}
    </div>
  );
}
