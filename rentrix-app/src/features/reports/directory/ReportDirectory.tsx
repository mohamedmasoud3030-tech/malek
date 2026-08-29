import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { FilterBar } from '@/components/ui/filter-bar';
import { FilterTabs } from '@/components/ui/filter-tabs';
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

const directoryFilterOptions: { value: DirectoryTab; label: string }[] = directoryTabs.map((item) => ({
  value: item.id,
  label: item.label,
}));

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
      <div data-report-global-search>
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="ابحث في التقارير…"
          searchAriaLabel="بحث في مركز التقارير"
          filters={(
            <FilterTabs
              options={directoryFilterOptions}
              value={tab}
              onChange={setTab}
              ariaLabel="مجالات التقارير"
              tone="primary"
            />
          )}
          actions={(
            <p className="whitespace-nowrap px-2 text-[11px] font-bold text-muted-foreground sm:text-xs">
              {REPORT_DIRECTORY_ENTRY_COUNT} تقريرًا وكشفًا
            </p>
          )}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black text-primary">مركز التقارير</p>
            <h2 id="report-directory-title" className="mt-0.5 text-base font-black sm:text-lg">اختر التقرير حسب ما تريد معرفته</h2>
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
                      <h3 className="text-sm font-black sm:text-base">{group.title}</h3>
                      <p className="mt-0.5 hidden text-xs font-semibold leading-5 text-muted-foreground sm:block">{group.description}</p>

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
                                'inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
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
