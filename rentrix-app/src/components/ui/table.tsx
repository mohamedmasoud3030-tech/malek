import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

/**
 * Canonical MALEK table sizing.
 *
 * Registers keep natural column width (`min-w-max`) so narrow viewports scroll
 * horizontally instead of crushing cells. The visual contract is intentionally
 * spreadsheet-like: compact, even rows, crisp separators, and quiet surfaces.
 */
const tableVariants = cva(
  'w-full min-w-max caption-bottom text-[13px] leading-5 tabular-nums [&_td+td]:border-s [&_td+td]:border-border/75 [&_th+th]:border-s [&_th+th]:border-border/85',
  {
    variants: {
      density: {
        default: '[&_td]:h-11 [&_td]:py-2 [&_th]:h-10',
        compact: '[&_td]:h-10 [&_td]:py-1.5 [&_th]:h-9',
      },
    },
    defaultVariants: { density: 'default' },
  },
);

type TableProps = HTMLAttributes<HTMLTableElement> & VariantProps<typeof tableVariants>;

export function Table({ className, density, ...props }: TableProps) {
  return <table className={cn(tableVariants({ density }), className)} {...props} />;
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_tr]:border-b [&_tr]:border-border/90', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableRow({
  className,
  selected,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return (
    <tr
      data-selected={selected ? 'true' : undefined}
      className={cn(
        'border-b border-border/75 bg-card transition-colors hover:bg-muted/35',
        selected && 'bg-primary/7 hover:bg-primary/10',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-10 whitespace-nowrap bg-muted/55 px-3 text-start align-middle text-[12px] font-extrabold leading-4 text-foreground/80 sm:px-3.5',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'h-11 whitespace-nowrap px-3 py-2 align-middle text-[13px] font-medium text-foreground sm:px-3.5',
        className,
      )}
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <caption className={cn('mt-3 text-xs text-muted-foreground', className)} {...props} />;
}

/** Reusable table loading block — screen-reader-safe (role=status, aria-live). */
export function TableLoading({
  columns,
  rows = 6,
  label = 'جارٍ تحميل البيانات...',
}: {
  columns: number;
  rows?: number;
  label?: string;
}) {
  return (
    <tbody role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} aria-hidden="true" className="border-b border-border/75">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <td key={colIndex} className="h-11 border-s border-border/75 px-3 py-2 first:border-s-0">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

type TableStateRowProps = HTMLAttributes<HTMLTableRowElement> & {
  colSpan: number;
};

function TableStateRow({ colSpan, className, children, ...props }: TableStateRowProps) {
  return (
    <tbody>
      <tr {...props}>
        <td colSpan={colSpan} className={cn('px-4 py-10 text-center', className)}>
          {children}
        </td>
      </tr>
    </tbody>
  );
}

export function TableEmpty({
  colSpan,
  title = 'لا توجد بيانات',
  description,
  action,
}: {
  colSpan: number;
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <TableStateRow colSpan={colSpan}>
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
        {action}
      </div>
    </TableStateRow>
  );
}

export function TableError({
  colSpan,
  title = 'تعذر تحميل البيانات',
  onRetry,
}: {
  colSpan: number;
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <TableStateRow colSpan={colSpan} className="text-danger">
      <div className="flex flex-col items-center gap-3" role="alert">
        <p className="text-sm font-semibold">{title}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-bold text-primary underline-offset-2 hover:underline"
          >
            إعادة المحاولة
          </button>
        ) : null}
      </div>
    </TableStateRow>
  );
}
