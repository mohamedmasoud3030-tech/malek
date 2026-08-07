/**
 * EnterpriseDataTable — Enterprise UX Foundation (Wave 4A)
 *
 * Canonical enterprise list surface. Module-agnostic: rows/columns come from
 * the caller, the table owns only presentation + interaction mechanics:
 *
 * - sorting (controlled or client-side via `sortValue` accessors)
 * - generic global filtering (via `globalFilterAccessor`)
 * - pagination (client slicing or server-driven passthrough)
 * - sticky header (inside a max-height scroll container)
 * - sticky inline-end actions column
 * - bulk selection with header toggle
 * - row action menu per record
 * - loading / empty / error states
 * - responsive mode (`renderMobileCard` swaps the grid below md)
 * - keyboard navigation (↑/↓/Home/End between rows, Enter/Space activate)
 *
 * NO module-specific logic lives here. Domain filtering, permissions and
 * calculations always stay in the feature layer.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, type LucideIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { EnterpriseEmptyState } from './enterprise-empty-state';
import { EnterpriseErrorState } from './enterprise-error-state';
import { EnterpriseLoadingState } from './enterprise-loading-state';
import {
  EnterpriseRowActions,
  type EnterpriseRowActionItem,
} from './enterprise-row-actions';
import type { EnterpriseSortState } from './hooks/use-table-state';

// ── Public types ─────────────────────────────────────────────────────────────

export interface EnterpriseColumnDef<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** Enable the sort affordance on the header. */
  sortable?: boolean;
  /**
   * Client sorting accessor. When present (and `sortMode="client"`),
   * the table sorts rows itself; when absent, sorting is left to the caller
   * (the sort change is still announced through `onSortChange`).
   */
  sortValue?: (row: T) => string | number | null;
  align?: 'start' | 'center' | 'end';
  /** Tailwind width hint, e.g. `'w-40'`. */
  widthClassName?: string;
  className?: string;
  headerClassName?: string;
}

export interface EnterpriseTablePagination {
  page: number;
  pageSize: number;
  /** Total row count — required in `server` mode, derived in `client` mode. */
  total?: number;
  mode?: 'client' | 'server';
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export interface EnterpriseDataTableProps<T> {
  rows: T[];
  columns: EnterpriseColumnDef<T>[];
  keyOf: (row: T) => string;
  'aria-label': string;

  // State gates (loading > error > empty > rows)
  isLoading?: boolean;
  skeletonRows?: number;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  emptyIcon?: LucideIcon;

  // Sorting
  sort?: EnterpriseSortState | null;
  defaultSort?: EnterpriseSortState | null;
  onSortChange?: (sort: EnterpriseSortState | null) => void;
  /** `client` sorts rows via `column.sortValue`; default is caller-controlled. */
  sortMode?: 'client' | 'controlled';

  // Generic global filter (client-side)
  globalFilter?: string;
  globalFilterAccessor?: (row: T) => string;

  // Pagination
  pagination?: EnterpriseTablePagination;

  // Selection
  selectable?: boolean;
  selectedKeys?: ReadonlySet<string> | readonly string[];
  onSelectionChange?: (keys: string[]) => void;

  // Row interactions
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => EnterpriseRowActionItem[];
  /** Accessible name for each row's action menu trigger. */
  rowActionsLabel?: (row: T) => string;

  // Responsive card mode
  renderMobileCard?: (row: T, index: number) => ReactNode;

  // Appearance
  density?: 'default' | 'compact';
  /** Pin the header inside the scroll container. Default true. */
  stickyHeader?: boolean;
  /** Scroll container height bound. Default `max-h-[70vh]`. */
  maxHeightClassName?: string;
  className?: string;
}

// ── Internals ────────────────────────────────────────────────────────────────

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function alignClass(align: EnterpriseColumnDef<unknown>['align']): string | undefined {
  if (align === 'center') return 'text-center';
  if (align === 'end') return 'text-end';
  return undefined;
}

function SortGlyph({
  active,
  direction,
}: {
  active: boolean;
  direction: 'asc' | 'desc';
}) {
  if (!active) return <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden="true" />;
  return direction === 'asc' ? (
    <ChevronUp className="size-3.5 text-primary" aria-hidden="true" />
  ) : (
    <ChevronDown className="size-3.5 text-primary" aria-hidden="true" />
  );
}

/** Arrow-key row traversal via DOM walking — tab order stays flat and fast. */
function handleRowKeys(event: React.KeyboardEvent<HTMLTableSectionElement>) {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const currentRow = target.closest('tr[data-enterprise-row]');
  if (!currentRow) return;

  const rows = Array.from(
    event.currentTarget.querySelectorAll<HTMLTableRowElement>('tr[data-enterprise-row]'),
  );
  const index = rows.indexOf(currentRow as HTMLTableRowElement);
  if (index === -1) return;

  let nextIndex: number | null = null;
  if (event.key === 'ArrowDown') nextIndex = Math.min(rows.length - 1, index + 1);
  else if (event.key === 'ArrowUp') nextIndex = Math.max(0, index - 1);
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = rows.length - 1;

  if (nextIndex !== null && nextIndex !== index) {
    event.preventDefault();
    rows[nextIndex].focus();
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function EnterpriseDataTable<T>({
  rows,
  columns,
  keyOf,
  'aria-label': ariaLabel,
  isLoading = false,
  skeletonRows = 6,
  error = null,
  onRetry,
  emptyTitle = 'لا توجد بيانات',
  emptyDescription,
  emptyAction,
  emptyIcon,
  sort,
  defaultSort = null,
  onSortChange,
  sortMode = 'controlled',
  globalFilter,
  globalFilterAccessor,
  pagination,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  onRowClick,
  rowActions,
  rowActionsLabel,
  renderMobileCard,
  density = 'default',
  stickyHeader = true,
  maxHeightClassName = 'max-h-[70vh]',
  className,
}: EnterpriseDataTableProps<T>) {
  const [internalSort, setInternalSort] = useState<EnterpriseSortState | null>(defaultSort);
  const activeSort = sort !== undefined ? sort : internalSort;

  const announceSort = (next: EnterpriseSortState | null) => {
    if (sort === undefined) setInternalSort(next);
    onSortChange?.(next);
  };

  const handleSortClick = (column: EnterpriseColumnDef<T>) => {
    if (!column.sortable) return;
    if (!activeSort || activeSort.field !== column.key) {
      announceSort({ field: column.key, direction: 'asc' });
      return;
    }
    if (activeSort.direction === 'asc') {
      announceSort({ field: column.key, direction: 'desc' });
      return;
    }
    announceSort(null);
  };

  const selectedSet: ReadonlySet<string> = useMemo(() => {
    if (!selectedKeys) return new Set<string>();
    return selectedKeys instanceof Set ? selectedKeys : new Set(selectedKeys);
  }, [selectedKeys]);

  // Filter → sort → paginate pipeline (generic, data-shape-free).
  const processedRows = useMemo(() => {
    let result = rows;

    if (globalFilter && globalFilter.trim() !== '' && globalFilterAccessor) {
      const needle = globalFilter.trim().toLowerCase();
      result = result.filter((row) => globalFilterAccessor(row).toLowerCase().includes(needle));
    }

    if (sortMode === 'client' && activeSort) {
      const column = columns.find((candidate) => candidate.key === activeSort.field);
      if (column?.sortValue) {
        const accessor = column.sortValue;
        const directionFactor = activeSort.direction === 'asc' ? 1 : -1;
        result = [...result].sort((a, b) => {
          const aValue = accessor(a);
          const bValue = accessor(b);
          if (aValue === null && bValue === null) return 0;
          if (aValue === null) return 1;
          if (bValue === null) return -1;
          const order =
            typeof aValue === 'number' && typeof bValue === 'number'
              ? aValue - bValue
              : collator.compare(String(aValue), String(bValue));
          return order * directionFactor;
        });
      }
    }

    return result;
  }, [rows, globalFilter, globalFilterAccessor, sortMode, activeSort, columns]);

  const paginationMode = pagination?.mode ?? 'client';
  const totalRows =
    pagination === undefined
      ? processedRows.length
      : paginationMode === 'server'
        ? (pagination.total ?? processedRows.length)
        : processedRows.length;
  const totalPages = pagination ? Math.max(1, Math.ceil(totalRows / pagination.pageSize)) : 1;

  const visibleRows = useMemo(() => {
    if (!pagination || paginationMode === 'server') return processedRows;
    const start = (pagination.page - 1) * pagination.pageSize;
    return processedRows.slice(start, start + pagination.pageSize);
  }, [processedRows, pagination, paginationMode]);

  const hasActionsColumn = rowActions !== undefined;
  const columnCount = columns.length + (selectable ? 1 : 0) + (hasActionsColumn ? 1 : 0);

  const pageKeys = useMemo(() => visibleRows.map((row) => keyOf(row)), [visibleRows, keyOf]);
  const allPageSelected =
    pageKeys.length > 0 && pageKeys.every((key) => selectedSet.has(key));
  const somePageSelected = pageKeys.some((key) => selectedSet.has(key));

  const togglePageSelection = () => {
    if (!onSelectionChange) return;
    const next = new Set(selectedSet);
    if (allPageSelected) pageKeys.forEach((key) => next.delete(key));
    else pageKeys.forEach((key) => next.add(key));
    onSelectionChange(Array.from(next));
  };

  const toggleRowSelection = (key: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(Array.from(next));
  };

  // ── State gates ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div data-enterprise-data-table data-state="loading" className={cn(className)}>
        <EnterpriseLoadingState context="table" rows={skeletonRows} />
      </div>
    );
  }

  if (error != null) {
    return (
      <div data-enterprise-data-table data-state="error" className={cn(className)}>
        <EnterpriseErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  if (visibleRows.length === 0) {
    const outOfRangePage =
      pagination !== undefined && paginationMode === 'client' && totalRows > 0;
    return (
      <div data-enterprise-data-table data-state="empty" className={cn(className)}>
        <EnterpriseEmptyState
          title={outOfRangePage ? 'هذه الصفحة خارج نطاق النتائج' : emptyTitle}
          description={emptyDescription}
          icon={emptyIcon}
          action={
            outOfRangePage ? (
              <Button onClick={() => pagination.onPageChange?.(1)}>العودة إلى الصفحة الأولى</Button>
            ) : (
              emptyAction
            )
          }
        />
      </div>
    );
  }

  // ── Rows surface ─────────────────────────────────────────────────────────
  const actionsHead = hasActionsColumn ? (
    <TableHead
      key="enterprise-actions-head"
      className={cn(
        'w-12 bg-card px-2 text-center',
        'sticky end-0 border-s border-border/70',
        stickyHeader && 'top-0 z-20',
        !stickyHeader && 'z-10',
      )}
    >
      <span className="sr-only">إجراءات</span>
    </TableHead>
  ) : null;

  const table = (
    <div
      data-enterprise-table-scroll
      role="region"
      aria-label={`${ariaLabel} — منطقة جدول قابلة للتمرير`}
      tabIndex={0}
      className={cn(
        'overflow-auto focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
        maxHeightClassName,
      )}
    >
      <Table density={density} aria-label={ariaLabel} data-enterprise-table>
        <TableHeader>
          <TableRow className={cn(stickyHeader && 'bg-card')}>
            {selectable ? (
              <TableHead
                className={cn(
                  'w-10 bg-card px-3',
                  stickyHeader && 'sticky top-0 z-10',
                )}
              >
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  ref={(element) => {
                    if (element) element.indeterminate = !allPageSelected && somePageSelected;
                  }}
                  onChange={togglePageSelection}
                  aria-label="تحديد كل الصفوف في الصفحة"
                  className="size-4 cursor-pointer accent-primary"
                />
              </TableHead>
            ) : null}

            {columns.map((column) => {
              const isActiveSort = activeSort?.field === column.key;
              return (
                <TableHead
                  key={column.key}
                  aria-sort={
                    column.sortable && isActiveSort
                      ? activeSort?.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                  className={cn(
                    column.widthClassName,
                    alignClass(column.align as 'start' | 'center' | 'end' | undefined),
                    stickyHeader && 'sticky top-0 z-10 bg-card',
                    column.headerClassName,
                  )}
                  scope="col"
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSortClick(column)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md font-semibold transition-colors',
                        'hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
                        isActiveSort && 'text-foreground',
                      )}
                      aria-label={`ترتيب حسب ${typeof column.header === 'string' ? column.header : column.key}`}
                    >
                      {column.header}
                      <SortGlyph active={isActiveSort} direction={activeSort?.direction ?? 'asc'} />
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}

            {actionsHead}
          </TableRow>
        </TableHeader>

        <TableBody onKeyDown={handleRowKeys}>
          {visibleRows.map((row, rowIndex) => {
            const key = keyOf(row);
            const isSelected = selectedSet.has(key);
            const actions = hasActionsColumn ? rowActions(row) : [];

            return (
              <TableRow
                key={key}
                data-enterprise-row
                selected={isSelected}
                tabIndex={0}
                aria-selected={selectable ? isSelected : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (
                          (event.key === 'Enter' || event.key === ' ') &&
                          event.target === event.currentTarget
                        ) {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={cn(
                  'group',
                  onRowClick && 'cursor-pointer',
                  'focus-visible:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35',
                )}
              >
                {selectable ? (
                  <TableCell className="w-10 px-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRowSelection(key)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`تحديد الصف ${rowIndex + 1}`}
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </TableCell>
                ) : null}

                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      alignClass(column.align as 'start' | 'center' | 'end' | undefined),
                      column.widthClassName,
                      column.className,
                    )}
                  >
                    {column.cell(row, rowIndex)}
                  </TableCell>
                ))}

                {hasActionsColumn ? (
                  <TableCell
                    className={cn(
                      'w-12 bg-card px-2 text-center',
                      'sticky end-0 border-s border-border/70',
                      'transition-colors group-hover:bg-muted/60',
                      'group-data-[selected=true]:bg-primary/8 group-data-[selected=true]:group-hover:bg-primary/12',
                    )}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <EnterpriseRowActions
                      items={actions}
                      label={rowActionsLabel ? rowActionsLabel(row) : `إجراءات الصف ${rowIndex + 1}`}
                    />
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div data-enterprise-data-table data-state="ready" className={cn('space-y-3', className)}>
      {renderMobileCard !== undefined ? (
        <div className="grid gap-3 md:hidden" role="list" aria-label={ariaLabel}>
          {visibleRows.map((row, index) => (
            <div key={keyOf(row)} role="listitem">
              {renderMobileCard(row, index)}
            </div>
          ))}
        </div>
      ) : null}

      <Card
        className={cn(
          'overflow-hidden',
          renderMobileCard !== undefined && 'hidden md:block',
        )}
      >
        {table}
      </Card>

      {pagination !== undefined ? (
        <nav
          aria-label="ترقيم الصفحات"
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              الصفحة {pagination.page} من {totalPages}
            </span>
            <span className="text-xs opacity-60 tabular-nums">({totalRows} سجل)</span>
            {pagination.onPageSizeChange !== undefined ? (
              <Select
                value={String(pagination.pageSize)}
                onChange={(event) => pagination.onPageSizeChange?.(Number(event.target.value))}
                aria-label="عدد الصفوف في الصفحة"
                className="min-h-9 w-24 rounded-lg sm:min-h-9"
              >
                {(pagination.pageSizeOptions ?? [10, 20, 50, 100]).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              variant="secondary"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange?.(Math.max(1, pagination.page - 1))}
              aria-label="الصفحة السابقة"
            >
              السابق
            </Button>
            <Button
              variant="secondary"
              disabled={pagination.page >= totalPages}
              onClick={() =>
                pagination.onPageChange?.(Math.min(totalPages, pagination.page + 1))
              }
              aria-label="الصفحة التالية"
            >
              التالي
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
