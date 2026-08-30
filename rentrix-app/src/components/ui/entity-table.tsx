/**
 * EntityTable — the canonical MALEK responsive data-register foundation.
 *
 * The register keeps one data/query model while allowing the human to choose
 * how that data is presented. Phones default to cards; tablet/desktop default
 * to table. A saved choice wins afterwards, and the visible toggle is shared
 * by both surfaces.
 */

import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  LayoutGrid,
  List,
  MoreHorizontal,
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
import {
  EntityCard,
  type EntityCardAction,
  type EntityCardMetaItem,
  type EntityCardType,
} from '@/components/ui/entity-card';
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
  /** Identity/actions columns are sticky on wide desktop tables by default; set false for an exception. */
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
  /** Canonical entity label used by the mobile/card row when no badge overrides it. */
  mobileCardType?: EntityCardType | ((row: T) => EntityCardType);
  /** Card badge/status column key (e.g. status). */
  mobileBadgeKey?: string;
  /** Optional secondary identity/context line under the card title. */
  mobileSupportingKey?: string;
  /** Primary card quick facts, usually short dates/counts/amounts. */
  mobilePrimaryMetaKeys?: readonly string[];
  /** Secondary card metadata, usually contextual text. */
  mobileSecondaryMetaKeys?: readonly string[];
  /** Backward-compatible alias for legacy quick facts. */
  mobileSummaryKeys?: readonly string[];
  /** Structured secondary actions for cards. */
  mobileCardActions?: (row: T) => EntityCardAction[];
  /** Explicit card primary action (e.g. Collect). */
  mobileCardPrimaryAction?: (row: T) => EntityCardAction | undefined;
  /** Optional shared toolbar content rendered inside the register chrome. */
  toolbar?: ReactNode;
  /** Optional row-selection contract. Selection remains page-owned. */
  rowSelection?: RowSelectionState;
  /** Optional visible column keys. Omit to show every configured column. */
  visibleColumnKeys?: readonly string[];
  /** Keep the human-facing cards/table switcher visible. Defaults to true. */
  enableViewModeToggle?: boolean;
  /** Optional stable storage key; otherwise aria-label creates a per-register key. */
  viewModeStorageKey?: string;
  'aria-label': string;
  className?: string;
  skeletonRows?: number;
}

type ResolvedColumn<T> = ColumnDef<T> & { resolvedPriority: ColumnPriority };
type ViewMode = 'cards' | 'table';
type ResponsiveViewport = 'mobile' | 'tablet' | 'desktop';

function normalizeStorageKey(label: string): string {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]+/gu, '');
  return `malek:entity-register:${normalized || 'default'}:view-mode`;
}

function getStoredViewMode(storageKey: string): ViewMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'cards' || stored === 'table') return stored;
  } catch {
    // Storage may be unavailable in hardened/private browser contexts.
  }
  return null;
}

function getViewportMode(): ResponsiveViewport {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth || document.documentElement.clientWidth || 1280;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function getDefaultViewMode(viewport: ResponsiveViewport): ViewMode {
  return viewport === 'mobile' ? 'cards' : 'table';
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

function resolveTabletColumns<T>(columns: ResolvedColumn<T>[]): ResolvedColumn<T>[] {
  const withoutDetails = columns.filter((column) => column.resolvedPriority !== 'detail');
  const stableColumns = withoutDetails.filter((column) => column.resolvedPriority !== 'secondary');
  const secondaryColumns = withoutDetails.filter((column) => column.resolvedPriority === 'secondary');
  const limitedSecondaryColumns = secondaryColumns.slice(0, stableColumns.length <= 4 ? 2 : 1);
  const visibleKeys = new Set([
    ...stableColumns.map((column) => column.key),
    ...limitedSecondaryColumns.map((column) => column.key),
  ]);
  const tabletColumns = withoutDetails.filter((column) => visibleKeys.has(column.key));
  return tabletColumns.length > 0 ? tabletColumns : columns;
}

function priorityClass(priority: ColumnPriority, sticky = true) {
  return cn(
    priority === 'identity' && 'min-w-[13rem]',
    priority === 'actions' && 'w-[1%] whitespace-nowrap',
    sticky && priority === 'identity' && 'xl:sticky xl:start-0 xl:z-[2] xl:bg-inherit xl:shadow-[1px_0_0_hsl(var(--border)/0.45)]',
    sticky && priority === 'actions' && 'xl:sticky xl:end-0 xl:z-[2] xl:bg-inherit xl:shadow-[-1px_0_0_hsl(var(--border)/0.45)]',
  );
}

function resolveMobileColumns<T>(
  columns: ResolvedColumn<T>[],
  keys?: readonly string[],
): ResolvedColumn<T>[] {
  if (!keys || keys.length === 0) return [];
  return keys
    .map((key) => columns.find((column) => column.key === key))
    .filter((column): column is ResolvedColumn<T> => Boolean(column));
}

function selectMobileSupportingColumn<T>(
  columns: ResolvedColumn<T>[],
  explicitKey: string | undefined,
  excludedKeys: ReadonlySet<string>,
): ResolvedColumn<T> | undefined {
  if (explicitKey) return columns.find((column) => column.key === explicitKey);
  return columns.find(
    (column) =>
      !excludedKeys.has(column.key)
      && column.resolvedPriority !== 'actions'
      && column.resolvedPriority !== 'detail',
  );
}

function selectDefaultMobileMetaColumns<T>(
  columns: ResolvedColumn<T>[],
  excludedKeys: ReadonlySet<string>,
): ResolvedColumn<T>[] {
  return columns
    .filter((column) => !excludedKeys.has(column.key) && column.resolvedPriority !== 'actions')
    .slice(0, 3);
}

function toMetaItem<T>(column: ResolvedColumn<T>, row: T): EntityCardMetaItem {
  return {
    label: column.header,
    value: column.render(row),
  };
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
    <Card className="overflow-hidden rounded-[18px] border-border/60 bg-muted/[0.16] p-2 shadow-none" data-entity-table-grid>
      <div data-entity-table-scroll className="mobile-scroll-x overflow-x-auto overscroll-x-contain">
        <Table density="default" className="min-w-full border-separate border-spacing-x-0 border-spacing-y-2 text-[12.5px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {Array.from({ length: totalColumns }, (_, index) => (
                <TableHead key={index} className="h-8 bg-transparent px-3 first:ps-4 last:pe-4">
                  <Skeleton className="h-3 w-16" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, rowIndex) => (
              <TableRow key={rowIndex} className="hover:bg-transparent">
                {Array.from({ length: totalColumns }, (_, columnIndex) => (
                  <TableCell key={columnIndex} className="border-y border-border/55 bg-card px-3 py-3 first:rounded-s-[16px] first:border-s first:ps-4 last:rounded-e-[16px] last:border-e last:pe-4">
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
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
    <div className="grid gap-2.5" aria-hidden="true" data-entity-table-mobile-skeleton>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-[16px] border border-border/70 bg-card px-4 py-3 shadow-none">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3.5 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/55 pt-3">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
          <div className="mt-3 flex gap-2 border-t border-border/55 pt-3">
            <Skeleton className="h-11 flex-1 rounded-xl" />
            <Skeleton className="h-11 w-11 rounded-xl" />
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
      className="flex flex-col gap-2 rounded-[16px] border border-border/60 bg-card px-3 py-2 text-[11.5px] font-medium text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
      aria-label="ترقيم الصفحات"
    >
      <span>
        الصفحة <strong className="font-semibold text-foreground">{page}</strong> من {totalPages}
        {pagination.total > 0 ? <span className="ms-2 opacity-70">· {pagination.total} سجل</span> : null}
      </span>
      <div className="grid grid-cols-2 gap-2 sm:flex">
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
      action={<Button onClick={() => pagination.onPageChange(1)}><ChevronDown className="me-2 size-4 rotate-90" aria-hidden="true" />العودة إلى الصفحة الأولى</Button>}
    />
  );
});

function MobileRegisterListItem<T>({
  row,
  rowKey,
  ariaLabel,
  identityColumn,
  supportingColumn,
  cardType,
  badgeColumn,
  primaryMetaColumns,
  secondaryMetaColumns,
  actionsColumn,
  structuredActions,
  explicitPrimaryAction,
  selected,
  onToggleSelected,
  onRowClick,
}: Readonly<{
  row: T;
  rowKey: string;
  ariaLabel: string;
  identityColumn: ResolvedColumn<T>;
  supportingColumn?: ResolvedColumn<T>;
  cardType?: EntityCardType;
  badgeColumn?: ResolvedColumn<T>;
  primaryMetaColumns: ResolvedColumn<T>[];
  secondaryMetaColumns: ResolvedColumn<T>[];
  actionsColumn?: ResolvedColumn<T>;
  structuredActions?: EntityCardAction[];
  explicitPrimaryAction?: EntityCardAction;
  selected: boolean;
  onToggleSelected?: () => void;
  onRowClick?: (row: T) => void;
}>) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rowLabel = nodeToText(identityColumn.render(row)).trim() || 'السجل';
  const hasStructuredActions = structuredActions !== undefined;
  const overflowPool = [
    ...(structuredActions ?? []),
    ...(onToggleSelected ? [{
      label: selected ? 'إلغاء التحديد' : 'تحديد السجل',
      variant: 'secondary' as const,
      ariaLabel: `${selected ? 'إلغاء تحديد' : 'تحديد'} ${rowLabel}`,
      onClick: onToggleSelected,
    }] : []),
  ];
  const primaryAction = explicitPrimaryAction;
  const secondaryAction = overflowPool[0];
  const overflowActions = overflowPool.length > 1 ? overflowPool.slice(1) : [];

  return (
    <li role="listitem" data-entity-table-mobile-card className="min-w-0">
      <EntityCard
        id={rowKey}
        type={cardType}
        name={<span data-entity-table-mobile-primary>{identityColumn.render(row)}</span>}
        subtitle={supportingColumn ? <span data-entity-table-mobile-supporting>{supportingColumn.render(row)}</span> : undefined}
        badge={badgeColumn ? badgeColumn.render(row) : selected ? <span className="rounded-full bg-primary/10 px-1.5 py-0 text-[10.5px] font-semibold text-primary">محدد</span> : undefined}
        primaryMeta={primaryMetaColumns.map((column) => toMetaItem(column, row))}
        secondaryMeta={secondaryMetaColumns.map((column) => toMetaItem(column, row))}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
        bodyAriaLabel={onRowClick ? `فتح ${rowLabel}` : undefined}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
        overflowActions={overflowActions}
        className={selected ? 'border-primary/35 ring-1 ring-primary/10' : undefined}
      />

      {!hasStructuredActions && actionsColumn ? (
        <div className="mt-2 rounded-[14px] border border-border/60 bg-card px-3 py-2 shadow-none">
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
            <MoreHorizontal className="size-3.5" aria-hidden="true" />
            المزيد
          </Button>
          {actionsOpen ? (
            <div
              id={`mobile-actions-${rowKey}`}
              data-entity-table-mobile-actions-panel
              className="mt-2 min-w-0 border-t border-border/55 pt-2 [&>div]:flex-wrap"
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

function ViewModeToggle({
  ariaLabel,
  viewMode,
  onChange,
}: Readonly<{
  ariaLabel: string;
  viewMode: ViewMode;
  onChange: (nextMode: ViewMode) => void;
}>) {
  return (
    <div
      className="inline-flex min-h-11 items-center rounded-xl border border-border/65 bg-card p-1 shadow-sm"
      role="group"
      aria-label={`طريقة عرض ${ariaLabel}`}
      data-entity-table-view-toggle
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={viewMode === 'cards'}
        onClick={() => onChange('cards')}
        className={cn(
          'min-h-9 gap-1.5 rounded-lg px-2.5 text-xs font-bold',
          viewMode === 'cards' && 'bg-primary/10 text-primary shadow-none hover:bg-primary/15',
        )}
      >
        <LayoutGrid className="size-3.5" aria-hidden="true" />
        بطاقات
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={viewMode === 'table'}
        onClick={() => onChange('table')}
        className={cn(
          'min-h-9 gap-1.5 rounded-lg px-2.5 text-xs font-bold',
          viewMode === 'table' && 'bg-info/10 text-info shadow-none hover:bg-info/15',
        )}
      >
        <List className="size-3.5" aria-hidden="true" />
        جدول
      </Button>
    </div>
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
  mobileSupportingKey,
  mobilePrimaryMetaKeys,
  mobileSecondaryMetaKeys,
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
  const storageKey = viewModeStorageKey ?? normalizeStorageKey(ariaLabel);
  const [viewportMode, setViewportMode] = useState<ResponsiveViewport>(() => getViewportMode());
  const [manualViewMode, setManualViewMode] = useState<ViewMode | null>(() => getStoredViewMode(storageKey));
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
    if (typeof window === 'undefined') return;
    const updateViewportMode = () => setViewportMode(getViewportMode());
    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);
    return () => window.removeEventListener('resize', updateViewportMode);
  }, []);

  useEffect(() => {
    setManualViewMode(getStoredViewMode(storageKey));
  }, [storageKey]);

  const chooseViewMode = (nextMode: ViewMode) => {
    setManualViewMode(nextMode);
    try {
      window.localStorage.setItem(storageKey, nextMode);
    } catch {
      // Keep the in-memory choice even when storage is unavailable.
    }
  };

  const presentationMode: ViewMode = enableViewModeToggle
    ? manualViewMode ?? getDefaultViewMode(viewportMode)
    : getDefaultViewMode(viewportMode);

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

  const tableColumns = useMemo(
    () => viewportMode === 'tablet' && !manualViewMode ? resolveTabletColumns(resolvedColumns) : resolvedColumns,
    [manualViewMode, resolvedColumns, viewportMode],
  );

  if (isLoading) {
    return (
      <div className={cn('space-y-2.5', className)} data-entity-table-register data-entity-table-presentation={presentationMode}>
        {toolbar || enableViewModeToggle ? (
          <div data-entity-table-toolbar className="flex min-h-11 flex-wrap items-center justify-between gap-2">
            {enableViewModeToggle ? <ViewModeToggle ariaLabel={ariaLabel} viewMode={presentationMode} onChange={chooseViewMode} /> : null}
            {toolbar}
          </div>
        ) : null}
        {presentationMode === 'cards' ? (
          <MobileRegisterSkeleton rows={skeletonRows} />
        ) : (
          <DesktopTableSkeleton rows={skeletonRows} cols={(tableColumns.length || columns.length) + (hasExpansion ? 1 : 0)} hasSelection={Boolean(rowSelection)} />
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
  const actionsColumn = resolvedColumns.find((column) => column.resolvedPriority === 'actions');
  const badgeColumn = mobileBadgeKey
    ? resolvedColumns.find((column) => column.key === mobileBadgeKey)
    : undefined;

  const explicitlyPrimaryMetaColumns = resolveMobileColumns(
    resolvedColumns,
    mobilePrimaryMetaKeys ?? mobileSummaryKeys,
  );
  const explicitlySecondaryMetaColumns = resolveMobileColumns(resolvedColumns, mobileSecondaryMetaKeys);

  const excludedForSupporting = new Set<string>([
    identityColumn.key,
    ...(badgeColumn ? [badgeColumn.key] : []),
    ...explicitlyPrimaryMetaColumns.map((column) => column.key),
    ...explicitlySecondaryMetaColumns.map((column) => column.key),
    ...(actionsColumn ? [actionsColumn.key] : []),
  ]);
  const supportingColumn = selectMobileSupportingColumn(
    resolvedColumns,
    mobileSupportingKey,
    excludedForSupporting,
  );
  const excludedForMeta = new Set<string>([
    identityColumn.key,
    ...(badgeColumn ? [badgeColumn.key] : []),
    ...(supportingColumn ? [supportingColumn.key] : []),
    ...(actionsColumn ? [actionsColumn.key] : []),
  ]);
  const primaryMetaColumns = explicitlyPrimaryMetaColumns.length > 0
    ? explicitlyPrimaryMetaColumns.filter((column) => column !== supportingColumn && column !== badgeColumn)
    : selectDefaultMobileMetaColumns(resolvedColumns, excludedForMeta);
  const secondaryMetaColumns = explicitlySecondaryMetaColumns.filter(
    (column) => column !== supportingColumn && column !== badgeColumn,
  );
  const colSpan = tableColumns.length + (hasExpansion ? 1 : 0) + (rowSelection ? 1 : 0);

  return (
    <div className={cn('space-y-2.5', className)} data-entity-table-register data-entity-table-presentation={presentationMode} data-entity-table-viewport={viewportMode}>
      {error != null ? (
        <DataRefreshAlert
          title={errorTitle}
          description="الصفوف المعروضة من آخر تحميل مكتمل وقد لا تطابق أحدث حالة أو عوامل التصفية الحالية."
          onRetry={onRetry}
        />
      ) : null}
      <div
        className="space-y-2.5"
        inert={error != null ? true : undefined}
        aria-disabled={error != null ? 'true' : undefined}
        data-stale-register-content={error != null ? 'true' : undefined}
      >
        {toolbar || enableViewModeToggle ? (
          <div data-entity-table-toolbar className="flex min-h-11 flex-wrap items-center justify-between gap-2">
            {enableViewModeToggle ? <ViewModeToggle ariaLabel={ariaLabel} viewMode={presentationMode} onChange={chooseViewMode} /> : null}
            {toolbar}
          </div>
        ) : null}

        {presentationMode === 'cards' ? (
          <div data-entity-table-mobile data-entity-table-cards>
            <ul role="list" aria-label={ariaLabel} className="grid gap-2.5 md:grid-cols-2 2xl:grid-cols-3" data-entity-table-mobile-list>
              {rows.map((row) => {
                const rowKey = keyOf(row);
                const cardType = typeof mobileCardType === 'function' ? mobileCardType(row) : mobileCardType;
                const explicitPrimaryAction = mobileCardPrimaryAction ? mobileCardPrimaryAction(row) : undefined;
                return (
                  <MobileRegisterListItem
                    key={rowKey}
                    row={row}
                    rowKey={rowKey}
                    ariaLabel={ariaLabel}
                    identityColumn={identityColumn}
                    supportingColumn={supportingColumn}
                    cardType={cardType}
                    badgeColumn={badgeColumn}
                    primaryMetaColumns={primaryMetaColumns}
                    secondaryMetaColumns={secondaryMetaColumns}
                    actionsColumn={actionsColumn}
                    structuredActions={mobileCardActions ? mobileCardActions(row) : undefined}
                    explicitPrimaryAction={explicitPrimaryAction}
                    selected={selectedSet.has(rowKey)}
                    onToggleSelected={rowSelection ? () => toggleSelected(rowKey) : undefined}
                    onRowClick={explicitPrimaryAction ? undefined : onRowClick}
                  />
                );
              })}
            </ul>
          </div>
        ) : (
          <Card data-entity-table-wrapper data-compact-responsive-table data-entity-table-grid className="overflow-hidden rounded-[18px] border-border/60 bg-muted/[0.16] p-2 shadow-none">
            <div
              data-entity-table-scroll
              tabIndex={0}
              role="region"
              aria-label={`${ariaLabel} — منطقة جدول قابلة للتمرير أفقياً عند الحاجة مع الحفاظ على البنية الجدولية`}
              className="mobile-scroll-x overflow-x-auto overscroll-x-contain touch-pan-x focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <Table
                data-entity-table
                density="default"
                aria-label={ariaLabel}
                className="min-w-full border-separate border-spacing-x-0 border-spacing-y-2 text-[12.5px] leading-5 [&_td_[data-status-badge]]:min-h-5 [&_td_[data-status-badge]]:gap-1 [&_td_[data-status-badge]]:px-1.5 [&_td_[data-status-badge]]:py-0 [&_td_[data-status-badge]]:text-[10.5px] [&_td_[data-status-badge]]:leading-4"
              >
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {rowSelection ? (
                      <TableHead className="h-8 w-11 bg-transparent px-2 text-center first:ps-4">
                        <SelectionCheckbox
                          checked={allCurrentSelected}
                          mixed={someCurrentSelected}
                          label={rowSelection.ariaLabel ?? `تحديد سجلات ${ariaLabel}`}
                          onChange={toggleSelectCurrentPage}
                        />
                      </TableHead>
                    ) : null}
                    {hasExpansion ? <TableHead className="h-8 w-11 bg-transparent px-2"><span className="sr-only">تفاصيل الصف</span></TableHead> : null}
                    {tableColumns.map((column) => {
                      const sortDirection = column.sortable && sort?.field === column.key
                        ? (sort.direction === 'asc' ? 'ascending' : 'descending')
                        : undefined;
                      return (
                        <TableHead
                          key={column.key}
                          data-column-priority={column.resolvedPriority}
                          className={cn(
                            'h-8 bg-transparent px-3 text-[11px] font-semibold tracking-normal text-muted-foreground/90 first:ps-4 last:pe-4',
                            priorityClass(column.resolvedPriority, column.sticky !== false),
                            column.className,
                          )}
                          aria-sort={sortDirection}
                        >
                          {column.sortable && onSort ? (
                            <button
                              type="button"
                              className="inline-flex min-h-11 items-center font-semibold text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/25"
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
                            'bg-transparent hover:[&>td]:border-primary/20 hover:[&>td]:bg-primary/[0.035]',
                            isSelected && '[&>td]:border-primary/30 [&>td]:bg-primary/[0.06]',
                            onRowClick && 'cursor-pointer focus-visible:outline-none focus-visible:[&>td]:border-primary/35 focus-visible:[&>td]:bg-primary/[0.06]',
                          )}
                          tabIndex={onRowClick ? 0 : undefined}
                          aria-expanded={hasExpansion ? isExpanded : undefined}
                        >
                          {rowSelection ? (
                            <TableCell className="w-11 border-y border-border/60 bg-card px-2 text-center first:rounded-s-[16px] first:border-s first:ps-3" data-row-action>
                              <SelectionCheckbox
                                checked={isSelected}
                                label={`تحديد ${nodeToText(identityColumn.render(row)).trim() || 'السجل'}`}
                                onChange={() => toggleSelected(rowKey)}
                              />
                            </TableCell>
                          ) : null}
                          {hasExpansion ? (
                            <TableCell className={cn('w-11 border-y border-border/60 bg-card px-2 text-center', !rowSelection && 'first:rounded-s-[16px] first:border-s first:ps-3')} data-row-action>
                              <button
                                type="button"
                                className="grid size-11 place-items-center rounded-xl text-muted-foreground outline-none transition hover:bg-primary/8 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                                aria-label={isExpanded ? 'إخفاء تفاصيل الصف' : 'عرض كل تفاصيل الصف'}
                                aria-expanded={isExpanded}
                                aria-controls={detailId}
                                onClick={() => toggleRow(rowKey)}
                              >
                                {isExpanded ? <ChevronUp className="size-3.5" aria-hidden="true" /> : <ChevronDown className="size-3.5" aria-hidden="true" />}
                              </button>
                            </TableCell>
                          ) : null}
                          {tableColumns.map((column, columnIndex) => (
                            <TableCell
                              key={column.key}
                              data-column-priority={column.resolvedPriority}
                              className={cn(
                                'border-y border-border/60 bg-card px-3 py-3 align-top text-[12.5px] leading-5',
                                (!rowSelection && !hasExpansion && columnIndex === 0) && 'rounded-s-[16px] border-s ps-4',
                                (rowSelection || hasExpansion) && columnIndex === 0 && 'ps-3',
                                columnIndex === tableColumns.length - 1 && 'rounded-e-[16px] border-e pe-4',
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
                            <TableCell colSpan={colSpan} className="rounded-[16px] border border-primary/15 bg-primary/[0.025] p-4">
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
