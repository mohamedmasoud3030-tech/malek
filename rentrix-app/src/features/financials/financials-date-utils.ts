import { toDateOnlyISO } from '@/lib/formatters';

/** Compact English date like `22/8` — no year, no time. */
export function formatCompactDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const raw = typeof value === 'string' ? value.slice(0, 10) : getTodayLocalDateString(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return String(value);
  const day = Number(match[3]);
  const month = Number(match[2]);
  if (!day || !month) return raw;
  return `${day}/${month}`;
}

/**
 * Canonical local-date serialization now lives in `@/lib/formatters` as
 * `toDateOnlyISO` (local-timezone `YYYY-MM-DD`; never `toISOString()`, which
 * shifts the calendar day for timezones east of UTC). This feature-scoped
 * helper is kept as a thin delegation so the ~21 existing cross-feature
 * importers keep their meaningful name without duplicating the logic.
 */
export function getTodayLocalDateString(date = new Date()) {
  return toDateOnlyISO(date);
}

export function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
