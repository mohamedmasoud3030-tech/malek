import { BarChart3, Building2, ReceiptText, Scale, UsersRound, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionTabs, type SectionTabItem } from '@/components/ui/section-tabs';
import type { ReportViewId } from '../report-view-registry';
import type { ReportWorkspaceId } from '../report-workspaces';

type ReportPrimaryNavigationId = 'summary' | 'collections' | 'portfolio' | 'operations' | 'statements' | 'advanced';

type PrimaryDestination = SectionTabItem<ReportPrimaryNavigationId> & Readonly<{
  workspace: ReportWorkspaceId;
  view: ReportViewId;
}>;

const PRIMARY_DESTINATIONS: readonly PrimaryDestination[] = [
  { id: 'summary', label: 'الملخص', icon: BarChart3, workspace: 'office', view: 'overview' },
  { id: 'collections', label: 'التحصيل', icon: ReceiptText, workspace: 'collections', view: 'collections' },
  { id: 'portfolio', label: 'العقارات والعقود', icon: Building2, workspace: 'properties', view: 'property_analytics' },
  { id: 'operations', label: 'التشغيل', icon: Wrench, workspace: 'operations', view: 'operations_overview' },
  { id: 'statements', label: 'الكشوف', icon: UsersRound, workspace: 'statements', view: '' },
];

const primaryTabs = PRIMARY_DESTINATIONS.map(({ id, label, icon }) => ({ id, label, icon }));

function resolvePrimaryNavigationId(workspace: ReportWorkspaceId): ReportPrimaryNavigationId {
  if (workspace === 'office') return 'summary';
  if (workspace === 'collections') return 'collections';
  if (workspace === 'properties' || workspace === 'leasing') return 'portfolio';
  if (workspace === 'operations') return 'operations';
  if (workspace === 'statements') return 'statements';
  return 'advanced';
}

type ReportsPrimaryNavigationProps = Readonly<{
  activeWorkspace: ReportWorkspaceId;
  onOpen: (workspace: ReportWorkspaceId, view: ReportViewId) => void;
}>;

/** Five clear report destinations; specialist accounting stays secondary. */
export function ReportsPrimaryNavigation({ activeWorkspace, onOpen }: ReportsPrimaryNavigationProps) {
  const activeId = resolvePrimaryNavigationId(activeWorkspace);

  return (
    <nav
      className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center"
      aria-label="أقسام التقارير"
      data-reports-primary-navigation
    >
      <div className="min-w-0 flex-1">
        <SectionTabs
          items={primaryTabs}
          activeId={activeId}
          onChange={(nextId) => {
            const destination = PRIMARY_DESTINATIONS.find((item) => item.id === nextId);
            if (destination) onOpen(destination.workspace, destination.view);
          }}
          ariaLabel="أقسام التقارير"
          panelId="reports-workspace-panel"
          idPrefix="reports-primary"
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-current={activeId === 'advanced' ? 'page' : undefined}
        className="min-h-11 self-end gap-1.5 px-2.5 text-xs font-black text-muted-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground sm:self-auto"
        data-active={activeId === 'advanced'}
        onClick={() => onOpen('financial_review', 'accounting_reports')}
      >
        <Scale className="size-3.5" aria-hidden="true" />
        <span>مراجعة متقدمة</span>
      </Button>
    </nav>
  );
}
