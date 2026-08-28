/**
 * Meter billing coverage (P3 — Daily Operations).
 *
 * A registered meter is a standing obligation to record consumption. The
 * meters register listed identity (type, number, account, responsible party)
 * but never answered the operational question: *is this meter actually being
 * billed?* A meter that has never received a bill, or whose last bill is far
 * behind the normal billing rhythm, means consumption is accruing somewhere
 * without a claim against anybody.
 *
 * This module only reads rows the canonical utilities service already returns.
 * It creates no billing rule, invents no billing period, decides no amount and
 * performs no write — it reports the gap so a human investigates it.
 */
import type { UtilityBill, UtilityMeter } from './utilities-service';

/**
 * Utility billing in the portfolio is monthly. A meter whose last billed date
 * is more than this far behind today has missed at least one full cycle plus
 * the provider's issuing lag, so it is a real gap rather than normal delay.
 */
export const METER_BILLING_STALE_AFTER_DAYS = 60;

export type MeterBillingState = 'never_billed' | 'stale' | 'current';

export type MeterBillingFilter = MeterBillingState | 'all';

export const meterBillingStateLabels: Record<MeterBillingState, string> = {
  never_billed: 'بلا فواتير',
  stale: 'متأخرة عن الفوترة',
  current: 'محدثة',
};

export const meterBillingStateTone: Record<MeterBillingState, 'danger' | 'warning' | 'success'> = {
  never_billed: 'danger',
  stale: 'warning',
  current: 'success',
};

export type MeterBillingCoverage = {
  meterId: string;
  /** Latest date this meter is known to have been billed for, `YYYY-MM-DD`. */
  lastBilledDate: string | null;
  /** Days between the last billed date and today; `null` when never billed. */
  daysSinceLastBill: number | null;
  billCount: number;
  state: MeterBillingState;
};

export type MeterBillingSummary = {
  totalMeters: number;
  neverBilled: number;
  stale: number;
  current: number;
  /** Meters an operator should look at: never billed plus stale. */
  needingAttention: number;
};

export const EMPTY_METER_BILLING_SUMMARY: MeterBillingSummary = {
  totalMeters: 0,
  neverBilled: 0,
  stale: 0,
  current: 0,
  needingAttention: 0,
};

function parseIsoDay(value: string | null | undefined): number | null {
  if (!value) return null;
  const iso = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const parsed = Date.parse(`${iso}T00:00:00.000Z`);
  return Number.isNaN(parsed) ? null : parsed;
}

function daysBetween(fromMs: number, toMs: number): number {
  return Math.round((toMs - fromMs) / 86_400_000);
}

/**
 * The date a bill covers. The billing period end is the truthful answer when
 * the office recorded it; otherwise the due date, which the utilities schema
 * always requires. Never invented from `created_at`.
 */
function billCoverageDate(bill: UtilityBill): string | null {
  const periodEnd = bill.billing_period_end?.slice(0, 10);
  if (periodEnd && parseIsoDay(periodEnd) !== null) return periodEnd;
  const due = bill.due_date?.slice(0, 10);
  return due && parseIsoDay(due) !== null ? due : null;
}

/**
 * Coverage for one meter against the bills already loaded for it.
 *
 * `bills` must be the complete set of bills for the meter — passing a
 * status-filtered or urgency-filtered subset would report a false gap, so the
 * workspace derives coverage before any presentation filter is applied.
 */
export function deriveMeterBillingCoverage(
  meter: UtilityMeter,
  bills: readonly UtilityBill[],
  today: string,
): MeterBillingCoverage {
  const todayMs = parseIsoDay(today);
  const meterBills = bills.filter((bill) => bill.meter_id === meter.id);

  let lastBilledDate: string | null = null;
  let lastBilledMs: number | null = null;
  for (const bill of meterBills) {
    const coverage = billCoverageDate(bill);
    const coverageMs = parseIsoDay(coverage);
    if (coverage === null || coverageMs === null) continue;
    if (lastBilledMs === null || coverageMs > lastBilledMs) {
      lastBilledMs = coverageMs;
      lastBilledDate = coverage;
    }
  }

  if (lastBilledMs === null || lastBilledDate === null) {
    return {
      meterId: meter.id,
      lastBilledDate: null,
      daysSinceLastBill: null,
      billCount: meterBills.length,
      state: 'never_billed',
    };
  }

  // Without a usable operating date we report the fact we have (it was billed)
  // and refuse to guess how stale it is.
  if (todayMs === null) {
    return {
      meterId: meter.id,
      lastBilledDate,
      daysSinceLastBill: null,
      billCount: meterBills.length,
      state: 'current',
    };
  }

  // A bill covering a future period is ahead of the cycle, never stale.
  const daysSinceLastBill = Math.max(0, daysBetween(lastBilledMs, todayMs));

  return {
    meterId: meter.id,
    lastBilledDate,
    daysSinceLastBill,
    billCount: meterBills.length,
    state: daysSinceLastBill > METER_BILLING_STALE_AFTER_DAYS ? 'stale' : 'current',
  };
}

export function summarizeMeterBillingCoverage(
  coverages: readonly MeterBillingCoverage[],
): MeterBillingSummary {
  const summary = { ...EMPTY_METER_BILLING_SUMMARY, totalMeters: coverages.length };
  for (const coverage of coverages) {
    if (coverage.state === 'never_billed') summary.neverBilled += 1;
    else if (coverage.state === 'stale') summary.stale += 1;
    else summary.current += 1;
  }
  summary.needingAttention = summary.neverBilled + summary.stale;
  return summary;
}

export function matchesMeterBillingFilter(
  coverage: MeterBillingCoverage | undefined,
  filter: MeterBillingFilter,
): boolean {
  if (filter === 'all') return true;
  if (!coverage) return false;
  return coverage.state === filter;
}
