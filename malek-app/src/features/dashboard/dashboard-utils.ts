import { toDateOnlyISO } from '@/lib/formatters';

/** Canonical local date-only adapter used by dashboard query windows. */
export function toDateInputValue(date: Date) {
  return toDateOnlyISO(date);
}
