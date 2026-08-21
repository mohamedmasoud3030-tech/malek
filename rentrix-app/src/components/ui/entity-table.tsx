/**
 * EntityTable — the canonical MALEK data-register foundation (UX-001 / UX-008).
 *
 * The component owns the visual table contract for every entity register:
 * dense grid rhythm, sticky identity/actions, sortable headers, row expansion,
 * loading/error/empty states, pagination and optional row selection. Pages only
 * provide columns/data/actions; they do not build parallel table systems.
 *
 * Every viewport renders the same semantic data grid. On narrow screens the
 * grid is intentionally horizontally scrollable, so every configured column
 * stays available just like an operational database console; the identity and
 * actions columns remain sticky while the middle columns move.
 */

import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ListRestart,
  MoreHorizontal,
} from 'lucide-react';
import {
  Fragment,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataErrorScreen } from '@/components/data-error-screen';
import { EmptyState } from '@/components/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type ColumnPriority = 'identity' | 'primary' | 'secondary' | 'detail' | 'actions';

export interface ColumnDef<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  /** Controls mobile ordering/datum selection and sticky behavior. */
  priority?: ColumnPriority;
  /** Identity/actions columns are sticky on the desktop table by default; set false for an exception. */
  sticky?: boolean;
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

export interface RowSelectionState {
  selectedIds: readonly string[];
  onChange: (selectedIds: string[]) => void;
  ariaLabel?: string;
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
  /** Optional shared toolbar content rendered inside the register chrome. */
  toolbar?: ReactNode;
  /** Optional row-selection contract. Selection remains page-owned; presentation is shared here. */
  rowSelection?: RowSelectionState;
  /** Optional visible column keys. Omit to show every configured column. */
  visibleColumnKeys?: readonly string[];
  /**
   * Designate ONE high-value secondary/detail column (e.g. amount, status,
   * date, outstanding balance) as the datum shown on each mobile row. When
   * unset the first primary column after identity is used, then the first
   * secondary/detail column. Ignored for identity/primary/actions columns.
   */
  mobileVisibleSecondaryKey?: string;
  /** @deprecated Registers always render the shared mobile register; page-supplied cards are not used. */
  renderMobileCard?: (row: T) => ReactNode;
  /** @deprecated View switching was removed from dense registers. */
  enableViewModeToggle?: boolean;
  /** @deprecated Kept only for source compatibility. */
  viewModeStorageKey?: string;
  'aria-label': string;
  className?: string;
  skeletonRows?: number;
}

type ResolvedColumn<T> = ColumnDef<T> & { resolvedPriority: ColumnPriority };

function resolveColumns<T>(columns: ColumnDef<T>[], visibleColumnKeys?: readonly string[]): ResolvedColumn<T>[] {
  const visible = visibleColumnKeys ? new Set(visibleColumnKeys) : null;
  return columns
    .filter((column) => !visible || visible.has(column.key))
    .map((column, index) => {
      let resolvedPriority = column.priority;
      if (!resolvedPriority) {
        if (/action|إجراء/i.test(column.key)) resolvedPriority = 'actions';
        else if (index === 0) resolvedPriority = 'identity';
        else if (index <= 2) resolvedPriority = 'primary';
        else resolvedPriority = 'secondary';
      }
      return { ...column, resolvedPriority };
    });
}

function priorityClass(priority: ColumnPriority, sticky = true) {
  return cn(
    sticky && priority === 'identity' && 'sticky start-0 z-[2] min-w-[10rem] bg-inherit shadow-[1px_0_0_hsl(var(--border)/0.72)]',
    sticky && priority === 'actions' && 'sticky end-0 z-[2] min-w-[6.75rem] bg-inherit shadow-[-1px_0_0_hsl(var(--border)/0.72)]',
  );
}

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
    columns.find((column) => column.resolvedPriority === 'primary' && column !== identityColumn)
    ?? columns.find((column) => (column.resolvedPriority === 'secondary' || column.resolvedPriority === 'detail') && column !== identityColumn)
    ?? undefined
  );
}

/** Best-effort visible text of a cell render, used for accessible per-row action labels. */
function nodeToText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join(' ').trim();
  if (typeof node === 'object' && 'props' in node) {
    return nodeToText((node as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

function isNestedInteractive(target: EventTarget | null, currentTarget: EventTarget | null) {
  if (!(target instanceof Element) || target === currentTarget) return false;
  return Boolean(target.closest("a,button,input,select,textarea,label,[role='button'],[role='menuitem'],[data-row-action]"));
}

function SortIcon({ field, sort }: { field: string; sort?: SortState }) {
  if (!sort || sort.field !== field) {
    return <ChevronsUpDown className="ms-1 inline size-3.5 opacity-35" aria-hidden="true" />;
  }
  return sort.direction === 'asc' ? (
    <ChevronUp className="ms-1 inline size-3.5 text-primary" aria-hidden="true" />
  ) : (
    <ChevronDown className="ms-1 inline size-3.5 text-primary" aria-hidden="true" />
  );
}

function SelectionCheckbox({
  checked,
  mixed = false,
  label,
  onChange,
}: Readonly<{
  checked: boolean;
  mixed?: boolean;
  label: string;
  onChange: () => void;
}>) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(node) => {
        if (node) node.indeterminate = mixed;
      }}
      onChange={onChange}
      onClick={(event) => event.stopPropagation()}
      aria-label={label}
      className="size-4 rounded border-border accent-primary outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      data-row-action
    />
  );
}

function TableSkeleton({ rows, cols, hasSelection }: { rows: number; cols: number; hasSelection: boolean }) {
  const totalColumns = cols + (hasSelection ? 1 : 0);
  return (
    <Card className="overflow-hidden rounded-2xl border-border/85 bg-card shadow-[0_12px_28px_-26px_hsl(var(--foreground)/0.45)]" data-entity-table-grid>
      <div className="mobile-scroll-x">
        <Table density="compact" className="text-xs [&_td+td]:border-s [&_td+td]:border-border/60 [&_th+th]:border-s [&_th+th]:border-border/70">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {Array.from({ length: totalColumns }, (_, index) => (
                <TableHead key={index} className="h-11 bg-muted/35 px-3"><Skeleton className="h-3.5 w-20" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, rowIndex) => (
              <TableRow key={rowIndex} className="hover:bg-transparent">
                {Array.from({ length: totalColumns }, (_, columnIndex) => (
                  <TableCell key={columnIndex} className="h-12 px-3 py-2.5"><Skeleton className="h-4 w-full" /></TableCell>
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
    <nav
      className="flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-medium text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
      aria-label="ترقيم الصفحات"
    >
      <span>
        الصفحة <strong className="font-black text-foreground">{page}</strong> من {totalPages}
        {pagination.total > 0 ? <span className="ms-2 opacity-70">· {pagination.total} سجل</span> : null}
      </span>
      <div className="grid grid-cols-2 gap-1.5 sm:flex">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} aria-label="الصفحة السابقة">السابق</Button>
        <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))} aria-label="الصفحة التالية">التالي</Button>
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
  gridTemplateColumns,
  isSelected,
  onToggleSelected,
}: Readonly<{
  row: T;
  rowKey: string;
  idPrefix: string;
  ariaLabel: string;
  identityColumn: ResolvedColumn<T>;
  datumColumn: ResolvedColumn<T> | undefined;
  actionsColumn: ResolvedColumn<T> | undefined;
  onRowClick?: (row: T) => void;
  gridTemplateColumns: string;
  isSelected: boolean;
  onToggleSelected?: () => void;
}>) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = `${idPrefix}-actions-${rowKey}`;
  const rowLabel = nodeToText(identityColumn.render(row)).trim();

  return (
    <li role="listitem" className="min-w-0">
      <article
        data-entity-table-mobile-card
        data-selected={isSelected ? 'true' : undefined}
        className="min-w-0 bg-card transition-colors data-[selected=true]:bg-primary/[0.045]"
      >
        <div className="grid min-h-14 items-stretch" style={{ gridTemplateColumns: gridTemplateColumns }}>
          {onToggleSelected ? (
            <div className="grid min-h-11 place-items-center border-e border-border/55">
              <SelectionCheckbox
                checked={isSelected}
                label={rowLabel ? `تحديد ${rowLabel}` : `تحديد سجل من ${ariaLabel}`}
                onChange={onToggleSelected}
              />
            </div>
          ) : null}

          <div className="min-w-0 px-3 py-2">
            {onRowClick ? (
              <button
                type="button"
                data-entity-table-mobile-primary
                onClick={() => onRowClick(row)}
                className="block min-h-11 w-full min-w-0 text-start text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              >
                <span className="block min-w-0 truncate">{identityColumn.render(row)}</span>
              </button>
            ) : (
              <div className="flex min-h-11 min-w-0 items-center text-sm font-semibold">
                <span className="min-w-0 truncate">{identityColumn.render(row)}</span>
              </div>
            )}
          </div>

          {datumColumn ? (
            <dl className="flex min-w-0 items-center border-s border-border/55 px-3 py-2" data-entity-table-mobile-datum>
              <div className="min-w-0">
                <dt className="sr-only">{datumColumn.header}</dt>
                <dd className="min-w-0 truncate text-xs font-semibold text-foreground/85">{datumColumn.render(row)}</dd>
              </div>
            </dl>
          ) : null}

          {actionsColumn ? (
            <div className="grid min-h-11 place-items-center border-s border-border/55">
              <button
                ref={triggerRef}
                type="button"
                data-entity-table-mobile-actions
                aria-label={rowLabel ? `إجراءات ${rowLabel}` : `إجراءات ${ariaLabel}`}
                aria-expanded={actionsOpen}
                aria-controls={actionsOpen ? panelId : undefined}
                onClick={() => setActionsOpen((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && actionsOpen) {
                    event.preventDefault();
                    setActionsOpen(false);
                    triggerRef.current?.focus();
                  }
                }}
                className="grid size-11 place-items-center rounded-lg text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/20"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
                <span className="sr-only">إجراءات</span>
              </button>
            </div>
          ) : null}
        </div>

        {actionsColumn && actionsOpen ? (
          <div
            id={panelId}
            data-entity-table-mobile-actions-panel
            className="min-w-0 border-t border-border/60 bg-muted/20 p-2.5 [&>div]:flex-wrap"
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
  onExpandedRowChange,
  toolbar,
  rowSelection,
  visibleColumnKeys,
  mobileVisibleSecondaryKey,
  'aria-label': ariaLabel,
  className,
  skeletonRows = 5,
}: EntityTableProps<T>) {
  const disclosurePrefix = useId();
  const [internalExpandedRows, setInternalExpandedRows] = useState<Set<string>>(() => new Set());
  const isControlledSingle = expandedRowId !== undefined;
  const resolvedColumns = useMemo(
    () => resolveColumns(columns, visibleColumnKeys),
    [columns, visibleColumnKeys],
  );
  const hasExpansion = renderRowExpansion !== undefined;
  const resolvedExpandedRowId = expandedRowId === undefined ? null : expandedRowId;
  const selectedSet = useMemo(() => new Set(rowSelection?.selectedIds ?? []), [rowSelection?.selectedIds]);

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

  const toggleSelected = (rowKey: string) => {
    if (!rowSelection) return;
    const next = new Set(selectedSet);
    if (next.has(rowKey)) next.delete(rowKey);
    else next.add(rowKey);
    rowSelection.onChange([...next]);
  };

  const currentPageIds = rows.map(keyOf);
  const selectedOnPage = currentPageIds.filter((id) => selectedSet.has(id)).length;
  const allCurrentSelected = currentPageIds.length > 0 && selectedOnPage === currentPageIds.length;
  const someCurrentSelected = selectedOnPage > 0 && !allCurrentSelected;

  const toggleSelectCurrentPage = () => {
    if (!rowSelection) return;
    const next = new Set(selectedSet);
    if (allCurrentSelected) currentPageIds.forEach((id) => next.delete(id));
    else currentPageIds.forEach((id) => next.add(id));
    rowSelection.onChange([...next]);
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-2.5', className)} data-entity-table-register>
        <div>
          <TableSkeleton rows={skeletonRows} cols={resolvedColumns.length || columns.length} hasSelection={Boolean(rowSelection)} />
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
    const nextDirection: SortDirection = sort?.field === field && sort.direction === 'asc' ? 'desc' : 'asc';
    onSort(field, nextDirection);
  }

  const activateRow = (row: T, event: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>) => {
    if (!onRowClick || isNestedInteractive(event.target, event.currentTarget)) return;
    if ('key' in event && event.key !== 'Enter' && event.key !== ' ') return;
    if ('key' in event) event.preventDefault();
    onRowClick(row);
  };

  const identityColumn = resolvedColumns.find((column) => column.resolvedPriority === 'identity') ?? resolvedColumns[0];
  if (!identityColumn) return null;
  const datumColumn = selectMobileDatum(resolvedColumns, identityColumn, mobileVisibleSecondaryKey);
  const actionsColumn = resolvedColumns.find((column) => column.resolvedPriority === 'actions');
  const colSpan = resolvedColumns.length + (hasExpansion ? 1 : 0) + (rowSelection ? 1 : 0);
  const mobileGridTemplate = [
    rowSelection ? '2.75rem' : null,
    'minmax(0,1fr)',
    datumColumn ? 'minmax(6.5rem,0.72fr)' : null,
    actionsColumn ? '3rem' : null,
  ].filter(Boolean).join(' ');

  return (
    <div className={cn('space-y-3', className)}>
      {toolbar ? (
        <div
          data-entity-table-toolbar
          className="rounded-2xl border border-border/85 bg-card p-2 shadow-[0_10px_22px_-22px_hsl(var(--foreground)/0.42)]"
        >
          {toolbar}
        </div>
      ) : null}

      <div className="hidden" data-entity-table-mobile aria-hidden="true">
        <div className="overflow-hidden rounded-2xl border border-border/85 bg-card shadow-[0_10px_24px_-22px_hsl(var(--foreground)/0.45)]">
          <div
            data-entity-table-mobile-header
            className="grid min-h-10 items-stretch border-b border-border/70 bg-muted/35 text-[10px] font-black text-muted-foreground"
            style={{ gridTemplateColumns: mobileGridTemplate }}
            aria-hidden="true"
          >
            {rowSelection ? (
              <div className="grid place-items-center border-e border-border/55 px-2">
                <SelectionCheckbox
                  checked={allCurrentSelected}
                  mixed={someCurrentSelected}
                  label={rowSelection.ariaLabel ?? `تحديد سجلات ${ariaLabel}`}
                  onChange={toggleSelectCurrentPage}
                />
              </div>
            ) : null}
            <div className="flex items-center px-3">{identityColumn.header}</div>
            {datumColumn ? <div className="flex items-center border-s border-border/55 px-3">{datumColumn.header}</div> : null}
            {actionsColumn ? <div className="border-s border-border/55" /> : null}
          </div>

          <ul role="list" aria-label={ariaLabel} className="divide-y divide-border/65" data-entity-table-mobile-list>
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
                  gridTemplateColumns={mobileGridTemplate}
                  isSelected={selectedSet.has(rowKey)}
                  onToggleSelected={rowSelection ? () => toggleSelected(rowKey) : undefined}
                />
              );
            })}
          </ul>
        </div>
      </div>

      <div className="block">
        <Card data-entity-table-wrapper data-compact-responsive-table data-entity-table-grid className="overflow-hidden rounded-2xl border-border/85 bg-card shadow-[0_12px_28px_-26px_hsl(var(--foreground)/0.45)]">
          <div
            data-entity-table-scroll
            tabIndex={0}
            role="region"
            aria-label={`${ariaLabel} — منطقة جدول قابلة للتمرير أفقياً عند الحاجة`}
            className="mobile-scroll-x overscroll-x-contain touch-pan-x focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <Table
              data-entity-table
              density="compact"
              aria-label={ariaLabel}
              className="min-w-max text-xs md:min-w-full md:text-[13px] [&_td+td]:border-s [&_td+td]:border-border/60 [&_th+th]:border-s [&_th+th]:border-border/70"
            >
              <TableHeader className="bg-muted/35">
                <TableRow className="hover:bg-transparent">
                  {rowSelection ? (
                    <TableHead className="w-11 bg-muted/35 px-3 text-center">
                      <SelectionCheckbox
                        checked={allCurrentSelected}
                        mixed={someCurrentSelected}
                        label={rowSelection.ariaLabel ?? `تحديد سجلات ${ariaLabel}`}
                        onChange={toggleSelectCurrentPage}
                      />
                    </TableHead>
                  ) : null}
                  {hasExpansion ? <TableHead className="w-11 bg-muted/35 px-2"><span className="sr-only">تفاصيل الصف</span></TableHead> : null}
                  {resolvedColumns.map((column) => {
                    const sortDirection = column.sortable && sort?.field === column.key
                      ? (sort.direction === 'asc' ? 'ascending' : 'descending')
                      : undefined;
                    return (
                      <TableHead
                        key={column.key}
                        data-column-priority={column.resolvedPriority}
                        className={cn(
                          'h-10 bg-muted/50 px-3 text-[10px] font-black tracking-[0.01em] text-muted-foreground sm:px-3.5',
                          priorityClass(column.resolvedPriority, column.sticky !== false),
                          column.className,
                        )}
                        aria-sort={sortDirection}
                      >
                        {column.sortable && onSort ? (
                          <button
                            type="button"
                            className="inline-flex min-h-10 cursor-pointer items-center font-black text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/25"
                            onClick={() => handleSort(column.key)}
                          >
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
                  const isSelected = selectedSet.has(rowKey);
                  const detailId = `${disclosurePrefix}-${rowKey}`;
                  return (
                    <Fragment key={rowKey}>
                      <TableRow
                        selected={isSelected}
                        onClick={onRowClick ? (event) => activateRow(row, event) : undefined}
                        onKeyDown={onRowClick ? (event) => activateRow(row, event) : undefined}
                        className={cn(
                          'min-h-11 bg-card hover:bg-muted/45',
                          onRowClick && 'cursor-pointer focus-visible:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35',
                        )}
                        tabIndex={onRowClick ? 0 : undefined}
                        aria-expanded={hasExpansion ? isExpanded : undefined}
                      >
                        {rowSelection ? (
                          <TableCell className="w-11 px-3 text-center" data-row-action>
                            <SelectionCheckbox
                              checked={isSelected}
                              label={`تحديد ${nodeToText(identityColumn.render(row)).trim() || 'السجل'}`}
                              onChange={() => toggleSelected(rowKey)}
                            />
                          </TableCell>
                        ) : null}
                        {hasExpansion ? (
                          <TableCell className="w-11 px-2" data-row-action>
                            <button
                              type="button"
                              className="grid size-10 place-items-center rounded-lg text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/20"
                              aria-label={isExpanded ? 'إخفاء تفاصيل الصف' : 'عرض كل تفاصيل الصف'}
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
                            className={cn(
                              'h-11 px-3 py-2 align-middle sm:px-3.5',
                              priorityClass(column.resolvedPriority, column.sticky !== false),
                              column.className,
                            )}
                          >
                            {column.render(row)}
                          </TableCell>
                        ))}
                      </TableRow>
                      {hasExpansion && isExpanded ? (
                        <TableRow id={detailId} data-row-disclosure className="hover:bg-transparent">
                          <TableCell colSpan={colSpan} className="border-s-0 bg-muted/20 p-4">
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
