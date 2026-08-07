/**
 * useTableState — Enterprise UX Foundation (Wave 4A)
 *
 * Canonical state container for EnterpriseDataTable: pagination, sorting,
 * search, row selection and expansion. Module-agnostic and intentionally
 * data-shape-free (it never inspects rows — rows stay in the module).
 *
 * @example
 * const table = useTableState({ pageSize: 25 });
 * <EnterpriseDataTable
 *   rows={filteredRows}
 *   columns={columns}
 *   keyOf={(row) => row.id}
 *   sort={table.sort}
 *   onSortChange={table.setSort}
 *   selectedKeys={table.selectedKeys}
 *   onSelectionChange={table.setSelectedKeys}
 *   aria-label="Contracts"
 * />
 */

import { useCallback, useMemo, useState } from 'react';

export type EnterpriseSortDirection = 'asc' | 'desc';

export interface EnterpriseSortState<TField extends string = string> {
  field: TField;
  direction: EnterpriseSortDirection;
}

export interface UseTableStateOptions<TField extends string = string> {
  pageSize?: number;
  defaultSort?: EnterpriseSortState<TField> | null;
  defaultSearch?: string;
}

export interface UseTableStateResult<TField extends string = string> {
  // Pagination (1-based page index)
  page: number;
  pageSize: number;
  offset: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Sorting
  sort: EnterpriseSortState<TField> | null;
  setSort: (sort: EnterpriseSortState<TField> | null) => void;
  /** Tri-state cycle: asc → desc → cleared. Pass false for asc ⇄ desc toggle. */
  toggleSort: (field: TField, allowClear?: boolean) => void;

  // Search (resets the page when it changes)
  search: string;
  setSearch: (value: string) => void;

  // Selection
  selectedKeys: ReadonlySet<string>;
  setSelectedKeys: (keys: Iterable<string>) => void;
  toggleSelected: (key: string) => void;
  selectOnly: (keys: Iterable<string>) => void;
  clearSelection: () => void;
  isSelected: (key: string) => boolean;
  selectionCount: number;

  // Expansion
  expandedKey: string | null;
  toggleExpanded: (key: string) => void;

  /** Reset pagination + search + sort + selection in one call. */
  reset: () => void;
}

export function useTableState<TField extends string = string>(
  options: UseTableStateOptions<TField> = {},
): UseTableStateResult<TField> {
  const {
    pageSize: initialPageSize = 20,
    defaultSort = null,
    defaultSearch = '',
  } = options;

  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [sort, setSort] = useState<EnterpriseSortState<TField> | null>(defaultSort);
  const [search, setSearchState] = useState(defaultSearch);
  const [selectedKeys, setSelectedKeysState] = useState<ReadonlySet<string>>(new Set());
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const setPage = useCallback((next: number) => {
    setPageState(Math.max(1, Math.floor(next)));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(Math.max(1, Math.floor(size)));
    setPageState(1); // Page size change re-anchors to page 1 (avoids out-of-range pages).
  }, []);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPageState(1); // New query invalidates the current page.
  }, []);

  const toggleSort = useCallback((field: TField, allowClear = true) => {
    setSort((prev) => {
      if (!prev || prev.field !== field) return { field, direction: 'asc' };
      if (prev.direction === 'asc') return { field, direction: 'desc' };
      return allowClear ? null : { field, direction: 'asc' };
    });
  }, []);

  const setSelectedKeys = useCallback((keys: Iterable<string>) => {
    setSelectedKeysState(new Set(keys));
  }, []);

  const toggleSelected = useCallback((key: string) => {
    setSelectedKeysState((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectOnly = useCallback((keys: Iterable<string>) => {
    setSelectedKeysState(new Set(keys));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedKeysState(new Set());
  }, []);

  const isSelected = useCallback((key: string) => selectedKeys.has(key), [selectedKeys]);

  const toggleExpanded = useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  }, []);

  const reset = useCallback(() => {
    setPageState(1);
    setSearchState('');
    setSort(defaultSort);
    setSelectedKeysState(new Set());
    setExpandedKey(null);
  }, [defaultSort]);

  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);

  return {
    page,
    pageSize,
    offset,
    setPage,
    setPageSize,
    sort,
    setSort,
    toggleSort,
    search,
    setSearch,
    selectedKeys,
    setSelectedKeys,
    toggleSelected,
    selectOnly,
    clearSelection,
    isSelected,
    selectionCount: selectedKeys.size,
    expandedKey,
    toggleExpanded,
    reset,
  };
}
