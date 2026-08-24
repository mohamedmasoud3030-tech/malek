import { Check, Columns3, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

type ColumnOption = Readonly<{
  key: string;
  label: string;
  locked?: boolean;
}>;

type DataTableColumnsMenuProps = Readonly<{
  columns: readonly ColumnOption[];
  visibleKeys: readonly string[];
  onChange: (keys: string[]) => void;
  label?: string;
  className?: string;
}>;

/**
 * Shared MALEK column-visibility control for dense data registers.
 * Page code owns the selected keys; this component owns the interaction and
 * visual contract so every register can expose columns in the same way.
 */
export function DataTableColumnsMenu({
  columns,
  visibleKeys,
  onChange,
  label = 'الأعمدة',
  className,
}: DataTableColumnsMenuProps) {
  const visible = new Set(visibleKeys);
  const allKeys = columns.map((column) => column.key);

  const toggle = (column: ColumnOption) => {
    if (column.locked) return;
    const next = new Set(visible);
    if (next.has(column.key)) next.delete(column.key);
    else next.add(column.key);

    for (const item of columns) {
      if (item.locked) next.add(item.key);
    }
    onChange(allKeys.filter((key) => next.has(key)));
  };

  return (
    <details className={cn('group relative', className)} data-table-columns-menu>
      <summary
        aria-label={`${label} ${visibleKeys.length} من ${columns.length}`}
        className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-border/85 bg-background px-2.5 text-xs font-bold text-muted-foreground outline-none transition hover:bg-muted/55 hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/15 sm:px-3 [&::-webkit-details-marker]:hidden"
      >
        <Columns3 className="size-4" aria-hidden="true" />
        <span>{label}</span>
        <span className="hidden rounded-md bg-muted px-1.5 py-0.5 text-xs font-black tabular-nums text-foreground/75 md:inline">
          {visibleKeys.length}/{columns.length}
        </span>
      </summary>

      <div className="absolute end-0 top-[calc(100%+0.4rem)] z-50 w-56 overflow-hidden rounded-xl border border-border/90 bg-popover p-1.5 text-popover-foreground shadow-elevated">
        <div className="flex items-center justify-between border-b border-border/60 px-2 pb-1.5 pt-0.5">
          <span className="text-xs font-black text-muted-foreground">إظهار الأعمدة</span>
          <button
            type="button"
            onClick={() => onChange(allKeys)}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/15"
            aria-label="إظهار كل الأعمدة"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto py-1">
          {columns.map((column) => {
            const checked = visible.has(column.key);
            return (
              <button
                key={column.key}
                type="button"
                onClick={() => toggle(column)}
                disabled={column.locked}
                aria-pressed={checked}
                className={cn(
                  'flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-start text-xs font-semibold outline-none transition hover:bg-muted focus-visible:ring-4 focus-visible:ring-primary/15',
                  column.locked && 'cursor-default opacity-65',
                )}
              >
                <span className={cn(
                  'grid size-4 shrink-0 place-items-center rounded border border-border bg-background',
                  checked && 'border-primary bg-primary text-primary-foreground',
                )}>
                  {checked ? <Check className="size-3" aria-hidden="true" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{column.label}</span>
                {column.locked ? <span className="text-xs font-bold text-muted-foreground">ثابت</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </details>
  );
}
