import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

const tableVariants = cva('w-full min-w-max caption-bottom text-sm', {
  variants: {
    density: {
      default: '',
      compact: '[&_td]:py-2.5 [&_th]:h-10',
    },
  },
  defaultVariants: { density: 'default' },
});

type TableProps = HTMLAttributes<HTMLTableElement> & VariantProps<typeof tableVariants>;

export function Table({ className, density, ...props }: TableProps) {
  return <table className={cn(tableVariants({ density }), className)} {...props} />;
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />;
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
        'border-b border-border transition-colors hover:bg-muted/60',
        selected && 'bg-primary/8 hover:bg-primary/12',
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
        'h-12 whitespace-nowrap px-4 text-start align-middle text-xs font-semibold text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-4 align-middle', className)} {...props} />;
}

export function TableCaption({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <caption className={cn('mt-3 text-xs text-muted-foreground', className)} {...props} />
  );
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
        <tr key={rowIndex} aria-hidden="true">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
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
  action?: React.ReactNode;
}) {
  return (
    <TableStateRow colSpan={colSpan}>
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
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
