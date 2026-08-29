import { useMemo, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ReportState } from '@/components/ui/report-section-primitives';
import { cn } from '@/lib/utils';
import {
  REPORT_DIRECTORY_ENTRY_COUNT,
  filterReportGroups,
  reportGroups,
  type ReportGroupId,
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
  { id: 'collections', label: 'التحصيل', groups: ['collections'] },
  { id: 'leases', label: 'العقود والإشغال', groups: ['leases'] },
  { id: 'maintenance', label: 'الصيانة والمصروفات', groups: ['maintenance'] },
  { id: 'owners', label: 'الملاك والمستأجرون', groups: ['owners'] },
  { id: 'properties', label: 'العقارات والوحدات', groups: ['properties'] },
];

export function ReportDirectory({ activeSection, activeView, scope, onOpen }: ReportDirectoryProps) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<DirectoryTab>('all');

  const visibleGroups = useMemo(() => {
    const searched = filterReportGroups(reportGroups, query);
    const tabMeta = directoryTabs.find((item) => item.id === tab);
    if (!tabMeta?.groups) return searched;
    return searched.filter((group) => tabMeta.groups?.includes(group.id));
  }, [query, tab]);

  return (
    <section className="space-y-3" data-report-directory aria-labelledby="report-directory-title">
      <div className="rounded-xl border border-border/80 bg-card" data-report-global-search>
        <div className="flex flex-col gap-2 border-b border-border/70 p-2.5 sm:flex-row sm:items-center sm:gap-3 sm:p-3">
          <div className="relative min-w-0 flex-1">
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
          <p className="shrink-0 text-[11px] font-bold text-muted-foreground sm:text-xs">
            {REPORT_DIRECTORY_ENTRY_COUNT} تقريرًا وكشفًا
          </p>
        </div>

        <div className="overflow-x-auto p-1.5" data-report-category-tabs>
          <div className="flex min-w-max gap-1" role="tablist" aria-label="مجالات التقارير">
            {directoryTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  'min-h-9 rounded-lg px-3 text-xs font-black transition-colors sm:text-sm',
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
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black text-primary">مركز التقارير</p>
            <h2 id="report-directory-title" className="mt-0.5 text-base font-black sm:text-lg">اختر ما تريد معرفته</h2>
          </div>
        </div>

        {visibleGroups.length === 0 ? (
          <ReportState title="لا يوجد تقرير مطابق" message="جرّب كلمة بحث أخرى أو اعرض مجالًا مختلفًا." />
        ) : (
          <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card">
            {visibleGroups.map((group) => {
              const Icon = group.icon;
              const isOwnerStatement = group.id === 'owners' && activeSection === 'statements' && Boolean(scope?.ownerId);
              const isRegularActive = group.section === activeSection && group.matches.includes(activeView);
              const isActive = isOwnerStatement || isRegularActive;

              return (
                <section
                  key={group.id}
                  className={cn('p-3 sm:p-4', isActive && 'bg-primary/[0.025]')}
                  data-report-group={group.id}
                  data-active={isActive ? 'true' : undefined}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                        <div>
                          <h3 className="text-sm font-black sm:text-base">{group.title}</h3>
                          <p className="mt-0.5 text-xs font-semibold leading-5 text-muted-foreground">{group.description}</p>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {group.shortcuts.map((shortcut) => {
                          const shortcutActive = shortcut.section === activeSection && shortcut.view === activeView;
                          return (
                            <button
                              key={`${shortcut.section}:${shortcut.view}:${shortcut.label}`}
                              type="button"
                              onClick={() => onOpen(shortcut.section, shortcut.view)}
                              aria-current={shortcutActive ? 'page' : undefined}
                              title={shortcut.description}
                              className={cn(
                                'inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                                shortcutActive
                                  ? 'border-primary/35 bg-primary/10 text-primary'
                                  : 'border-border/75 bg-background text-foreground hover:border-primary/30 hover:bg-primary/[0.035]',
                              )}
                            >
                              <span>{shortcut.label}</span>
                              <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
