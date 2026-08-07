/**
 * useFilters — Enterprise UX Foundation (Wave 4A)
 *
 * Generic filter-value state for EnterpriseFilters / toolbars / tables.
 * Values are flat string maps (select option ids, free text, ISO dates…) so
 * the hook stays module-agnostic; modules translate values into queries.
 *
 * @example
 * const filters = useFilters({ status: '', owner: '' });
 * <EnterpriseFilters
 *   fields={fields}
 *   values={filters.values}
 *   onChange={filters.setValue}
 *   onClearAll={filters.clearAll}
 *   activeCount={filters.activeCount}
 * />
 */

import { useCallback, useMemo, useState } from 'react';

export type FilterValues = Record<string, string>;

export interface UseFiltersResult<TValues extends FilterValues> {
  values: TValues;
  /** Set a single filter. Empty string clears it. */
  setValue: (key: keyof TValues & string, value: string) => void;
  /** Merge multiple values at once (one render). */
  setMany: (partial: Partial<TValues>) => void;
  /** Clear one filter back to its initial value. */
  clearValue: (key: keyof TValues & string) => void;
  /** Restore every filter to its initial value. */
  clearAll: () => void;
  /** Filters currently differing from the initial snapshot AND non-empty. */
  activeEntries: Array<{ key: keyof TValues & string; value: string }>;
  activeCount: number;
  /** True when any value differs from the initial snapshot (even cleared ones). */
  isDirty: boolean;
}

function isActiveValue(value: string): boolean {
  return value.trim() !== '';
}

export function useFilters<TValues extends FilterValues>(initialValues: TValues): UseFiltersResult<TValues> {
  const [values, setValues] = useState<TValues>(initialValues);
  const [initial] = useState(initialValues);

  const setValue = useCallback(<K extends keyof TValues & string>(key: K, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setMany = useCallback((partial: Partial<TValues>) => {
    setValues((prev) => ({ ...prev, ...partial }));
  }, []);

  const clearValue = useCallback(
    <K extends keyof TValues & string>(key: K) => {
      setValues((prev) => ({ ...prev, [key]: initial[key] }));
    },
    [initial],
  );

  const clearAll = useCallback(() => {
    setValues(initial);
  }, [initial]);

  const activeEntries = useMemo(
    () =>
      (Object.keys(values) as Array<keyof TValues & string>)
        .filter((key) => isActiveValue(values[key]))
        .map((key) => ({ key, value: values[key] })),
    [values],
  );

  const isDirty = useMemo(
    () =>
      (Object.keys(values) as Array<keyof TValues & string>).some(
        (key) => values[key] !== initial[key],
      ),
    [values, initial],
  );

  return {
    values,
    setValue,
    setMany,
    clearValue,
    clearAll,
    activeEntries,
    activeCount: activeEntries.length,
    isDirty,
  };
}
