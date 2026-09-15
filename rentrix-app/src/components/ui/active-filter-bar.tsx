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
    <div
      data-active-filter-bar
      className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-border/75 bg-muted/[0.28] px-2.5 py-1.5', className)}
      aria-label="الفلاتر النشطة"
    >
      <span className="text-xs font-semibold text-primary">الفلاتر النشطة</span>
      {filters.map((filter) => (
        <Button
          key={filter.key}
          type="button"
          variant="outline"
          size="xs"
          onClick={filter.onRemove}
          className={cn(
            'rounded-full border-border bg-background px-2.5 py-0.5 text-xs font-bold text-foreground hover:border-primary/50 hover:text-primary',
            'align-middle'
          )}
          aria-label={`إزالة فلتر ${filter.label}`}
        >
          <span className="truncate text-muted-foreground">{filter.label}</span>
          <span className="truncate">{filter.value}</span>
          <X className="size-2.5 shrink-0" aria-hidden="true" />
        </Button>
      ))}
      {onClearAll ? (
        <Button variant="ghost" size="xs" className="px-2 text-xs sm:shrink-0" onClick={onClearAll}>
          مسح الكل
        </Button>
      ) : null}
    </div>
  );
}
