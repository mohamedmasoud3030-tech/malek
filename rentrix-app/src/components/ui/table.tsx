import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

/**
 * Canonical MALEK table sizing and visual presentation.
 *
 * One table primitive owns spacing, type scale, separators, base ink and
 * overflow across the product. Columns keep natural width so narrow viewports
 * scroll cleanly instead of crushing, wrapping or overlapping cell content.
 * Register/page call sites may add geometry, but they must not create another
 * table skin. Cards and Table remain two presentation options everywhere.
 */
const tableVariants = cva(
  [
    'w-full min-w-max caption-bottom text-[12px] leading-4 tabular-nums',
    '[&_td+td]:border-s [&_td+td]:border-border/60 [&_th+th]:border-s [&_th+th]:border-border/70',
    '[&_[data-column-priority=identity]]:font-bold',
    // Phone table mode is intentionally Excel-like: one compact row height,
    // narrow cell padding, and the whole row scrolls as one surface. Identity
    // and action columns must never pin to either edge on phones.
    'max-md:[&_td]:!h-8 max-md:[&_td]:!px-1.5 max-md:[&_td]:!py-0.5 max-md:[&_th]:!h-8 max-md:[&_th]:!px-1.5',
    'max-md:[&_[data-column-priority=identity]]:!static max-md:[&_[data-column-priority=identity]]:!min-w-0 max-md:[&_[data-column-priority=identity]]:!max-w-none max-md:[&_[data-column-priority=identity]]:!shadow-none',
    'max-md:[&_[data-column-priority=actions]]:!static max-md:[&_[data-column-priority=actions]]:!min-w-0 max-md:[&_[data-column-priority=actions]]:!shadow-none',
  ].join(' '),
  {
    variants: {
      density: {
        default: '[&_td]:h-9 [&_td]:py-1.5 [&_th]:h-9',
        compact: '[&_td]:h-8 [&_td]:py-1 [&_th]:h-8',
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
  return <thead className={cn('!bg-card !text-foreground [&_tr]:border-b [&_tr]:border-border/75', className)} {...props} />;
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
        '!bg-card border-b border-border/60 transition-colors hover:!bg-muted/25',
        selected && '!bg-primary/7 hover:!bg-primary/10',
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
        'h-9 whitespace-nowrap !bg-card px-2 text-start align-middle text-[11px] !font-extrabold leading-4 text-foreground/75 sm:px-2.5',
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
        'h-9 whitespace-nowrap px-2 py-1.5 align-middle text-[12px] font-medium text-foreground sm:px-2.5',
        className,
      )}
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <caption className={cn('mt-2 text-[11px] text-muted-foreground', className)} {...props} />;
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
        <tr key={rowIndex} aria-hidden="true" className="border-b border-border/60">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <td key={colIndex} className="h-9 border-s border-border/60 px-2 py-1.5 first:border-s-0">
              <Skeleton className="h-3.5 w-full" />
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
        <td colSpan={colSpan} className={cn('px-3 py-8 text-center', className)}>
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
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>
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
      <div className="flex flex-col items-center gap-2" role="alert">
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
