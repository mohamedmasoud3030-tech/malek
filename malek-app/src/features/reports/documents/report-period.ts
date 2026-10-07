/**
 * Comparable previous period arithmetic for professional reports.
 *
 * The previous period is the SAME-LENGTH window immediately before the
 * selected period: `[from - length, from - 1 day]` where length is the
 * exact number of days in the selected period. For a full calendar month
 * (1st → last day) this yields the previous calendar month; for arbitrary
 * ranges it yields the immediately preceding window of equal duration.
 *
 * Pure and deterministic (UTC date math — no timezone drift), so both the
 * UI wiring and tests agree on what "previous period" means.
 */

const toUtcDate = (iso: string): Date => {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

/** Formats a UTC-based date as YYYY-MM-DD without UTC-toISOString slicing. */
const toIso = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Days between two UTC dates (positive when `from <= to`). */
function daysBetween(fromIso: string, toIso2: string): number {
  return Math.round((toUtcDate(toIso2).getTime() - toUtcDate(fromIso).getTime()) / 86_400_000);
}

/** True when `[from, to]` is a full calendar month (1st → month end). */
export function isFullCalendarMonth(from: string, to: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
  if (!match) return false;
  if (Number(match[3]) !== 1) return false;
  const monthKey = `${match[1]}-${match[2]}`;
  return to === monthEndIso(monthKey);
}

/**
 * Returns the comparable previous period, or `null` when the input range is
 * missing or inverted.
 *
 *  - A FULL calendar month (1st → last day) compares to the PREVIOUS
 *    calendar month (e.g. February ↔ January), which is the natural basis
 *    for month-over-month report comparisons.
 *  - Any other range yields the immediately preceding window of EQUAL
 *    duration (same number of inclusive days).
 */
export function previousPeriodRange(from: string | null | undefined, to: string | null | undefined): { from: string; to: string } | null {
  if (!from || !to || /^\d{4}-\d{2}-\d{2}$/.test(from) === false || /^\d{4}-\d{2}-\d{2}$/.test(to) === false) return null;
  if (from > to) return null;

  if (isFullCalendarMonth(from, to)) {
    const [year, month] = from.slice(0, 7).split('-').map(Number);
    let previousYear = year;
    let previousMonth = month - 1;
    if (previousMonth === 0) {
      previousMonth = 12;
      previousYear -= 1;
    }
    const previousKey = `${previousYear}-${String(previousMonth).padStart(2, '0')}`;
    return { from: `${previousKey}-01`, to: monthEndIso(previousKey) };
  }

  const lengthDays = daysBetween(from, to);
  const previousTo = toUtcDate(from);
  previousTo.setUTCDate(previousTo.getUTCDate() - 1);
  const previousFrom = toUtcDate(toIso(previousTo));
  previousFrom.setUTCDate(previousFrom.getUTCDate() - lengthDays);
  return { from: toIso(previousFrom), to: toIso(previousTo) };
}

/**
 * Signed change text for comparison cells. Amounts use absolute differences
 * (never percent-of-percent); rates are expressed in percentage points.
 * Returns `null` when either side is missing.
 */
export function formatSignedAmountChange(current: number | null | undefined, previous: number | null | undefined): string | null {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  return delta > 0 ? `+${delta}` : String(delta);
}

/** Percentage-point change (e.g. occupancy 94% current vs 90% previous → '+4 نقاط'). */
export function formatPointChange(currentRate: number | null | undefined, previousRate: number | null | undefined): string | null {
  if (currentRate == null || previousRate == null) return null;
  const delta = Math.round((currentRate - previousRate) * 10) / 10;
  if (delta === 0) return '0 نقاط';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta} نقاط`;
}

/** Month key `YYYY-MM` of an ISO date. */
export function monthKeyOf(date: string | null | undefined): string | null {
  if (!date) return null;
  const match = /^(\d{4})-(\d{2})/.exec(date);
  return match ? `${match[1]}-${match[2]}` : null;
}

/** Arabic month label for a `YYYY-MM` key. */
export function arabicMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const name = monthNames[Number(month) - 1] ?? month;
  return `${name} ${year}`;
}

/** End-of-month date for a `YYYY-MM` key (ISO). */
export function monthEndIso(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const end = new Date(Date.UTC(year, month, 0));
  return toIso(end);
}