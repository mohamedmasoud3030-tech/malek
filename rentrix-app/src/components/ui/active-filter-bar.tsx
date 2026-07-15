import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ActiveFilterItem = Readonly<{
  key: string;
  label: string;
  value: ReactNode;
  onRemove: () => void;
}>;

type ActiveFilterBarProps = Readonly<{
  filters: readonly ActiveFilterItem[];
  onClearAll?: () => void;
  className?: string;
}>;

export function ActiveFilterBar({ filters, onClearAll, className }: ActiveFilterBarProps) {
  if (filters.length === 0) return null;

  return (
    <div className={cn('rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2', className)} aria-label="الفلاتر النشطة">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-primary">الفلاتر النشطة</span>
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={filter.onRemove}
              className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-foreground transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              aria-label={`إزالة فلتر ${filter.label}`}
            >
              <span className="text-muted-foreground">{filter.label}</span>
              <span className="truncate">{filter.value}</span>
              <X className="size-3.5 shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>
        {onClearAll ? (
          <Button variant="ghost" className="min-h-9 px-3 text-xs sm:shrink-0" onClick={onClearAll}>
            مسح الكل
          </Button>
        ) : null}
      </div>
    </div>
  );
}
