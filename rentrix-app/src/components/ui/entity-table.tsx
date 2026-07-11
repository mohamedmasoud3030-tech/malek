/**
 * EntityTable — مكوّن الجدول الموحد (ADR-008 Phase A)
 *
 * يحل محل 13 جدولاً يدوياً متفرقاً بمكوّن واحد يدير:
 * - Loading skeleton
 * - Error state
 * - Empty state
 * - Pagination
 * - Sorting (اختياري)
 * - Mobile card view عبر renderMobileCard
 * - Row actions
 * - Accessibility: aria-label, keyboard navigation, aria-sort
 */

import { ChevronDown, ChevronUp, ChevronsUpDown, ListRestart } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataErrorScreen } from '@/components/data-error-screen';
import { EmptyState } from '@/components/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  /** مفتاح فريد للعمود */
  key: string;
  /** العنوان المعروض */
  header: ReactNode;
  /** دالة لاستخراج محتوى الخلية من الصف */
  render: (row: T) => ReactNode;
  /** هل يمكن الفرز بهذا العمود؟ */
  sortable?: boolean;
  /** عرض العمود (Tailwind class مثل 'w-40') */
  className?: string;
}

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  field: string;
  direction: SortDirection;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface EntityTableProps<T> {
  // ─── Data ────────────────────────────────────────────────
  rows: T[];
  columns: ColumnDef<T>[];
  keyOf: (row: T) => string;

  // ─── States ──────────────────────────────────────────────
  isLoading?: boolean;
  /** Pass queryResult.error when isError is true, or null otherwise */
  error?: unknown;

  // ─── Empty state ─────────────────────────────────────────
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;

  // ─── Error state ─────────────────────────────────────────
  errorTitle?: string;
  onRetry?: () => void;

  // ─── Pagination ──────────────────────────────────────────
  pagination?: PaginationState;

  // ─── Sorting ─────────────────────────────────────────────
  sort?: SortState;
  onSort?: (field: string, direction: SortDirection) => void;

  // ─── Row interaction ─────────────────────────────────────
  onRowClick?: (row: T) => void;
  /** Slot for extra row content (expand panel, etc.) */
  renderRowExpansion?: (row: T) => ReactNode;
  expandedRowId?: string | null;

  // ─── Mobile ──────────────────────────────────────────────
  /** إذا غاب هذا الـ prop، الجدول يظهر دائماً بدون card mobile view */
  renderMobileCard?: (row: T) => ReactNode;

  // ─── Accessibility ───────────────────────────────────────
  'aria-label': string;

  // ─── Styling ─────────────────────────────────────────────
  className?: string;
  /** عدد skeleton rows أثناء التحميل (افتراضي: 5) */
  skeletonRows?: number;
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ field, sort }: { field: string; sort?: SortState }) {
  if (!sort || sort.field !== field) return <ChevronsUpDown className="ms-1 inline size-3.5 opacity-40" />;
  return sort.direction === 'asc'
    ? <ChevronUp className="ms-1 inline size-3.5 text-primary" />
    : <ChevronDown className="ms-1 inline size-3.5 text-primary" />;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton({ rows, cols, hasMobileCards }: { rows: number; cols: number; hasMobileCards: boolean }) {
  return (
    <Card className={cn('overflow-hidden', hasMobileCards && 'hidden md:block')}>
      <div className="mobile-scroll-x">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: cols }, (_, i) => (
                <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, i) => (
              <TableRow key={i}>
                {Array.from({ length: cols }, (_, j) => (
                  <TableCell key={j}><Skeleton className="h-10 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function MobileSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:hidden">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-2xl" />
      ))}
    </div>
  );
}

// ─── Pagination bar ───────────────────────────────────────────────────────────

function PaginationBar({ pagination }: { pagination: PaginationState }) {
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const { page, onPageChange } = pagination;

  return (
    <nav className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between" aria-label="ترقيم الصفحات">
      <span>
        الصفحة {page} من {totalPages}
        {pagination.total > 0 && (
          <span className="ms-2 text-xs opacity-60">({pagination.total} سجل)</span>
        )}
      </span>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="الصفحة السابقة"
        >
          السابق
        </Button>
        <Button
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          aria-label="الصفحة التالية"
        >
          التالي
        </Button>
      </div>
    </nav>
  );
}


function PaginationRecovery({ pagination }: { pagination: PaginationState }) {
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));

  return (
    <EmptyState
      title="هذه الصفحة لا تحتوي على نتائج"
      description={`يوجد ${pagination.total} سجل في النتائج الحالية، لكن الصفحة ${pagination.page} خارج نطاق الصفحات المتاحة (${totalPages}).`}
      action={(
        <Button onClick={() => pagination.onPageChange(1)}>
          <ListRestart className="me-2 size-4" aria-hidden="true" />
          العودة إلى الصفحة الأولى
        </Button>
      )}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EntityTable<T>({
  rows,
  columns,
  keyOf,
  isLoading = false,
  error,
  emptyTitle = 'لا توجد سجلات',
  emptyDescription = 'لم يتم العثور على أي نتائج.',
  emptyAction,
  errorTitle = 'تعذر تحميل البيانات',
  onRetry,
  pagination,
  sort,
  onSort,
  onRowClick,
  renderRowExpansion,
  expandedRowId,
  renderMobileCard,
  'aria-label': ariaLabel,
  className,
  skeletonRows = 5,
}: EntityTableProps<T>) {

  // ── Loading ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {renderMobileCard && <MobileSkeleton rows={skeletonRows} />}
        <TableSkeleton rows={skeletonRows} cols={columns.length} hasMobileCards={renderMobileCard !== undefined} />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────
  if (error != null) {
    return (
      <DataErrorScreen
        title={errorTitle}
        error={error}
        fallbackMessage={error instanceof Error ? error.message : undefined}
        action={onRetry ? <Button onClick={onRetry}>إعادة المحاولة</Button> : undefined}
      />
    );
  }

  // ── Empty ────────────────────────────────────────────────
  if (rows.length === 0) {
    if (pagination !== undefined && pagination.total > 0 && pagination.page > 1) {
      return <PaginationRecovery pagination={pagination} />;
    }

    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  // ── Sort handler ─────────────────────────────────────────
  function handleSort(field: string) {
    if (!onSort) return;
    const nextDirection: SortDirection =
      sort?.field === field && sort.direction === 'asc' ? 'desc' : 'asc';
    onSort(field, nextDirection);
  }

  // ── Render ───────────────────────────────────────────────
  const hasExpansion = renderRowExpansion !== undefined;
  const colSpan = columns.length + (hasExpansion ? 1 : 0);

  return (
    <div className={cn('space-y-4', className)}>

      {/* Mobile card view */}
      {renderMobileCard !== undefined && (
        <div className="grid gap-3 sm:grid-cols-2 md:hidden" role="list" aria-label={ariaLabel}>
          {rows.map((row) => (
            <div key={keyOf(row)} role="listitem">
              {renderMobileCard(row)}
            </div>
          ))}
        </div>
      )}

      {/* Desktop table */}
      <Card className={cn('overflow-hidden', renderMobileCard !== undefined ? 'hidden md:block' : '')}>
        <div className={renderMobileCard !== undefined ? "overflow-x-auto" : "mobile-scroll-x"}>
          <Table aria-label={ariaLabel}>
            <TableHeader>
              <TableRow>
                {hasExpansion && <TableHead className="w-12" />}
                {columns.map((col) => {
                  const sortDir = col.sortable && sort?.field === col.key
                    ? (sort.direction === 'asc' ? 'ascending' : 'descending') as 'ascending' | 'descending'
                    : undefined;
                  return (
                    <TableHead
                      key={col.key}
                      className={col.className}
                      aria-sort={sortDir}
                    >
                      {col.sortable === true && onSort !== undefined ? (
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center font-black hover:text-foreground"
                          onClick={() => handleSort(col.key)}
                        >
                          {col.header}
                          <SortIcon field={col.key} sort={sort} />
                        </button>
                      ) : (
                        col.header
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const rowKey = keyOf(row);
                const isExpanded = expandedRowId === rowKey;
                return (
                  <Fragment key={rowKey}>
                    <TableRow
                      onClick={onRowClick !== undefined ? () => onRowClick(row) : undefined}
                      className={cn(onRowClick !== undefined && 'cursor-pointer')}
                      tabIndex={onRowClick !== undefined ? 0 : undefined}
                      onKeyDown={
                        onRowClick !== undefined
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onRowClick(row);
                              }
                            }
                          : undefined
                      }
                      aria-expanded={hasExpansion ? isExpanded : undefined}
                    >
                      {hasExpansion && (
                        <TableCell onClick={(e) => { e.stopPropagation(); }}>
                          {isExpanded ? (
                            <ChevronUp className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          )}
                        </TableCell>
                      )}
                      {columns.map((col) => (
                        <TableCell key={col.key} className={col.className}>
                          {col.render(row)}
                        </TableCell>
                      ))}
                    </TableRow>

                    {hasExpansion && isExpanded && renderRowExpansion !== undefined && (
                      <TableRow key={`${rowKey}-expansion`}>
                        <TableCell colSpan={colSpan} className="bg-muted/30 p-4">
                          {renderRowExpansion(row)}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      {pagination !== undefined && <PaginationBar pagination={pagination} />}
    </div>
  );
}
