/**
 * EntityTable — the single dense-register foundation.
 *
 * Mobile remains a compact table, never a card list. Identity and actions stay
 * available, lower-priority columns move behind an accessible disclosure at
 * narrow widths, and the complete row remains reachable without information
 * loss. The scroll region is keyboard focusable and horizontal overflow is
 * contained by the table wrapper.
 */

import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ListRestart,
} from "lucide-react";
import {
  Fragment,
  useId,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
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
import { cn } from "@/lib/utils";

export type ColumnPriority = "identity" | "primary" | "secondary" | "detail" | "actions";

export interface ColumnDef<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  /** Controls narrow-width ordering/disclosure without deleting information. */
  priority?: ColumnPriority;
  /** Identity/actions columns are sticky by default; set false for an exception. */
  sticky?: boolean;
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
  onExpandedRowChange?: (rowId: string | null) => void;
  /** @deprecated Registers always render the shared compact table. */
  renderMobileCard?: (row: T) => ReactNode;
  /** @deprecated View switching was removed from dense registers. */
  enableViewModeToggle?: boolean;
  /** @deprecated Kept only for source compatibility. */
  viewModeStorageKey?: string;
  "aria-label": string;
  className?: string;
  skeletonRows?: number;
}

type ResolvedColumn<T> = ColumnDef<T> & { resolvedPriority: ColumnPriority };

function resolveColumns<T>(columns: ColumnDef<T>[]): ResolvedColumn<T>[] {
  return columns.map((column, index) => {
    let resolvedPriority = column.priority;
    if (!resolvedPriority) {
      if (/action|إجراء/i.test(column.key)) resolvedPriority = "actions";
      else if (index === 0) resolvedPriority = "identity";
      else if (index <= 2) resolvedPriority = "primary";
      else resolvedPriority = "secondary";
    }
    return { ...column, resolvedPriority };
  });
}

function priorityClass(priority: ColumnPriority, sticky = true) {
  return cn(
    (priority === "secondary" || priority === "detail") && "max-sm:hidden",
    sticky && priority === "identity" && "sticky start-0 z-[2] min-w-[10rem] bg-card shadow-[1px_0_0_hsl(var(--border))]",
    sticky && priority === "actions" && "sticky end-0 z-[2] min-w-[7rem] bg-card shadow-[-1px_0_0_hsl(var(--border))]",
  );
}

function isNestedInteractive(target: EventTarget | null, currentTarget: EventTarget | null) {
  if (!(target instanceof Element) || target === currentTarget) return false;
  return Boolean(target.closest("a,button,input,select,textarea,label,[role='button'],[role='menuitem'],[data-row-action]"));
}

function SortIcon({ field, sort }: { field: string; sort?: SortState }) {
  if (!sort || sort.field !== field) {
    return <ChevronsUpDown className="ms-1 inline size-3.5 opacity-40" aria-hidden="true" />;
  }
  return sort.direction === "asc" ? (
    <ChevronUp className="ms-1 inline size-3.5 text-primary" aria-hidden="true" />
  ) : (
    <ChevronDown className="ms-1 inline size-3.5 text-primary" aria-hidden="true" />
  );
}

function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="mobile-scroll-x">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: cols }, (_, index) => (
                <TableHead key={index}><Skeleton className="h-4 w-20" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, rowIndex) => (
              <TableRow key={rowIndex}>
                {Array.from({ length: cols }, (_, columnIndex) => (
                  <TableCell key={columnIndex}><Skeleton className="h-10 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function PaginationBar({ pagination }: { pagination: PaginationState }) {
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const { page, onPageChange } = pagination;
  return (
    <nav className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between" aria-label="ترقيم الصفحات">
      <span>
        الصفحة {page} من {totalPages}
        {pagination.total > 0 ? <span className="ms-2 text-xs opacity-60">({pagination.total} سجل)</span> : null}
      </span>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} aria-label="الصفحة السابقة">السابق</Button>
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))} aria-label="الصفحة التالية">التالي</Button>
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
      action={<Button onClick={() => pagination.onPageChange(1)}><ListRestart className="me-2 size-4" aria-hidden="true" />العودة إلى الصفحة الأولى</Button>}
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
  onExpandedRowChange,
  "aria-label": ariaLabel,
  className,
  skeletonRows = 5,
}: EntityTableProps<T>) {
  const disclosurePrefix = useId();
  const [internalExpandedRowId, setInternalExpandedRowId] = useState<string | null>(null);
  const resolvedColumns = resolveColumns(columns);
  const disclosedColumns = resolvedColumns.filter((column) => column.resolvedPriority === "secondary" || column.resolvedPriority === "detail");
  const hasResponsiveDisclosure = disclosedColumns.length > 0;
  const hasCustomExpansion = renderRowExpansion !== undefined;
  const hasExpansion = hasResponsiveDisclosure || hasCustomExpansion;
  const resolvedExpandedRowId = expandedRowId === undefined ? internalExpandedRowId : expandedRowId;

  const setExpanded = (rowId: string | null) => {
    if (expandedRowId === undefined) setInternalExpandedRowId(rowId);
    onExpandedRowChange?.(rowId);
  };

  if (isLoading) return <div className={cn("space-y-4", className)}><TableSkeleton rows={skeletonRows} cols={columns.length} /></div>;
  if (error != null) {
    return <DataErrorScreen title={errorTitle} error={error} fallbackMessage={error instanceof Error ? error.message : undefined} action={onRetry ? <Button onClick={onRetry}>إعادة المحاولة</Button> : undefined} />;
  }
  if (rows.length === 0) {
    if (pagination && pagination.total > 0 && pagination.page > 1) return <PaginationRecovery pagination={pagination} />;
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  function handleSort(field: string) {
    if (!onSort) return;
    const nextDirection: SortDirection = sort?.field === field && sort.direction === "asc" ? "desc" : "asc";
    onSort(field, nextDirection);
  }

  const activateRow = (row: T, event: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>) => {
    if (!onRowClick || isNestedInteractive(event.target, event.currentTarget)) return;
    if ("key" in event && event.key !== "Enter" && event.key !== " ") return;
    if ("key" in event) event.preventDefault();
    onRowClick(row);
  };

  const colSpan = resolvedColumns.length + (hasExpansion ? 1 : 0);

  return (
    <div className={cn("space-y-4", className)}>
      <Card data-entity-table-wrapper data-compact-responsive-table className="overflow-hidden rounded-[1.5rem] border-border/70 bg-card shadow-card">
        <div
          data-entity-table-scroll
          tabIndex={0}
          role="region"
          aria-label={`${ariaLabel} — منطقة جدول قابلة للتمرير أفقياً عند الحاجة`}
          className="mobile-scroll-x overscroll-x-contain focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
        >
          <Table data-entity-table density="compact" aria-label={ariaLabel} className="min-w-[38rem] text-xs sm:min-w-full sm:text-sm">
            <TableHeader>
              <TableRow>
                {hasExpansion ? <TableHead className="w-12 bg-card"><span className="sr-only">تفاصيل الصف</span></TableHead> : null}
                {resolvedColumns.map((column) => {
                  const sortDirection = column.sortable && sort?.field === column.key
                    ? (sort.direction === "asc" ? "ascending" : "descending")
                    : undefined;
                  return (
                    <TableHead
                      key={column.key}
                      data-column-priority={column.resolvedPriority}
                      className={cn(priorityClass(column.resolvedPriority, column.sticky !== false), column.className)}
                      aria-sort={sortDirection}
                    >
                      {column.sortable && onSort ? (
                        <button type="button" className="inline-flex min-h-11 cursor-pointer items-center font-semibold hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" onClick={() => handleSort(column.key)}>
                          {column.header}<SortIcon field={column.key} sort={sort} />
                        </button>
                      ) : column.header}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const rowKey = keyOf(row);
                const isExpanded = resolvedExpandedRowId === rowKey;
                const detailId = `${disclosurePrefix}-${rowKey}`;
                return (
                  <Fragment key={rowKey}>
                    <TableRow
                      onClick={onRowClick ? (event) => activateRow(row, event) : undefined}
                      onKeyDown={onRowClick ? (event) => activateRow(row, event) : undefined}
                      className={cn(onRowClick && "cursor-pointer focus-visible:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35")}
                      tabIndex={onRowClick ? 0 : undefined}
                      aria-expanded={hasExpansion ? isExpanded : undefined}
                    >
                      {hasExpansion ? (
                        <TableCell className="w-12 bg-card" data-row-action>
                          <button
                            type="button"
                            className={cn("grid size-11 place-items-center rounded-xl text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/25", hasCustomExpansion ? "" : "sm:hidden")}
                            aria-label={isExpanded ? "إخفاء تفاصيل الصف" : "عرض كل تفاصيل الصف"}
                            aria-expanded={isExpanded}
                            aria-controls={detailId}
                            onClick={() => setExpanded(isExpanded ? null : rowKey)}
                          >
                            {isExpanded ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
                          </button>
                        </TableCell>
                      ) : null}
                      {resolvedColumns.map((column) => (
                        <TableCell
                          key={column.key}
                          data-column-priority={column.resolvedPriority}
                          className={cn(priorityClass(column.resolvedPriority, column.sticky !== false), column.className)}
                        >
                          {column.render(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                    {hasExpansion && isExpanded ? (
                      <TableRow id={detailId} data-row-disclosure>
                        <TableCell colSpan={colSpan} className="bg-muted/30 p-4">
                          {hasResponsiveDisclosure ? (
                            <dl className={cn("grid gap-3 sm:hidden", disclosedColumns.length > 1 && "grid-cols-2")}>
                              {disclosedColumns.map((column) => (
                                <div key={column.key} className="min-w-0 rounded-xl border border-border/70 bg-card p-3">
                                  <dt className="text-[11px] font-bold text-muted-foreground">{column.header}</dt>
                                  <dd className="mt-1 min-w-0 text-sm font-semibold">{column.render(row)}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                          {hasCustomExpansion ? <div className={cn(hasResponsiveDisclosure && "mt-3")}>{renderRowExpansion(row)}</div> : null}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
      {pagination ? <PaginationBar pagination={pagination} /> : null}
    </div>
  );
}

export const CompactResponsiveTable = EntityTable;
