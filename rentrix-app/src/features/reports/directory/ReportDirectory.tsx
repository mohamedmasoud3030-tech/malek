import { useMemo, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

/**
 * WP-C — Report library directory (C.5).
 *
 * Navigation index only: choosing a group or a shortcut emits the same
 * `(section, view)` pair the deep link would carry, so every entry stays
 * bookmarkable and permission-gated by the existing route. The directory never
 * renders a report body and never fetches.
 *
 * The card grid is capped at three columns and the shortcut chips wrap, so the
 * surface scales to a large catalogue without horizontal overflow. An Arabic
 * tolerant search narrows the catalogue in place.
 */
export function ReportDirectory({ activeSection, activeView, scope, onOpen }: ReportDirectoryProps) {
  const [query, setQuery] = useState('');
  const visibleGroups = useMemo(() => filterReportGroups(reportGroups, query), [query]);

  return (
    <section aria-labelledby="report-directory-title" className="space-y-3" data-report-directory>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id="report-directory-title" className="text-lg font-black sm:text-xl">مكتبة التقارير</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            اختر المجموعة أو افتح التقرير المطلوب مباشرة، ثم استخدم نطاق التقرير للتصفية الدقيقة.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:items-end">
          <p className="text-sm font-semibold text-muted-foreground">
            {reportGroups.length} مجموعات · {REPORT_DIRECTORY_ENTRY_COUNT} مدخل تقرير
          </p>
          <div className="relative w-full sm:w-64">
            <label htmlFor="report-directory-search" className="sr-only">
              ابحث في مكتبة التقارير
            </label>
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="report-directory-search"
              type="search"
              inputMode="search"
              autoComplete="off"
              dir="rtl"
              placeholder="ابحث عن تقرير…"
              className="min-h-11 ps-9"
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
      </div>

      {visibleGroups.length === 0 ? (
        <ReportState
          title="لا يوجد تقرير بهذا الاسم"
          message="جرّب كلمة أخرى مثل التحصيل أو الإشغال أو ميزان المراجعة، أو امسح البحث لعرض كل المجموعات."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                  'flex min-h-[13rem] flex-col rounded-2xl border bg-card p-4 shadow-card transition-[border-color,box-shadow,transform] sm:p-5',
                  'hover:-translate-y-0.5 hover:shadow-md',
                  isActive ? 'border-primary/50 ring-1 ring-primary/15' : 'border-border/70',
                )}
                data-report-group={group.id}
                data-active={isActive ? 'true' : undefined}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={cn(
                    'grid size-11 shrink-0 place-items-center rounded-xl',
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                  )}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {isActive ? (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">مفتوح الآن</span>
                  ) : null}
                </div>

                <div className="mt-4 flex-1">
                  <h3 className="text-base font-black">{group.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{group.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`تقارير ${group.title}`}>
                    {group.shortcuts.map((shortcut) => {
                      const shortcutActive = shortcut.section === activeSection && shortcut.view === activeView;
                      return (
                        <button
                          key={`${shortcut.section}:${shortcut.view}:${shortcut.label}`}
                          type="button"
                          className={cn(
                            'min-h-11 rounded-lg border px-3 py-2 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                            shortcutActive
                              ? 'border-primary/35 bg-primary/10 text-primary'
                              : 'border-border/70 bg-muted/35 text-muted-foreground hover:border-primary/25 hover:bg-primary/5 hover:text-foreground',
                          )}
                          onClick={() => onOpen(shortcut.section, shortcut.view)}
                        >
                          {shortcut.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button
                  type="button"
                  variant={isActive ? 'secondary' : 'outline'}
                  className="mt-4 min-h-11 w-full justify-between"
                  onClick={() => onOpen(group.section, group.view)}
                >
                  <span>{isActive ? 'المجموعة مفتوحة' : 'فتح المجموعة'}</span>
                  <ArrowLeft className="size-4" aria-hidden="true" />
                </Button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
