/**
 * P3 — a registered meter is a standing obligation to record consumption.
 * Coverage answers "is this meter actually being billed?" without inventing a
 * billing rule.
 */
import { describe, expect, it } from 'vitest';
import type { UtilityBill, UtilityMeter } from './utilities-service';
import {
  METER_BILLING_STALE_AFTER_DAYS,
  deriveMeterBillingCoverage,
  matchesMeterBillingFilter,
  summarizeMeterBillingCoverage,
} from './meter-billing-coverage';

const TODAY = '2026-08-27';

function meter(id: string): UtilityMeter {
  return {
    id,
    property_id: 'property-1',
    unit_id: null,
    utility_type: 'electricity',
    meter_number: `E-${id}`,
    account_number: 'ACC-1',
    provider_name: null,
    responsible_party: 'tenant',
    is_active: true,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
  };
}

function bill(overrides: Partial<UtilityBill> & { id: string }): UtilityBill {
  return {
    meter_id: 'meter-1',
    property_id: 'property-1',
    unit_id: null,
    bill_number: null,
    billing_period_start: null,
    billing_period_end: null,
    previous_reading: null,
    current_reading: null,
    consumption_units: null,
    amount: 50,
    paid_amount: 0,
    due_date: TODAY,
    status: 'unpaid',
    responsible_party: 'tenant',
    attachment_url: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('meter billing coverage (P3)', () => {
  it('names a meter that has never received a bill', () => {
    const coverage = deriveMeterBillingCoverage(meter('meter-1'), [], TODAY);

    expect(coverage.state).toBe('never_billed');
    expect(coverage.lastBilledDate).toBeNull();
    expect(coverage.daysSinceLastBill).toBeNull();
    expect(coverage.billCount).toBe(0);
  });

  it('ignores bills belonging to another meter', () => {
    const coverage = deriveMeterBillingCoverage(
      meter('meter-1'),
      [bill({ id: 'b1', meter_id: 'meter-2' }), bill({ id: 'b2', meter_id: null })],
      TODAY,
    );

    expect(coverage.state).toBe('never_billed');
    expect(coverage.billCount).toBe(0);
  });

  it('prefers the recorded billing period end over the due date', () => {
    const coverage = deriveMeterBillingCoverage(
      meter('meter-1'),
      [bill({ id: 'b1', billing_period_end: '2026-08-20', due_date: '2026-07-01' })],
      TODAY,
    );

    expect(coverage.lastBilledDate).toBe('2026-08-20');
    expect(coverage.daysSinceLastBill).toBe(7);
  });

  it('takes the most recent bill, whatever order the rows arrive in', () => {
    const coverage = deriveMeterBillingCoverage(
      meter('meter-1'),
      [
        bill({ id: 'old', due_date: '2026-03-01' }),
        bill({ id: 'new', due_date: '2026-08-10' }),
        bill({ id: 'middle', due_date: '2026-06-01' }),
      ],
      TODAY,
    );

    expect(coverage.lastBilledDate).toBe('2026-08-10');
    expect(coverage.billCount).toBe(3);
  });

  it('marks a meter stale only after a full billing cycle has been missed', () => {
    expect(METER_BILLING_STALE_AFTER_DAYS).toBe(60);

    const inside = deriveMeterBillingCoverage(meter('meter-1'), [bill({ id: 'b', due_date: '2026-06-28' })], TODAY);
    const outside = deriveMeterBillingCoverage(meter('meter-1'), [bill({ id: 'b', due_date: '2026-06-27' })], TODAY);

    expect(inside.daysSinceLastBill).toBe(60);
    expect(inside.state).toBe('current');
    expect(outside.state).toBe('stale');
  });

  it('treats a bill covering a future period as ahead of the cycle, never stale', () => {
    const coverage = deriveMeterBillingCoverage(meter('meter-1'), [bill({ id: 'b', due_date: '2026-10-01' })], TODAY);

    expect(coverage.daysSinceLastBill).toBe(0);
    expect(coverage.state).toBe('current');
  });

  it('refuses to guess when a bill carries no usable date', () => {
    const coverage = deriveMeterBillingCoverage(
      meter('meter-1'),
      [bill({ id: 'b', due_date: '' as unknown as string, billing_period_end: null })],
      TODAY,
    );

    expect(coverage.state).toBe('never_billed');
    expect(coverage.lastBilledDate).toBeNull();
  });

  it('summarizes coverage across the register', () => {
    const bills = [
      bill({ id: 'b1', meter_id: 'meter-1', due_date: '2026-08-20' }),
      bill({ id: 'b2', meter_id: 'meter-2', due_date: '2026-01-05' }),
    ];
    const coverages = [meter('meter-1'), meter('meter-2'), meter('meter-3')].map((row) =>
      deriveMeterBillingCoverage(row, bills, TODAY),
    );

    const summary = summarizeMeterBillingCoverage(coverages);

    expect(summary).toEqual({
      totalMeters: 3,
      neverBilled: 1,
      stale: 1,
      current: 1,
      needingAttention: 2,
    });
  });

  it('filters meters by coverage state', () => {
    const never = deriveMeterBillingCoverage(meter('meter-1'), [], TODAY);
    const current = deriveMeterBillingCoverage(meter('meter-2'), [bill({ id: 'b', meter_id: 'meter-2' })], TODAY);

    expect(matchesMeterBillingFilter(never, 'all')).toBe(true);
    expect(matchesMeterBillingFilter(never, 'never_billed')).toBe(true);
    expect(matchesMeterBillingFilter(never, 'current')).toBe(false);
    expect(matchesMeterBillingFilter(current, 'current')).toBe(true);
    expect(matchesMeterBillingFilter(undefined, 'current')).toBe(false);
  });
});
