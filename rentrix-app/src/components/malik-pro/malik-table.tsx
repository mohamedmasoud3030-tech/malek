/*
 * ============================================
 * MALIK PRO - Table Component
 * Modern responsive table with RTL support
 * ============================================
 */

import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface MalikTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface MalikTableProps<T> {
  columns: MalikTableColumn<T>[];
  data: T[];
  keyOf: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  isLoading?: boolean;
  className?: string;
}

export function MalikTable<T>({
  columns,
  data,
  keyOf,
  onRowClick,
  emptyTitle = 'لا توجد بيانات',
  emptyDescription,
  isLoading = false,
  className,
}: MalikTableProps<T>) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            data-malik-skeleton
            className="h-14 w-full rounded-lg"
          />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div data-malik-empty className="py-12">
        <div data-malik-empty-icon>
          <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h3 data-malik-empty-title>{emptyTitle}</h3>
        {emptyDescription && (
          <p data-malik-empty-desc>{emptyDescription}</p>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[hsl(var(--malik-border))]">
      <table data-malik-table className={cn('w-full', className)}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{ width: column.width }}
                className={cn(
                  'whitespace-nowrap',
                  column.align === 'left' && 'text-right',
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-left'
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={keyOf(row)}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'transition-colors duration-150',
                onRowClick && 'cursor-pointer',
                index % 2 === 1 && 'bg-[hsl(var(--malik-muted)/0.3)]',
                'hover:bg-[hsl(var(--malik-primary)/0.04)]'
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'whitespace-nowrap',
                    column.align === 'left' && 'text-right',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-left'
                  )}
                >
                  {column.render
                    ? column.render(row)
                    : (row as Record<string, unknown>)[column.key] as ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Simple Table ──
export function MalikSimpleTable({
  headers,
  rows,
  className,
}: {
  headers: string[];
  rows: ReactNode[][];
  className?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[hsl(var(--malik-border))]">
      <table data-malik-table className={cn('w-full', className)}>
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th key={i}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Table Pagination ──
export function MalikTablePagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  className,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
  className?: string;
}) {
  const start = (currentPage - 1) * (itemsPerPage || 10) + 1;
  const end = Math.min(currentPage * (itemsPerPage || 10), totalItems || 0);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-4',
        'p-4 bg-[hsl(var(--malik-muted)/0.3)] border-t border-[hsl(var(--malik-border-light))]',
        className
      )}
    >
      <p className="text-xs font-medium text-[hsl(var(--malik-foreground-muted))]">
        {totalItems !== undefined && (
          <span>عرض {start} - {end} من {totalItems}</span>
        )}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={cn(
            'min-h-11 min-w-11 px-4 py-2 rounded-lg',
            'text-sm font-bold transition-colors',
            'border border-[hsl(var(--malik-border))] bg-[hsl(var(--malik-card))]',
            'hover:bg-[hsl(var(--malik-muted))]',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          السابق
        </button>
        <span className="px-3 text-sm font-bold text-[hsl(var(--malik-foreground))]">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={cn(
            'min-h-11 min-w-11 px-4 py-2 rounded-lg',
            'text-sm font-bold transition-colors',
            'border border-[hsl(var(--malik-border))] bg-[hsl(var(--malik-card))]',
            'hover:bg-[hsl(var(--malik-muted))]',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          التالي
        </button>
      </div>
    </div>
  );
}
