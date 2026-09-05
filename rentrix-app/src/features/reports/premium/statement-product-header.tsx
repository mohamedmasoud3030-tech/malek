import { ArrowRight, CalendarRange, FileText } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export type StatementContextItem = Readonly<{
  label: string;
  value: ReactNode;
}>;

/**
 * Entity-account statement chrome. This is intentionally distinct from the
 * analytical report header: it leads with the account holder and statement
 * scope, and its exit returns to the source entity rather than a catalog.
 * It owns no data, route, financial, or document authority.
 */
export function StatementProductHeader({
  title,
  description,
  icon: Icon,
  contextItems,
  actions,
  notice,
  backLabel,
  onBack,
}: Readonly<{
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  contextItems: readonly StatementContextItem[];
  actions: ReactNode;
  notice?: ReactNode;
  backLabel: string;
  onBack: () => void;
}>) {
  return (
    <header
      data-statement-product-header
      className="rounded-xl border border-primary/25 bg-primary/[0.035] p-3 shadow-sm sm:p-4"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mt-0.5 min-h-11 shrink-0 gap-1.5 px-2 text-xs font-black text-muted-foreground hover:text-foreground"
            aria-label={backLabel}
          >
            <ArrowRight className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{backLabel}</span>
            <span className="sm:hidden">رجوع</span>
          </Button>
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary sm:size-10">
            <Icon className="size-4.5 sm:size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p
              data-statement-identity
              className="inline-flex items-center gap-1 text-[10px] font-black tracking-wide text-primary"
            >
              <FileText className="size-3" aria-hidden="true" />
              كشف حساب مرتبط بكيان
            </p>
            <h1 className="mt-0.5 text-base font-black leading-6 text-foreground sm:text-lg">
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-[11px] font-medium leading-4 text-muted-foreground sm:text-xs">
              {description}
            </p>
          </div>
        </div>

        <div className="shrink-0" data-statement-product-actions>
          {actions}
        </div>
      </div>

      <dl
        data-statement-entity-context
        className="mt-3 grid min-w-0 gap-2 border-t border-primary/15 pt-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {contextItems.map((item) => (
          <div
            key={item.label}
            className="min-w-0 rounded-lg border border-border/60 bg-background/70 px-2.5 py-2"
          >
            <dt className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
              {item.label === 'فترة الكشف' ? (
                <CalendarRange className="size-3 shrink-0" aria-hidden="true" />
              ) : null}
              {item.label}
            </dt>
            <dd className="mt-0.5 break-words text-xs font-black leading-5 text-foreground">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      {notice ? <div className="mt-2">{notice}</div> : null}
    </header>
  );
}
