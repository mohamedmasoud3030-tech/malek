/**
 * EntityTable — the canonical MALEK responsive data-register foundation.
 *
 * Every viewport keeps the same explicit Cards ⇄ Table choice. The selected
 * presentation is persisted so the register does not silently change the
 * user's choice between pages or reloads.
 */

import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  LayoutGrid,
  ListRestart,
  MoreHorizontal,
  TableProperties,
} from 'lucide-react';
import {
  Fragment,
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { DataErrorScreen } from '@/components/data-error-screen';
import { DataRefreshAlert } from '@/components/data-refresh-alert';
import { EmptyState } from '@/components/ui/state-surfaces';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EntityCard, type EntityCardAction, type EntityCardType } from '@/components/ui/entity-card';
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
  /** Controls mobile datum selection and desktop sticky behavior. */
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
  /** Canonical entity label/tone used by the mobile card when no badge overrides it. */
  mobileCardType?: EntityCardType | ((row: T) => EntityCardType);
  /**
   * Mobile card badge column (e.g. the status column). Rendered in the card
   * badge slot instead of the generic entity-type chip.
   */
  mobileBadgeKey?: string;
  /**
   * Ordered mobile-card quick facts. Each key must reference a configured
   * column; the column header becomes the fact label and its render the
   * value. Prefer rendering data the list query already fetched.
   */
  mobileSummaryKeys?: readonly string[];
  /**
   * Structured secondary actions for the mobile card (edit, archive, ...).
   * Rendered directly in the card action area — one flat level, no
   * intermediate "إجراءات" disclosure. Destructive actions must keep their
   * page-level confirmation dialogs.
   */
  mobileCardActions?: (row: T) => EntityCardAction[];
  /**
   * Override the mobile card primary action (e.g. navigate to the detail
   * route instead of expanding the desktop row).
   */
  mobileCardPrimaryAction?: (row: T) => EntityCardAction | undefined;
  /** Optional shared toolbar content rendered inside the register chrome. */
  toolbar?: ReactNode;
  /** Optional row-selection contract. Selection remains page-owned. */
  rowSelection?: RowSelectionState;
  /** Optional visible column keys. Omit to show every configured column. */
  visibleColumnKeys?: readonly string[];
  /** Enables the shared Cards ⇄ Table choice on every viewport. Defaults to true. */
  enableViewModeToggle?: boolean;
  /** Optional stable storage key. Omit to use the shared MALEK register preference. */
  viewModeStorageKey?: string;
  'aria-label': string;
  className?: string;
  skeletonRows?: number;
}

type ResolvedColumn<T> = ColumnDef<T> & { resolvedPriority: ColumnPriority };
type ViewMode = 'cards' | 'table';

const DEFAULT_VIEW_MODE_STORAGE_KEY = 'malek:entity-register:view-mode';

function getInitialViewMode(storageKey: string): ViewMode {
  if (typeof window === 'undefined') return 'table';
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'cards' || stored === 'table') return stored;
  } catch {
    // Storage may be unavailable in hardened/private browser contexts.
  }
  return window.matchMedia('(max-width: 767px)').matches ? 'cards' : 'table';
}

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
    sticky && priority === 'identity' && 'sticky start-0 z-[2] min-w-[9.5rem] max-w-[18rem] bg-inherit shadow-[1px_0_0_hsl(var(--border)/0.55)]',
    sticky && priority === 'actions' && 'sticky end-0 z-[2] min-w-[5.5rem] bg-inherit shadow-[-1px_0_0_hsl(var(--border)/0.55)]',
  );
}

function selectMobileDatum<T>(
  columns: ResolvedColumn<T>[],
  identityColumn: ResolvedColumn<T>,
): ResolvedColumn<T> | undefined {
  return (
    columns.find((column) => column.resolvedPriority === 'primary' && column !== identityColumn)
    ?? columns.find((column) => (column.resolvedPriority === 'secondary' || column.resolvedPriority === 'detail') && column !== identityColumn)
  );
}

/** Best-effort visible text of a cell render, used for accessible labels. */
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

const SortIcon = memo(function SortIcon({ field, sort }: { field: string; sort?: SortState }) {
  if (!sort || sort.field !== field) {
    return <ChevronsUpDown className="ms-1 inline size-3 opacity-35" aria-hidden="true" />;
  }
  return sort.direction === 'asc' ? (
    <ChevronUp className="ms-1 inline size-3 text-primary" aria-hidden="true" />
  ) : (
    <ChevronDown className="ms-1 inline size-3 text-primary" aria-hidden="true" />
  );
});

const SelectionCheckbox = memo(function SelectionCheckbox({
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
});

const DesktopTableSkeleton = memo(function DesktopTableSkeleton({ rows, cols, hasSelection }: { rows: number; cols: number; hasSelection: boolean }) {
  const totalColumns = cols + (hasSelection ? 1 : 0);
  return (
    <Card className="overflow-hidden rounded-lg border-border/60 bg-card shadow-none" data-entity-table-grid>
      <div className="mobile-scroll-x">
        <Table density="compact" className="text-[12px] [&_td+td]:border-s [&_td+td]:border-border/50 [&_th+th]:border-s [&_th+th]:border-border/60">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {Array.from({ length: totalColumns }, (_, index) => (
                <TableHead key={index} className="h-8 bg-muted/30 px-2"><Skeleton className="h-3 w-16" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, rowIndex) => (
              <TableRow key={rowIndex} className="hover:bg-transparent">
                {Array.from({ length: totalColumns }, (_, columnIndex) => (
                  <TableCell key={columnIndex} className="h-8 px-2 py-1"><Skeleton className="h-3.5 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
});

const MobileRegisterSkeleton = memo(function MobileRegisterSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-1.5" aria-hidden="true" data-entity-table-mobile-skeleton>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-lg border border-border/60 bg-card p-2 shadow-none">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-1.5 h-8 w-full rounded-lg" />
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <Skeleton className="h-9 rounded-lg" />
            <Skeleton className="h-9 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
});

const PaginationBar = memo(function PaginationBar({ pagination }: { pagination: PaginationState }) {
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  if (totalPages <= 1) return null;
  const { page, onPageChange } = pagination;
  return (
    <nav
      className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-card px-2 py-1.5 text-[11px] font-medium text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
      aria-label="ترقيم الصفحات"
    >
      <span>
        الصفحة <strong className="font-bold text-foreground">{page}</strong> من {totalPages}
        {pagination.total > 0 ? <span className="ms-2 opacity-70">· {pagination.total} سجل</span> : null}
      </span>
      <div className="grid grid-cols-2 gap-1 sm:flex">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} aria-label="الصفحة السابقة">السابق</Button>
        <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))} aria-label="الصفحة التالية">التالي</Button>
      </div>
    </nav>
  );
});

const PaginationRecovery = memo(function PaginationRecovery({ pagination }: { pagination: PaginationState }) {
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  return (
    <EmptyState
      title="هذه الصفحة لا تحتوي على نتائج"
      description={`يوجد ${pagination.total} سجل في النتائج الحالية، لكن الصفحة ${pagination.page} خارج نطاق الصفحات المتاحة (${totalPages}).`}
      action={<Button onClick={() => pagination.onPageChange(1)}><ListRestart className="me-2 size-4" aria-hidden="true" />العودة إلى الصفحة الأولى</Button>}
    />
  );
});

function MobileRegisterListItem<T>({
  row,
  rowKey,
  ariaLabel,
  identityColumn,
  datumColumn,
  cardType,
  badgeColumn,
  summaryColumns,
  actionsColumn,
  structuredActions,
  primaryAction,
  selected,
  onToggleSelected,
  onRowClick,
}: Readonly<{
  row: T;
  rowKey: string;
  ariaLabel: string;
  identityColumn: ResolvedColumn<T>;
  datumColumn?: ResolvedColumn<T>;
  cardType?: EntityCardType;
  badgeColumn?: ResolvedColumn<T>;
  summaryColumns?: ResolvedColumn<T>[];
  actionsColumn?: ResolvedColumn<T>;
  /** When provided, secondary actions render flat in the card (no disclosure). */
  structuredActions?: EntityCardAction[];
  primaryAction?: EntityCardAction;
  selected: boolean;
  onToggleSelected?: () => void;
  onRowClick?: (row: T) => void;
}>) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rowLabel = nodeToText(identityColumn.render(row)).trim() || 'السجل';
  const hasStructuredActions = structuredActions !== undefined;

  const cardActions: EntityCardAction[] = [];
  if (primaryAction ?? onRowClick) {
    cardActions.push(primaryAction ?? { label: 'فتح التفاصيل', variant: 'default', onClick: () => onRowClick!(row), ariaLabel: `فتح ${rowLabel}` });
  }
  if (onToggleSelected) {
    cardActions.push({ label: selected ? 'إلغاء التحديد' : 'تحديد السجل', variant: 'secondary', onClick: onToggleSelected, ariaLabel: `${selected ? 'إلغاء تحديد' : 'تحديد'} ${rowLabel}` });
  }
  if (hasStructuredActions) {
    cardActions.push(...(structuredActions ?? []));
  }

  const hasSummaryGrid = Boolean(summaryColumns && summaryColumns.length > 0);

  return (
    <li role="listitem" data-entity-table-mobile-card className="min-w-0">
      <EntityCard
        id={rowKey}
        name={<span data-entity-table-mobile-primary>{identityColumn.render(row)}</span>}
        type={cardType}
        supportingText={hasSummaryGrid || badgeColumn ? undefined : (datumColumn ? datumColumn.header : undefined)}
        stats={
          hasSummaryGrid
            ? (
              <dl className="grid grid-cols-2 gap-x-2 gap-y-1" data-entity-table-mobile-summary>
                {summaryColumns!.map((column) => (
                  <div key={column.key} className="min-w-0">
                    <dt className="truncate text-[10px] font-bold leading-3.5 text-muted-foreground">{column.header}</dt>
                    <dd className="line-clamp-2 break-words text-[11.5px] font-semibold leading-4 text-foreground [overflow-wrap:anywhere]" data-entity-table-mobile-datum>
                      {column.render(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            )
            : datumColumn
              ? <div data-entity-table-mobile-datum className="min-w-0 break-words text-[11.5px] font-semibold leading-4 [overflow-wrap:anywhere]">{datumColumn.render(row)}</div>
              : undefined
        }
        badge={badgeColumn ? badgeColumn.render(row) : selected ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10.5px] font-bold text-primary">محدد</span> : undefined}
        actions={cardActions.length > 0 ? cardActions : undefined}
        className={selected ? 'border-primary/35 ring-1 ring-primary/10' : undefined}
      />

      {/*
        Legacy disclosure fallback: kept only for registers that have not
        adopted structured mobile actions yet. Properties / Units / Contracts
        render their secondary actions flat inside the card above.
      */}
      {!hasStructuredActions && actionsColumn ? (
        <div className="mt-1 rounded-lg border border-border/60 bg-card p-1 shadow-none">
          <Button
            ref={triggerRef}
            type="button"
            size="sm"
            variant="secondary"
            data-entity-table-mobile-actions
            aria-label={`إجراءات ${rowLabel}`}
            aria-expanded={actionsOpen}
            aria-controls={actionsOpen ? `mobile-actions-${rowKey}` : undefined}
            onClick={() => setActionsOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && actionsOpen) {
                event.preventDefault();
                setActionsOpen(false);
                triggerRef.current?.focus();
              }
            }}
            className="w-full"
          >
            <MoreHorizontal className="size-3" aria-hidden="true" />
            إجراءات
          </Button>
          {actionsOpen ? (
            <div
              id={`mobile-actions-${rowKey}`}
              data-entity-table-mobile-actions-panel
              className="mt-1 min-w-0 rounded-md bg-muted/20 p-1 [&>div]:flex-wrap"
              aria-label={`إجراءات ${ariaLabel}`}
            >
              {actionsColumn.render(row)}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function EntityTableImpl<T>({
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
  mobileCardType,
  mobileBadgeKey,
  mobileSummaryKeys,
  mobileCardActions,
  mobileCardPrimaryAction,
  toolbar,
  rowSelection,
  visibleColumnKeys,
  enableViewModeToggle = true,
  viewModeStorageKey,
  'aria-label': ariaLabel,
  className,
  skeletonRows = 5,
}: EntityTableProps<T>) {
  const disclosurePrefix = useId();
  const storageKey = viewModeStorageKey ?? DEFAULT_VIEW_MODE_STORAGE_KEY;
  const [viewMode, setViewMode] = useState<ViewMode>(() => getInitialViewMode(storageKey));
  const [internalExpandedRows, setInternalExpandedRows] = useState<Set<string>>(() => new Set());
  const isControlledSingle = expandedRowId !== undefined;
  const resolvedColumns = useMemo(
    () => resolveColumns(columns, visibleColumnKeys),
    [columns, visibleColumnKeys],
  );
  const hasExpansion = renderRowExpansion !== undefined;
  const resolvedExpandedRowId = expandedRowId === undefined ? null : expandedRowId;
  const selectedSet = useMemo(() => new Set(rowSelection?.selectedIds ?? []), [rowSelection?.selectedIds]);

  useEffect(() => {
    setViewMode(getInitialViewMode(storageKey));
  }, [storageKey]);

  const chooseViewMode = (nextMode: ViewMode) => {
    setViewMode(nextMode);
    try {
      window.localStorage.setItem(storageKey, nextMode);
    } catch {
      // Keep the in-memory choice even when storage is unavailable.
    }
  };

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
      <div className={cn('space-y-2', className)} data-entity-table-register>
        {enableViewModeToggle ? (
          <div data-entity-table-toolbar className="flex min-h-9 items-center justify-end">
            <div className="inline-flex min-h-11 items-center rounded-lg border border-border/60 bg-muted/25 p-0.5" role="group" aria-label={`طريقة عرض ${ariaLabel}`}>
              <Button type="button" variant={viewMode === 'cards' ? 'secondary' : 'ghost'} size="sm" aria-pressed={viewMode === 'cards'} onClick={() => chooseViewMode('cards')}>
                <LayoutGrid className="size-3.5" aria-hidden="true" />
                <span className="ms-1">بطاقات</span>
              </Button>
              <Button type="button" variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="sm" aria-pressed={viewMode === 'table'} onClick={() => chooseViewMode('table')}>
                <TableProperties className="size-3.5" aria-hidden="true" />
                <span className="ms-1">جدول</span>
              </Button>
            </div>
          </div>
        ) : null}
        {viewMode === 'cards' ? (
          <MobileRegisterSkeleton rows={skeletonRows} />
        ) : (
          <DesktopTableSkeleton rows={skeletonRows} cols={resolvedColumns.length || columns.length} hasSelection={Boolean(rowSelection)} />
        )}
      </div>
    );
  }

  if (error != null && rows.length === 0) {
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
  const datumColumn = selectMobileDatum(resolvedColumns, identityColumn);
  const actionsColumn = resolvedColumns.find((column) => column.resolvedPriority === 'actions');
  const badgeColumn = mobileBadgeKey
    ? resolvedColumns.find((column) => column.key === mobileBadgeKey)
    : undefined;
  const summaryColumns = mobileSummaryKeys
    ? mobileSummaryKeys
        .map((key) => resolvedColumns.find((column) => column.key === key))
        .filter((column): column is ResolvedColumn<T> => Boolean(column))
    : resolvedColumns
        .filter((column) => column !== identityColumn && column !== badgeColumn && column.resolvedPriority !== 'actions')
        .slice(0, 2);
  const colSpan = resolvedColumns.length + (hasExpansion ? 1 : 0) + (rowSelection ? 1 : 0);

  return (
    <div className={cn('space-y-2', className)} data-entity-table-register>
      {error != null ? (
        <DataRefreshAlert
          title={errorTitle}
          description="الصفوف المعروضة من آخر تحميل مكتمل وقد لا تطابق أحدث حالة أو عوامل التصفية الحالية."
          onRetry={onRetry}
        />
      ) : null}
      <div
        className="space-y-2"
        inert={error != null ? true : undefined}
        aria-disabled={error != null ? 'true' : undefined}
        data-stale-register-content={error != null ? 'true' : undefined}
      >
      {toolbar || enableViewModeToggle ? (
        <div data-entity-table-toolbar className="flex min-h-9 flex-wrap items-center justify-end gap-1.5">
          {enableViewModeToggle ? (
            <div className="inline-flex min-h-11 items-center rounded-lg border border-border/60 bg-muted/25 p-0.5" role="group" aria-label={`طريقة عرض ${ariaLabel}`}>
              <Button type="button" variant={viewMode === 'cards' ? 'secondary' : 'ghost'} size="sm" aria-pressed={viewMode === 'cards'} onClick={() => chooseViewMode('cards')}>
                <LayoutGrid className="size-3.5" aria-hidden="true" />
                <span className="ms-1">بطاقات</span>
              </Button>
              <Button type="button" variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="sm" aria-pressed={viewMode === 'table'} onClick={() => chooseViewMode('table')}>
                <TableProperties className="size-3.5" aria-hidden="true" />
                <span className="ms-1">جدول</span>
              </Button>
            </div>
          ) : null}
          {toolbar}
        </div>
      ) : null}

      {viewMode === 'cards' ? (
        <div data-entity-table-mobile>
          <ul role="list" aria-label={ariaLabel} className="grid gap-1.5" data-entity-table-mobile-list>
            {rows.map((row) => {
              const rowKey = keyOf(row);
              const cardType = typeof mobileCardType === 'function' ? mobileCardType(row) : mobileCardType;
              return (
                <MobileRegisterListItem
                  key={rowKey}
                  row={row}
                  rowKey={rowKey}
                  ariaLabel={ariaLabel}
                  identityColumn={identityColumn}
                  datumColumn={datumColumn}
                  cardType={cardType}
                  badgeColumn={badgeColumn}
                  summaryColumns={summaryColumns}
                  actionsColumn={actionsColumn}
                  structuredActions={mobileCardActions ? mobileCardActions(row) : undefined}
                  primaryAction={mobileCardPrimaryAction ? mobileCardPrimaryAction(row) : undefined}
                  selected={selectedSet.has(rowKey)}
                  onToggleSelected={rowSelection ? () => toggleSelected(rowKey) : undefined}
                  onRowClick={onRowClick}
                />
              );
            })}
          </ul>
        </div>
      ) : (
        <div>
          <Card data-entity-table-wrapper data-compact-responsive-table data-entity-table-grid className="overflow-hidden rounded-lg border-border/60 bg-card shadow-none">
            <div
              data-entity-table-scroll
              tabIndex={0}
              role="region"
              aria-label={`${ariaLabel} — منطقة جدول قابلة للتمرير أفقياً عند الحاجة`}
              className="mobile-scroll-x overscroll-x-contain touch-pan-x focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <Table
                data-entity-table
                density="compact"
                aria-label={ariaLabel}
                className="min-w-full text-[12px] [&_td+td]:border-s [&_td+td]:border-border/35 [&_th+th]:border-s [&_th+th]:border-border/45"
              >
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    {rowSelection ? (
                      <TableHead className="w-9 bg-muted/30 px-2 text-center">
                        <SelectionCheckbox
                          checked={allCurrentSelected}
                          mixed={someCurrentSelected}
                          label={rowSelection.ariaLabel ?? `تحديد سجلات ${ariaLabel}`}
                          onChange={toggleSelectCurrentPage}
                        />
                      </TableHead>
                    ) : null}
                    {hasExpansion ? <TableHead className="w-9 bg-muted/30 px-1.5"><span className="sr-only">تفاصيل الصف</span></TableHead> : null}
                    {resolvedColumns.map((column) => {
                      const sortDirection = column.sortable && sort?.field === column.key
                        ? (sort.direction === 'asc' ? 'ascending' : 'descending')
                        : undefined;
                      return (
                        <TableHead
                          key={column.key}
                          data-column-priority={column.resolvedPriority}
                          className={cn(
                            'h-8 bg-muted/35 px-2 text-[11px] font-bold tracking-normal text-muted-foreground sm:px-2.5',
                            column.resolvedPriority === 'actions' && 'lg:w-[1%] lg:whitespace-nowrap',
                            priorityClass(column.resolvedPriority, column.sticky !== false),
                            column.className,
                          )}
                          aria-sort={sortDirection}
                        >
                          {column.sortable && onSort ? (
                            <button
                              type="button"
                              className="inline-flex min-h-11 cursor-pointer items-center font-bold text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/25"
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
                            'min-h-9 bg-card hover:bg-muted/30',
                            onRowClick && 'cursor-pointer focus-visible:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35',
                          )}
                          tabIndex={onRowClick ? 0 : undefined}
                          aria-expanded={hasExpansion ? isExpanded : undefined}
                        >
                          {rowSelection ? (
                            <TableCell className="w-9 px-2 text-center" data-row-action>
                              <SelectionCheckbox
                                checked={isSelected}
                                label={`تحديد ${nodeToText(identityColumn.render(row)).trim() || 'السجل'}`}
                                onChange={() => toggleSelected(rowKey)}
                              />
                            </TableCell>
                          ) : null}
                          {hasExpansion ? (
                            <TableCell className="w-9 px-1.5" data-row-action>
                              <button
                                type="button"
                                className="grid size-11 place-items-center rounded-md text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/20"
                                aria-label={isExpanded ? 'إخفاء تفاصيل الصف' : 'عرض كل تفاصيل الصف'}
                                aria-expanded={isExpanded}
                                aria-controls={detailId}
                                onClick={() => toggleRow(rowKey)}
                              >
                                {isExpanded ? <ChevronUp className="size-3.5" aria-hidden="true" /> : <ChevronDown className="size-3.5" aria-hidden="true" />}
                              </button>
                            </TableCell>
                          ) : null}
                          {resolvedColumns.map((column) => (
                            <TableCell
                              key={column.key}
                              data-column-priority={column.resolvedPriority}
                              className={cn(
                                'h-9 px-2 py-1.5 align-middle text-[12px] sm:px-2.5',
                                column.resolvedPriority === 'actions' && 'lg:w-[1%] lg:whitespace-nowrap [&_a]:lg:min-h-9 [&_a]:lg:px-2.5 [&_button]:lg:min-h-9 [&_button]:lg:px-2.5',
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
                            <TableCell colSpan={colSpan} className="border-s-0 bg-muted/15 p-3">
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
      )}

      {pagination ? <PaginationBar pagination={pagination} /> : null}
      </div>
    </div>
  );
}

/**
 * Memoised generic wrapper — preserves the `EntityTable<T>` call signature
 * while allowing React to skip re-renders when the row list and column
 * definitions are referentially stable.
 */
export const EntityTable = memo(EntityTableImpl) as typeof EntityTableImpl;
