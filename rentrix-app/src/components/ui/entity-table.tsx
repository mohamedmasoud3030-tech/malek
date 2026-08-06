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

import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ListRestart,
} from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataErrorScreen } from "@/components/data-error-screen";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { useViewModePreference } from "@/hooks/use-view-mode-preference";
import { cn } from "@/lib/utils";

export interface ColumnDef<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

export type SortDirection = "asc" | "desc";

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
  rows: T[];
  columns: ColumnDef<T>[];
  keyOf: (row: T) => string;
  isLoading?: boolean;
  error?: unknown;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  errorTitle?: string;
  onRetry?: () => void;
  pagination?: PaginationState;
  sort?: SortState;
  onSort?: (field: string, direction: SortDirection) => void;
  onRowClick?: (row: T) => void;
  renderRowExpansion?: (row: T) => ReactNode;
  expandedRowId?: string | null;
  renderMobileCard?: (row: T) => ReactNode;
  /** Enables list/card switching whenever a card renderer is available. */
  enableViewModeToggle?: boolean;
  /** Keeps each page's preference independent across visits. */
  viewModeStorageKey?: string;
  "aria-label": string;
  className?: string;
  skeletonRows?: number;
}

function SortIcon({ field, sort }: { field: string; sort?: SortState }) {
  if (!sort || sort.field !== field)
    return <ChevronsUpDown className="ms-1 inline size-3.5 opacity-40" />;
  return sort.direction === "asc" ? (
    <ChevronUp className="ms-1 inline size-3.5 text-primary" />
  ) : (
    <ChevronDown className="ms-1 inline size-3.5 text-primary" />
  );
}

function TableSkeleton({
  rows,
  cols,
  hasMobileCards,
}: {
  rows: number;
  cols: number;
  hasMobileCards: boolean;
}) {
  return (
    <Card
      className={cn("overflow-hidden", hasMobileCards && "hidden md:block")}
    >
      <div className="mobile-scroll-x">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: cols }, (_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, i) => (
              <TableRow key={i}>
                {Array.from({ length: cols }, (_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function MobileSkeleton({
  rows,
  desktop = false,
}: {
  rows: number;
  desktop?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2",
        desktop ? "xl:grid-cols-3" : "md:hidden",
      )}
    >
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-2xl" />
      ))}
    </div>
  );
}

function PaginationBar({ pagination }: { pagination: PaginationState }) {
  const totalPages = Math.max(
    1,
    Math.ceil(pagination.total / pagination.pageSize),
  );
  const { page, onPageChange } = pagination;

  return (
    <nav
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
      aria-label="ترقيم الصفحات"
    >
      <span>
        الصفحة {page} من {totalPages}
        {pagination.total > 0 && (
          <span className="ms-2 text-xs opacity-60">
            ({pagination.total} سجل)
          </span>
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
  const totalPages = Math.max(
    1,
    Math.ceil(pagination.total / pagination.pageSize),
  );

  return (
    <EmptyState
      title="هذه الصفحة لا تحتوي على نتائج"
      description={`يوجد ${pagination.total} سجل في النتائج الحالية، لكن الصفحة ${pagination.page} خارج نطاق الصفحات المتاحة (${totalPages}).`}
      action={
        <Button onClick={() => pagination.onPageChange(1)}>
          <ListRestart className="me-2 size-4" aria-hidden="true" />
          العودة إلى الصفحة الأولى
        </Button>
      }
    />
  );
}

export function EntityTable<T>({
  rows,
  columns,
  keyOf,
  isLoading = false,
  error,
  emptyTitle = "لا توجد سجلات",
  emptyDescription = "لم يتم العثور على أي نتائج.",
  emptyAction,
  errorTitle = "تعذر تحميل البيانات",
  onRetry,
  pagination,
  sort,
  onSort,
  onRowClick,
  renderRowExpansion,
  expandedRowId,
  renderMobileCard,
  enableViewModeToggle = false,
  viewModeStorageKey,
  "aria-label": ariaLabel,
  className,
  skeletonRows = 5,
}: EntityTableProps<T>) {
  const canSwitchView = enableViewModeToggle && renderMobileCard !== undefined;
  const storageKey = viewModeStorageKey ?? `rentrix:view-mode:${ariaLabel}`;
  const [viewMode, setViewMode] = useViewModePreference(
    storageKey,
    "list",
    canSwitchView,
  );

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        {canSwitchView ? (
          <ViewModeToggle
            value={viewMode}
            onChange={setViewMode}
            className="ms-auto"
          />
        ) : null}
        {renderMobileCard && (
          <MobileSkeleton rows={skeletonRows} desktop={viewMode === "grid"} />
        )}
        {viewMode === "list" ? (
          <TableSkeleton
            rows={skeletonRows}
            cols={columns.length}
            hasMobileCards={renderMobileCard !== undefined}
          />
        ) : null}
      </div>
    );
  }

  if (error != null) {
    return (
      <DataErrorScreen
        title={errorTitle}
        error={error}
        fallbackMessage={error instanceof Error ? error.message : undefined}
        action={
          onRetry ? (
            <Button onClick={onRetry}>إعادة المحاولة</Button>
          ) : undefined
        }
      />
    );
  }

  if (rows.length === 0) {
    if (
      pagination !== undefined &&
      pagination.total > 0 &&
      pagination.page > 1
    ) {
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

  function handleSort(field: string) {
    if (!onSort) return;
    const nextDirection: SortDirection =
      sort?.field === field && sort.direction === "asc" ? "desc" : "asc";
    onSort(field, nextDirection);
  }

  const hasExpansion = renderRowExpansion !== undefined;
  const colSpan = columns.length + (hasExpansion ? 1 : 0);

  return (
    <div className={cn("space-y-4", className)}>
      {canSwitchView ? (
        <div className="flex items-center justify-end">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      ) : null}

      {renderMobileCard !== undefined && (
        <div
          className={cn(
            "grid gap-3 sm:grid-cols-2",
            viewMode === "grid" ? "xl:grid-cols-3" : "md:hidden",
          )}
          role="list"
          aria-label={ariaLabel}
        >
          {rows.map((row) => (
            <div key={keyOf(row)} role="listitem">
              {renderMobileCard(row)}
            </div>
          ))}
        </div>
      )}

      <Card
        data-entity-table-wrapper
        className={cn(
          "overflow-hidden",
          renderMobileCard !== undefined ? "hidden md:block" : "",
          viewMode === "grid" && "md:hidden",
        )}
      >
        <div
          data-entity-table-scroll
          tabIndex={0}
          role="region"
          aria-label={`${ariaLabel} — منطقة جدول قابلة للتمرير أفقياً عند الحاجة`}
          className={cn(
            renderMobileCard !== undefined
              ? "overflow-x-auto"
              : "mobile-scroll-x",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
          )}
        >
          <Table data-entity-table aria-label={ariaLabel}>
            <TableHeader>
              <TableRow>
                {hasExpansion && <TableHead className="w-12" />}
                {columns.map((col) => {
                  const sortDir =
                    col.sortable && sort?.field === col.key
                      ? ((sort.direction === "asc"
                          ? "ascending"
                          : "descending") as "ascending" | "descending")
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
                          className="inline-flex cursor-pointer items-center font-semibold hover:text-foreground"
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
                      onClick={
                        onRowClick !== undefined
                          ? () => onRowClick(row)
                          : undefined
                      }
                      className={cn(
                        onRowClick !== undefined && "cursor-pointer focus-visible:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35",
                      )}
                      tabIndex={onRowClick !== undefined ? 0 : undefined}
                      onKeyDown={
                        onRowClick !== undefined
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onRowClick(row);
                              }
                            }
                          : undefined
                      }
                      aria-expanded={hasExpansion ? isExpanded : undefined}
                    >
                      {hasExpansion && (
                        <TableCell
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          {isExpanded ? (
                            <ChevronUp
                              className="size-3.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronDown
                              className="size-3.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                          )}
                        </TableCell>
                      )}
                      {columns.map((col) => (
                        <TableCell key={col.key} className={col.className}>
                          {col.render(row)}
                        </TableCell>
                      ))}
                    </TableRow>

                    {hasExpansion &&
                      isExpanded &&
                      renderRowExpansion !== undefined && (
                        <TableRow key={`${rowKey}-expansion`}>
                          <TableCell
                            colSpan={colSpan}
                            className="bg-muted/30 p-4"
                          >
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

      {pagination !== undefined && <PaginationBar pagination={pagination} />}
    </div>
  );
}
