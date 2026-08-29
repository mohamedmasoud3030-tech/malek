import { useMemo, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ReportState } from '@/components/ui/report-section-primitives';
import { cn } from '@/lib/utils';
import {
  filterReportGroups,
  reportGroups,
  type ReportGroupId,
  type ReportShortcut,
} from './report-directory-groups';
import type { ReportSectionId } from '../reports-page.sections';
import type { ReportViewId } from '../report-view-registry';

type ReportDirectoryProps = Readonly<{
  activeSection: ReportSectionId;
  activeView: ReportViewId;
  scope?: Readonly<{
    ownerId?: string;
    tenantId?: string;
    contractId?: string;
  }>;
  onOpen: (section: ReportSectionId, view: ReportViewId) => void;
}>;

type DirectoryTab = 'all' | 'office' | 'collections' | 'leases' | 'maintenance' | 'owners' | 'properties';

const directoryTabs: readonly { id: DirectoryTab; label: string; groups?: readonly ReportGroupId[] }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'office', label: 'أداء المكتب', groups: ['office'] },
  { id: 'collections', label: 'التحصيل والمتأخرات', groups: ['collections'] },
  { id: 'leases', label: 'العقود والإشغال', groups: ['leases'] },
  { id: 'maintenance', label: 'المصروفات والصيانة', groups: ['maintenance'] },
  { id: 'owners', label: 'الملاك والمستأجرون', groups: ['owners'] },
  { id: 'properties', label: 'العقارات والوحدات', groups: ['properties'] },
];

/**
 * Curated set of the reports an office reaches for most often. These are
 * surfaced as a quiet intro row so the explorer never feels like a long
 * settings list; every one of them is still a real shortcut into the catalogue.
 */
const pinnedReports: readonly { section: ReportSectionId; view: ReportViewId; label: string }[] = [
  { section: 'analytics', view: 'overview', label: 'أداء المكتب' },
  { section: 'analytics', view: 'collections', label: 'التحصيل' },
  { section: 'analytics', view: 'overdue', label: 'المتأخرات' },
  { section: 'analytics', view: 'occupancy', label: 'الإشغال والشغور' },
  { section: 'analytics', view: 'expenses', label: 'المصروفات' },
];

function shortcutIsActive(
  shortcut: Pick<ReportShortcut, 'section' | 'view'>,
  activeSection: ReportSectionId,
  activeView: ReportViewId,
  scopeOwner?: boolean,
) {
  const isOwnerStatement = shortcut.section === 'statements' && shortcut.view === '' && scopeOwner;
  const isRegular = shortcut.section === activeSection && shortcut.view === activeView;
  return isOwnerStatement || isRegular;
}

function isGroupActive(
  group: { section: ReportSectionId; matches: readonly ReportViewId[] },
  activeSection: ReportSectionId,
  activeView: ReportViewId,
  scopeOwner?: boolean,
) {
  const isOwnerStatement = group.section === 'statements' && scopeOwner;
  const isRegular = group.section === activeSection && group.matches.includes(activeView);
  return isOwnerStatement || isRegular;
}

export function ReportDirectory({ activeSection, activeView, scope, onOpen }: ReportDirectoryProps) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<DirectoryTab>('all');
  const scopeOwner = Boolean(scope?.ownerId);

  const visibleGroups = useMemo(() => {
    const searched = filterReportGroups(reportGroups, query);
    const tabMeta = directoryTabs.find((item) => item.id === tab);
    if (!tabMeta?.groups) return searched;
    return searched.filter((group) => tabMeta.groups?.includes(group.id));
  }, [query, tab]);

  const pinnedVisible = useMemo(() => {
    const searched = filterReportGroups(reportGroups, query);
    const visibleIds = new Set(searched.map((group) => group.id));
    return pinnedReports.filter((pinned) => {
      const ownerGroup = pinned.section === 'statements';
      const group = reportGroups.find((item) => item.shortcuts.some((s) => s.section === pinned.section && s.view === pinned.view));
      const inSearched = ownerGroup && visibleIds.has('owners') ? true : group ? visibleIds.has(group.id) : false;
      return inSearched;
    });
  }, [query]);

  return (
    <section className="space-y-2.5" data-report-directory aria-label="مستكشف التقارير">
      <h2 className="sr-only" id="report-directory-title">اختر التقرير حسب ما تريد معرفته</h2>
      <div data-report-global-search>
        <div className="relative min-w-0">
          <label htmlFor="report-directory-search" className="sr-only">بحث في مركز التقارير</label>
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="report-directory-search"
            type="search"
            inputMode="search"
            autoComplete="off"
            dir="rtl"
            placeholder="ابحث في التقارير…"
            className="min-h-10 border-border/80 bg-background ps-9 pe-10"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="مسح بحث التقارير"
              className="absolute inset-y-0 end-2 my-auto grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" data-report-category-tabs>
        <div className="flex min-w-max gap-1" role="tablist" aria-label="مجالات التقارير">
          {directoryTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                'min-h-9 rounded-lg px-2.5 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                tab === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {pinnedVisible.length > 0 && !query ? (
        <div data-report-pinned>
          <p className="px-1 text-[11px] font-black text-muted-foreground">الأكثر استخدامًا</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {pinnedVisible.map((pinned) => {
              const active = shortcutIsActive(pinned, activeSection, activeView, scopeOwner);
              return (
                <button
                  key={`${pinned.section}:${pinned.view}`}
                  type="button"
                  onClick={() => onOpen(pinned.section, pinned.view)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
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
        <div className="divide-y divide-border/50 rounded-xl border border-border/70 bg-card" data-report-directory-groups>
          {visibleGroups.map((group) => {
            const Icon = group.icon;
            const groupActive = isGroupActive(group, activeSection, activeView, scopeOwner);

            return (
              <section
                key={group.id}
                className={cn('px-1 py-1.5', groupActive && 'bg-primary/[0.025]')}
                data-report-group={group.id}
                data-active={groupActive ? 'true' : undefined}
              >
                <div className="flex items-center gap-2.5 px-2 py-1.5">
                  <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', groupActive ? 'bg-primary/15 text-primary' : 'bg-primary/10 text-primary')}>
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <h3 className="min-w-0 flex-1 truncate text-[13px] font-black leading-5">{group.title}</h3>
                </div>

                <div className="mt-0.5 flex flex-col">
                  {group.shortcuts.map((shortcut) => {
                    const shortcutActive = shortcutIsActive(shortcut, activeSection, activeView, scopeOwner);
                    return (
                      <button
                        key={`${shortcut.section}:${shortcut.view}:${shortcut.label}`}
                        type="button"
                        onClick={() => onOpen(shortcut.section, shortcut.view)}
                        aria-current={shortcutActive ? 'page' : undefined}
                        title={shortcut.description}
                        className={cn(
                          'group flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-start text-[13px] font-semibold leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                          shortcutActive
                            ? 'bg-primary/[0.06] text-primary'
                            : 'text-foreground hover:bg-muted/60',
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{shortcut.label}</span>
                        <ArrowLeft className="size-3.5 shrink-0 text-muted-foreground/60 rtl:rotate-180" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
