import { useMemo, useState } from 'react';
import { ArrowLeft, Search, Star, X } from 'lucide-react';
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

type DirectoryTab = 'all' | 'finance' | 'leases' | 'maintenance' | 'owners' | 'analytics';

const directoryTabs: readonly { id: DirectoryTab; label: string; groups?: readonly ReportGroupId[] }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'finance', label: 'المالية والتحصيل', groups: ['finance', 'control'] },
  { id: 'leases', label: 'التأجير والإشغال', groups: ['leases', 'properties'] },
  { id: 'maintenance', label: 'الصيانة', groups: ['maintenance'] },
  { id: 'owners', label: 'الملاك والكشوف', groups: ['owners'] },
  { id: 'analytics', label: 'التحليلات', groups: ['analytics'] },
];

const pinnedReports = [
  { label: 'تقرير المتأخرات', section: 'analytics' as const, view: 'overdue' as const },
  { label: 'كشف التحصيل', section: 'analytics' as const, view: 'collections' as const },
  { label: 'انتهاء العقود', section: 'analytics' as const, view: 'occupancy' as const },
  { label: 'كشف حساب المالك', section: 'statements' as const, view: '' as const },
] as const;

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
      <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-card sm:p-4" data-report-global-search>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="relative min-w-0">
            <label htmlFor="report-directory-search" className="sr-only">ابحث بالتقرير</label>
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="report-directory-search"
              type="search"
              inputMode="search"
              autoComplete="off"
              dir="rtl"
              placeholder="بحث بالتقرير: تحصيل، عقار، صيانة، مالك…"
              className="min-h-11 bg-background ps-9 pe-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="مسح بحث التقارير"
                className="absolute inset-y-0 end-2 my-auto grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="text-xs font-bold text-muted-foreground">
            {reportGroups.length} أقسام · {REPORT_DIRECTORY_ENTRY_COUNT} تقريرًا وكشفًا
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card p-3 shadow-card sm:p-4" aria-labelledby="pinned-reports-title" data-pinned-reports>
        <div className="mb-3 flex items-center gap-2">
          <Star className="size-4 text-primary" aria-hidden="true" />
          <div>
            <h2 id="pinned-reports-title" className="text-sm font-black sm:text-base">التقارير الأساسية</h2>
            <p className="text-xs font-semibold text-muted-foreground">وصول سريع لأكثر التقارير استخدامًا بدون أرقام تجريبية أو بيانات غير محملة.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {pinnedReports.map((report) => {
            const isActive = report.section === activeSection && report.view === activeView;
            return (
              <button
                key={report.label}
                type="button"
                onClick={() => onOpen(report.section, report.view)}
                className={cn(
                  'flex min-h-20 items-center justify-between gap-3 rounded-xl border px-3 py-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  isActive
                    ? 'border-primary/40 bg-primary/7 text-foreground'
                    : 'border-border/65 bg-background/70 hover:border-primary/30 hover:bg-primary/[0.035]',
                )}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-black">{report.label}</span>
                  <span className="mt-1 block text-xs font-semibold text-muted-foreground">فتح التقرير ومعاينة التفاصيل</span>
                </span>
                <ArrowLeft className="size-4 shrink-0 text-primary" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card p-2 shadow-card" data-report-category-tabs>
        <div className="flex min-w-max gap-1" role="tablist" aria-label="أقسام مركز التقارير">
          {directoryTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                'min-h-10 rounded-xl px-3 text-xs font-black transition-colors sm:text-sm',
                tab === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black text-primary">مركز التقارير</p>
            <h2 id="report-directory-title" className="mt-0.5 text-lg font-black sm:text-xl">التقارير والكشوف حسب العمل</h2>
          </div>
        </div>

        {visibleGroups.length === 0 ? (
          <ReportState title="لا يوجد تقرير مطابق" message="جرّب كلمة بحث أخرى أو اعرض قسمًا مختلفًا." />
        ) : (
          visibleGroups.map((group) => {
            const Icon = group.icon;
            const isOwnerStatement = group.id === 'owners' && activeSection === 'statements' && Boolean(scope?.ownerId);
            const isRegularActive = group.section === activeSection && group.matches.includes(activeView);
            const isActive = isOwnerStatement || isRegularActive;

            return (
              <section key={group.id} className="space-y-2" data-report-group={group.id}>
                <div className="flex items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black sm:text-base">{group.title}</h3>
                    <p className="text-xs font-semibold text-muted-foreground">{group.description}</p>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {group.shortcuts.map((shortcut) => {
                    const shortcutActive = shortcut.section === activeSection && shortcut.view === activeView;
                    return (
                      <article
                        key={`${shortcut.section}:${shortcut.view}:${shortcut.label}`}
                        className={cn(
                          'rounded-2xl border bg-card p-3 shadow-card transition-[border-color,transform,box-shadow] sm:p-4',
                          shortcutActive || isActive
                            ? 'border-primary/30 ring-1 ring-primary/10'
                            : 'border-border/65 hover:-translate-y-px hover:border-primary/25 hover:shadow-sm',
                        )}
                      >
                        <div className="flex min-h-24 flex-col">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="text-sm font-black sm:text-base">{shortcut.label}</h4>
                              <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">{shortcut.description}</p>
                            </div>
                            <Icon className="size-4.5 shrink-0 text-primary" aria-hidden="true" />
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpen(shortcut.section, shortcut.view)}
                            className="mt-auto inline-flex min-h-10 items-center justify-between gap-2 rounded-xl bg-primary/8 px-3 text-xs font-black text-primary transition-colors hover:bg-primary/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            <span>فتح التقرير</span>
                            <ArrowLeft className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </section>
  );
}
