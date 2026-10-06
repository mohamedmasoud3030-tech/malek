import { useEffect, useState } from 'react';

/**
 * Debounce a value after a delay.
 * @param value - The value to debounce
 * @param delayMs - Delay in milliseconds (default: 300)
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
