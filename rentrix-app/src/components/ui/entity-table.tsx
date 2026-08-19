/**
 * EntityTable — the single responsive register foundation (UX-001 / UX-008).
 *
 * Desktop/tablet (>= 768px): the semantic dense table with sortable headers,
 * sticky identity/actions columns and optional custom row expansion. This is
 * the existing operational table behavior and it is unchanged.
 *
 * Mobile (< 768px): a true shared register presentation — each record becomes
 * a card showing identity, ONE meaningful datum (status/amount/date — driven
 * by the existing column metadata), and a compact accessible «إجراءات» menu
 * containing only the actions already available for that record. There is no
 * horizontal scrolling, no clipped/overlapping RTL content, no disclosure or
 * expansion rows, no sticky action columns and no «توسيع الكل» on mobile.
 *
 * Pages configure columns (and may designate the mobile datum via
 * `mobileVisibleSecondaryKey`); they never implement their own mobile layout.
 */

import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ListRestart,
  MoreHorizontal,
} from "lucide-react";
import {
  Fragment,
  useId,
  useRef,
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
  /** Controls mobile-card ordering/datum selection and sticky behavior. */
  priority?: ColumnPriority;
  /** Identity/actions columns are sticky on the desktop table by default; set false for an exception. */
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
  /**
   * Designate ONE high-value secondary/detail column (e.g. amount, status,
   * date, outstanding balance) as the datum shown on each mobile card. When
   * unset the first primary column after identity is used, then the first
   * secondary/detail column. Ignored for identity/primary/actions columns.
   */
  mobileVisibleSecondaryKey?: string;
  /** @deprecated Registers always render the shared mobile card register; page-supplied cards are not used. */
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
    sticky && priority === "identity" && "sticky start-0 z-[2] min-w-[10rem] bg-card shadow-[1px_0_0_hsl(var(--border))]",
    sticky && priority === "actions" && "sticky end-0 z-[2] min-w-[7rem] bg-card shadow-[-1px_0_0_hsl(var(--border))]",
  );
}

/**
 * The single datum shown on each mobile card: the explicitly designated
 * `mobileVisibleSecondaryKey` column, else the first primary column after
 * identity, else the first secondary/detail column.
 */
function selectMobileDatum<T>(
  columns: ResolvedColumn<T>[],
  identityColumn: ResolvedColumn<T> | undefined,
  mobileVisibleSecondaryKey?: string,
): ResolvedColumn<T> | undefined {
  if (mobileVisibleSecondaryKey) {
    const designated = columns.find((column) => column.key === mobileVisibleSecondaryKey);
    if (designated && designated !== identityColumn) return designated;
  }
  return (
    columns.find((column) => column.resolvedPriority === "primary" && column !== identityColumn)
    ?? columns.find((column) => (column.resolvedPriority === "secondary" || column.resolvedPriority === "detail") && column !== identityColumn)
    ?? undefined
  );
}

/** Best-effort visible text of a cell render, used for accessible per-row action labels. */
function nodeToText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join(" ").trim();
  if (typeof node === "object" && "props" in node) {
    return nodeToText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
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

function MobileRegisterSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3" aria-hidden="true" data-entity-table-mobile-skeleton>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-xl border border-border/70 bg-card p-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="size-11 shrink-0 rounded-xl" />
          </div>
          <Skeleton className="mt-3 h-12 w-full rounded-xl" />
        </div>
      ))}
    </div>
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

function MobileRegisterListItem<T>({
  row,
  rowKey,
  idPrefix,
  ariaLabel,
  identityColumn,
  datumColumn,
  actionsColumn,
  onRowClick,
}: Readonly<{
  row: T;
  rowKey: string;
  idPrefix: string;
  ariaLabel: string;
  identityColumn: ResolvedColumn<T>;
  datumColumn: ResolvedColumn<T> | undefined;
  actionsColumn: ResolvedColumn<T> | undefined;
  onRowClick?: (row: T) => void;
}>) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = `${idPrefix}-actions-${rowKey}`;
  const rowLabel = nodeToText(identityColumn.render(row)).trim();

  return (
    <li role="listitem" className="min-w-0">
      <article data-entity-table-mobile-card className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card p-3 shadow-card">
        <div className="flex min-w-0 items-start gap-3">
          <div className="min-w-0 flex-1">
            {onRowClick ? (
              <button
                type="button"
                data-entity-table-mobile-primary
                onClick={() => onRowClick(row)}
                className="block min-h-11 w-full rounded-xl text-start outline-none focus-visible:ring-4 focus-visible:ring-primary/25"
              >
                {identityColumn.render(row)}
              </button>
            ) : (
              <div className="flex min-h-11 items-center">{identityColumn.render(row)}</div>
            )}
            {datumColumn ? (
              <dl className="mt-1 rounded-xl bg-muted/40 px-3 py-2" data-entity-table-mobile-datum>
                <dt className="text-[10px] font-bold text-muted-foreground">{datumColumn.header}</dt>
                <dd className="mt-0.5 min-w-0 text-sm font-bold leading-5">{datumColumn.render(row)}</dd>
              </dl>
            ) : null}
          </div>
          {actionsColumn ? (
            <button
              ref={triggerRef}
              type="button"
              data-entity-table-mobile-actions
              aria-label={rowLabel ? `إجراءات ${rowLabel}` : `إجراءات ${ariaLabel}`}
              aria-expanded={actionsOpen}
              aria-controls={actionsOpen ? panelId : undefined}
              onClick={() => setActionsOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && actionsOpen) {
                  event.preventDefault();
                  setActionsOpen(false);
                  triggerRef.current?.focus();
                }
              }}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 text-xs font-bold text-foreground/85 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25"
            >
              <MoreHorizontal className="size-4 shrink-0" aria-hidden="true" />
              <span>إجراءات</span>
            </button>
          ) : null}
        </div>
        {actionsColumn && actionsOpen ? (
          <div
            id={panelId}
            data-entity-table-mobile-actions-panel
            className="mt-2 min-w-0 rounded-xl border border-border/70 bg-muted/25 p-2 [&>div]:flex-wrap"
          >
            {actionsColumn.render(row)}
          </div>
        ) : null}
      </article>
    </li>
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
  mobileVisibleSecondaryKey,
  "aria-label": ariaLabel,
  className,
  skeletonRows = 5,
}: EntityTableProps<T>) {
  const disclosurePrefix = useId();
  // Uncontrolled mode keeps the legacy multi-row expansion contract; controlled
  // mode (expandedRowId) preserves the single-row contract unchanged.
  const [internalExpandedRows, setInternalExpandedRows] = useState<Set<string>>(() => new Set());
  const isControlledSingle = expandedRowId !== undefined;
  const resolvedColumns = resolveColumns(columns);
  const hasCustomExpansion = renderRowExpansion !== undefined;
  const hasExpansion = hasCustomExpansion;
  const resolvedExpandedRowId = expandedRowId === undefined ? null : expandedRowId;

  const isRowExpanded = (rowKey: string) =>
    isControlledSingle ? resolvedExpandedRowId === rowKey : internalExpandedRows.has(rowKey);

  const toggleRow = (rowKey: string) => {
    if (isControlledSingle) {
      onExpandedRowChange?.(resolvedExpandedRowId === rowKey ? null : rowKey);
      return;
    }
    setInternalExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
    onExpandedRowChange?.(rowKey);
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="hidden md:block">
          <TableSkeleton rows={skeletonRows} cols={columns.length} />
        </div>
        <div className="md:hidden">
          <MobileRegisterSkeleton rows={skeletonRows} />
        </div>
      </div>
    );
  }
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

  const identityColumn = resolvedColumns.find((column) => column.resolvedPriority === "identity") ?? resolvedColumns[0];
  if (!identityColumn) return null;
  const datumColumn = selectMobileDatum(resolvedColumns, identityColumn, mobileVisibleSecondaryKey);
  const actionsColumn = resolvedColumns.find((column) => column.resolvedPriority === "actions");
  const colSpan = resolvedColumns.length + (hasExpansion ? 1 : 0);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Mobile register presentation — widths <= 767px */}
      <div className="md:hidden" data-entity-table-mobile>
        <ul role="list" aria-label={ariaLabel} className="space-y-3" data-entity-table-mobile-list>
          {rows.map((row) => {
            const rowKey = keyOf(row);
            return (
              <MobileRegisterListItem
                key={rowKey}
                row={row}
                rowKey={rowKey}
                idPrefix={disclosurePrefix}
                ariaLabel={ariaLabel}
                identityColumn={identityColumn}
                datumColumn={datumColumn}
                actionsColumn={actionsColumn}
                onRowClick={onRowClick}
              />
            );
          })}
        </ul>
      </div>

      {/* Desktop/tablet dense register table — widths >= 768px */}
      <div className="hidden md:block">
        <Card data-entity-table-wrapper data-compact-responsive-table className="overflow-hidden rounded-xl border-border/70 bg-card shadow-card">
          <div
            data-entity-table-scroll
            tabIndex={0}
            role="region"
            aria-label={`${ariaLabel} — منطقة جدول قابلة للتمرير أفقياً عند الحاجة`}
            className="mobile-scroll-x overscroll-x-contain focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <Table data-entity-table density="compact" aria-label={ariaLabel} className="min-w-full text-xs md:text-sm">
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
                  const isExpanded = isRowExpanded(rowKey);
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
                              className="grid size-11 place-items-center rounded-xl text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/25"
                              aria-label={isExpanded ? "إخفاء تفاصيل الصف" : "عرض كل تفاصيل الصف"}
                              aria-expanded={isExpanded}
                              aria-controls={detailId}
                              onClick={() => toggleRow(rowKey)}
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
                            {renderRowExpansion!(row)}
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
      </div>
      {pagination ? <PaginationBar pagination={pagination} /> : null}
    </div>
  );
}

export const CompactResponsiveTable = EntityTable;
