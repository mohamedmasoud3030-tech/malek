/**
 * Convert an ISO-like calendar date prefix to its UTC day number. Calendar
 * arithmetic (rather than local time) keeps date-only comparisons stable in
 * every viewer timezone.
 */
export function toUtcDayNumber(value: string | null | undefined): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 86_400_000) : null;
}
