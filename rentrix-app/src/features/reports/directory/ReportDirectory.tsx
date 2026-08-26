import { useMemo, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ReportState } from '@/components/ui/report-section-primitives';
import { cn } from '@/lib/utils';
import {
  REPORT_DIRECTORY_ENTRY_COUNT,
  filterReportGroups,
  reportGroups,
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

export function ReportDirectory({ activeSection, activeView, scope, onOpen }: ReportDirectoryProps) {
  const [query, setQuery] = useState('');
  const visibleGroups = useMemo(() => filterReportGroups(reportGroups, query), [query]);

  return (
    <section
      aria-labelledby="report-directory-title"
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card"
      data-report-directory
    >
      <div className="grid gap-3 border-b border-border/60 bg-muted/20 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-7 items-center rounded-full bg-primary/10 px-3 text-xs font-black text-primary">
              مكتبة التقارير
            </span>
            <span className="text-xs font-bold text-muted-foreground">
              {reportGroups.length} مجموعات · {REPORT_DIRECTORY_ENTRY_COUNT} مدخل
            </span>
          </div>
          <h2 id="report-directory-title" className="mt-2 text-lg font-black sm:text-xl">
            افتح التقرير من مكان واحد
          </h2>
          <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-muted-foreground sm:text-sm sm:leading-6">
            ابحث أو اختر مجموعة؛ التقرير المفتوح يظل مرتبطًا بنفس الرابط والفلاتر والصلاحيات.
          </p>
        </div>

        <div className="relative w-full">
          <label htmlFor="report-directory-search" className="sr-only">ابحث في مكتبة التقارير</label>
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="report-directory-search"
            type="search"
            inputMode="search"
            autoComplete="off"
            dir="rtl"
            placeholder="ابحث: تحصيل، ميزان، إشغال…"
            className="min-h-11 bg-background ps-9 pe-10"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="مسح بحث مكتبة التقارير"
              className="absolute inset-y-0 end-2 my-auto grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {visibleGroups.length === 0 ? (
          <ReportState
            title="لا يوجد تقرير بهذا الاسم"
            message="جرّب كلمة أخرى مثل التحصيل أو الإشغال أو ميزان المراجعة، أو امسح البحث لعرض كل المجموعات."
          />
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {visibleGroups.map((group) => {
              const Icon = group.icon;
              const isOwnerStatement = group.id === 'owners' && activeSection === 'statements' && Boolean(scope?.ownerId);
              const isTenantStatement = group.id === 'tenants' && activeSection === 'statements' && !scope?.ownerId && Boolean(scope?.tenantId || scope?.contractId);
              const isRegularActive = group.section === activeSection && group.matches.includes(activeView);
              const isActive = isOwnerStatement || isTenantStatement || isRegularActive;

              return (
                <article
                  key={group.id}
                  className={cn(
                    'min-w-0 rounded-2xl border p-3 transition-[border-color,background-color,box-shadow,transform] sm:p-4',
                    isActive
                      ? 'border-primary/35 bg-primary/[0.045] shadow-sm ring-1 ring-primary/10'
                      : 'border-border/65 bg-background/60 hover:-translate-y-px hover:border-primary/25 hover:shadow-sm',
                  )}
                  data-report-group={group.id}
                  data-active={isActive ? 'true' : undefined}
                >
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-start gap-3 rounded-xl text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    onClick={() => onOpen(group.section, group.view)}
                  >
                    <span className={cn(
                      'grid size-10 shrink-0 place-items-center rounded-xl',
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                    )}>
                      <Icon className="size-4.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate text-sm font-black sm:text-base">{group.title}</span>
                        <ArrowLeft className={cn('size-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs font-semibold leading-5 text-muted-foreground">
                        {group.description}
                      </span>
                    </span>
                  </button>

                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/50 pt-3" aria-label={`تقارير ${group.title}`}>
                    {group.shortcuts.map((shortcut) => {
                      const shortcutActive = shortcut.section === activeSection && shortcut.view === activeView;
                      return (
                        <button
                          key={`${shortcut.section}:${shortcut.view}:${shortcut.label}`}
                          type="button"
                          className={cn(
                            'min-h-10 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                            shortcutActive
                              ? 'border-primary/35 bg-primary text-primary-foreground'
                              : 'border-border/65 bg-muted/30 text-muted-foreground hover:border-primary/25 hover:bg-primary/5 hover:text-foreground',
                          )}
                          onClick={() => onOpen(shortcut.section, shortcut.view)}
                        >
                          {shortcut.label}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
