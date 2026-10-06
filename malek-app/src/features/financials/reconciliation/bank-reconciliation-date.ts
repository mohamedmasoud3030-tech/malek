import type { SupportedTimezone } from '@/lib/companySettings';

/**
 * Converts an instant to the company's calendar date without leaking the runtime
 * machine's timezone or UTC into bank-reconciliation matching.
 */
export function toCompanyDateKey(value: string | number | Date, timeZone: SupportedTimezone): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid reconciliation timestamp.');

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  if (!year || !month || !day) throw new Error('Could not derive reconciliation calendar date.');

  return `${year}-${month}-${day}`;
}
