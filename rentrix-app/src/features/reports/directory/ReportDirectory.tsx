import { useMemo, useState } from 'react';
import { ArrowLeft, Scale } from 'lucide-react';
import { FilterBar } from '@/components/ui/filter-bar';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { ReportState } from '@/components/ui/report-section-primitives';
import { cn } from '@/lib/utils';
import {
  businessReportGroups,
  filterReportGroups,
  reportGroups,
  specialistReportGroups,
  type ReportGroup,
  type ReportShortcut,
} from './report-directory-groups';
import type { ReportWorkspaceId } from '../report-workspaces';
import type { ReportViewId } from '../report-view-registry';

type ReportDirectoryProps = Readonly<{
  activeWorkspace: ReportWorkspaceId;
  activeView: ReportViewId;
  onOpen: (workspace: ReportWorkspaceId, view: ReportViewId) => void;
}>;

type DirectoryTab = 'all' | ReportWorkspaceId;

const directoryTabs: readonly { id: DirectoryTab; label: string; groups?: readonly ReportWorkspaceId[] }[] = [
  { id: 'all', label: 'الكل' },
  ...businessReportGroups.map((group) => ({ id: group.id as DirectoryTab, label: group.title, groups: [group.id] })),
];

const directoryFilterOptions: { value: DirectoryTab; label: string }[] = directoryTabs.map((item) => ({
  value: item.id,
  label: item.label,
}));

/**
 * Curated set of the reports an office reaches for most often. These remain
 * real catalogue destinations; pinning only shortens navigation.
 */
const pinnedReports: readonly { workspace: ReportWorkspaceId; view: ReportViewId; label: string }[] = [
  { workspace: 'office', view: 'overview', label: 'أداء المكتب' },
  { workspace: 'collections', view: 'collections', label: 'ملخص الفترة' },
  { workspace: 'collections', view: 'overdue', label: 'المتأخرات' },
  { workspace: 'leasing', view: 'occupancy', label: 'الإشغال والشغور' },
  { workspace: 'operations', view: 'expenses', label: 'المصروفات' },
];

function shortcutIsActive(
  shortcut: Pick<ReportShortcut, 'view'>,
  group: Pick<ReportGroup, 'id'>,
  activeWorkspace: ReportWorkspaceId,
  activeView: ReportViewId,
) {
  return group.id === activeWorkspace && shortcut.view === activeView;
}

function isGroupActive(
  group: Pick<ReportGroup, 'id'>,
  activeWorkspace: ReportWorkspaceId,
) {
  return group.id === activeWorkspace;
}

function renderShortcut(
  shortcut: ReportShortcut,
  group: ReportGroup,
  activeWorkspace: ReportWorkspaceId,
  activeView: ReportViewId,
  onOpen: ReportDirectoryProps['onOpen'],
) {
  const shortcutActive = shortcutIsActive(shortcut, group, activeWorkspace, activeView);
  return (
    <button
      key={`${group.id}:${shortcut.view}:${shortcut.label}`}
      type="button"
      onClick={() => onOpen(group.id, shortcut.view)}
      aria-current={shortcutActive ? 'page' : undefined}
      title={shortcut.description}
      className={cn(
        'group flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-start text-[13px] font-semibold leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        shortcutActive
          ? 'bg-primary/[0.06] text-primary'
          : 'text-foreground hover:bg-muted/60',
      )}
    >
      <span className="min-w-0 flex-1 truncate">{shortcut.label}</span>
      <ArrowLeft className="size-3.5 shrink-0 text-muted-foreground/60 rtl:rotate-180" aria-hidden="true" />
    </button>
  );
}

function renderGroup(
  group: ReportGroup,
  activeWorkspace: ReportWorkspaceId,
  activeView: ReportViewId,
  onOpen: ReportDirectoryProps['onOpen'],
  secondary = false,
) {
  const Icon = group.icon;
  const groupActive = isGroupActive(group, activeWorkspace);

  return (
    <section
      key={group.id}
      className={cn('px-1 py-1.5', groupActive && 'bg-primary/[0.025]')}
      data-report-group={group.id}
      data-specialist={secondary ? 'true' : undefined}
      data-active={groupActive ? 'true' : undefined}
    >
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <span
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-lg',
            groupActive ? 'bg-primary/15 text-primary' : secondary ? 'bg-muted/70 text-muted-foreground' : 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-black leading-5">{group.title}</h3>
      </div>

      <div className="mt-0.5 flex flex-col">
        {group.shortcuts.map((shortcut) => renderShortcut(shortcut, group, activeWorkspace, activeView, onOpen))}
      </div>
    </section>
  );
}

export function ReportDirectory({ activeWorkspace, activeView, onOpen }: ReportDirectoryProps) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<DirectoryTab>('all');

  const visibleGroups = useMemo(() => {
    const searched = filterReportGroups(reportGroups, query);
    const tabMeta = directoryTabs.find((item) => item.id === tab);
    if (!tabMeta?.groups) return searched;
    return searched.filter((group) => tabMeta.groups?.includes(group.id));
  }, [query, tab]);

  const visibleBusinessGroups = visibleGroups.filter((group) => !group.specialist);
  const visibleSpecialistGroups = visibleGroups.filter((group) => group.specialist);

  const pinnedVisible = useMemo(() => {
    const searched = filterReportGroups(reportGroups, query);
    const visibleIds = new Set(searched.map((group) => group.id));
    return pinnedReports.filter((pinned) => visibleIds.has(pinned.workspace));
  }, [query]);

  return (
    <section className="space-y-2.5" data-report-directory aria-labelledby="report-directory-title">
      <h2 className="sr-only" id="report-directory-title">اختر التقرير حسب ما تريد معرفته</h2>

      <div data-report-global-search>
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="ابحث في التقارير…"
          searchAriaLabel="بحث في مركز التقارير"
          className="shadow-none lg:grid-cols-1"
          filters={(
            <FilterTabs<DirectoryTab>
              options={directoryFilterOptions}
              value={tab}
              onChange={setTab}
              ariaLabel="مجالات التقارير"
              tone="primary"
            />
          )}
        />
      </div>

      {pinnedVisible.length > 0 && !query ? (
        <div data-report-pinned>
          <p className="px-1 text-[11px] font-black text-muted-foreground">الأكثر استخدامًا</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {pinnedVisible.map((pinned) => {
              const group = reportGroups.find((item) => item.id === pinned.workspace);
              const active = group?.id === activeWorkspace && pinned.view === activeView;
              return (
                <button
                  key={`${pinned.workspace}:${pinned.view}`}
                  type="button"
                  onClick={() => onOpen(pinned.workspace, pinned.view)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-1 rounded-lg border px-2.5 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    active
                      ? 'border-primary/35 bg-primary/10 text-primary'
                      : 'border-border/75 bg-background text-foreground hover:border-primary/30 hover:bg-primary/[0.035]',
                  )}
                >
                  <span>{pinned.label}</span>
                  <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {visibleGroups.length === 0 ? (
        <ReportState title="لا يوجد تقرير مطابق" message="جرّب كلمة بحث أخرى أو اعرض مجالًا مختلفًا." />
      ) : (
        <>
          {visibleBusinessGroups.length > 0 ? (
            <div className="divide-y divide-border/50 rounded-xl border border-border/70 bg-card" data-report-directory-groups>
              {visibleBusinessGroups.map((group) => renderGroup(group, activeWorkspace, activeView, onOpen))}
            </div>
          ) : null}

          {visibleSpecialistGroups.length > 0 ? (
            <div className="space-y-1.5" data-report-specialist-groups>
              <div className="flex items-center gap-1.5 px-1 pt-2">
                <Scale className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <p className="text-[11px] font-black text-muted-foreground">للمختصين — مراجعة مالية متقدمة</p>
              </div>
              <div className="divide-y divide-border/50 rounded-xl border border-border/70 bg-card/60">
                {visibleSpecialistGroups.map((group) => renderGroup(group, activeWorkspace, activeView, onOpen, true))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
