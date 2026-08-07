/**
 * usePersistentTableState — Enterprise UX Foundation (Wave 4A)
 *
 * `useTableState` with transparent sessionStorage persistence of page, page
 * size, sort and search — per `storageKey`, so each list keeps its own
 * browsing context for the current browser session without resurrecting stale
 * filters from a previous work session. Selection and expansion stay memory-only
 * (persisting them leaks stale ids between data refreshes).
 *
 * Storage failures (private mode, quota) degrade silently to in-memory state.
 *
 * @example
 * const table = usePersistentTableState('enterprise:contracts-table', { pageSize: 25 });
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  useTableState,
  type EnterpriseSortDirection,
  type EnterpriseSortState,
  type UseTableStateOptions,
  type UseTableStateResult,
} from './use-table-state';

interface PersistedTableState<TField extends string> {
  page: number;
  pageSize: number;
  search: string;
  sort: EnterpriseSortState<TField> | null;
}

function readPersisted<TField extends string>(
  storageKey: string,
): PersistedTableState<TField> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedTableState<TField>>;
    const direction: EnterpriseSortDirection | undefined =
      parsed.sort?.direction === 'desc' ? 'desc' : parsed.sort?.direction === 'asc' ? 'asc' : undefined;
    return {
      page:
        typeof parsed.page === 'number' && Number.isFinite(parsed.page) && parsed.page >= 1
          ? Math.floor(parsed.page)
          : 1,
      pageSize:
        typeof parsed.pageSize === 'number' && Number.isFinite(parsed.pageSize) && parsed.pageSize >= 1
          ? Math.floor(parsed.pageSize)
          : 20,
      search: typeof parsed.search === 'string' ? parsed.search : '',
      sort:
        typeof parsed.sort?.field === 'string' && direction
          ? { field: parsed.sort.field as TField, direction }
          : null,
    };
  } catch {
    return null;
  }
}

export function usePersistentTableState<TField extends string = string>(
  storageKey: string,
  options: UseTableStateOptions<TField> = {},
): UseTableStateResult<TField> {
  // Hydrate once per key change; apply through the public setters so every
  // invariant of useTableState (page reset on search, …) stays enforced.
  const hydrated = useMemo(() => readPersisted<TField>(storageKey), [storageKey]);

  const table = useTableState<TField>({
    ...options,
    pageSize: hydrated?.pageSize ?? options.pageSize,
    defaultSort: hydrated?.sort ?? options.defaultSort ?? null,
    defaultSearch: hydrated?.search ?? options.defaultSearch ?? '',
  });

  const didHydratePageRef = useRef<string | null>(null);
  useEffect(() => {
    if (hydrated && didHydratePageRef.current !== storageKey) {
      didHydratePageRef.current = storageKey;
      if (hydrated.page > 1) table.setPage(hydrated.page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const snapshot: PersistedTableState<TField> = {
        page: table.page,
        pageSize: table.pageSize,
        search: table.search,
        sort: table.sort,
      };
      window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch {
      // Storage may be unavailable — keep in-memory state.
    }
  }, [storageKey, table.page, table.pageSize, table.search, table.sort]);

  return table;
}
