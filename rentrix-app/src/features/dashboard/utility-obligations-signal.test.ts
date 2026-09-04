import { describe, expect, it } from 'vitest';
import type { UtilityBill } from '@/features/utilities/utilities-service';
import {
  buildUtilityObligationsSignal,
  EMPTY_UTILITY_OBLIGATIONS_SIGNAL,
} from './utility-obligations-signal';

const TODAY = '2026-08-27';

function bill(overrides: Partial<UtilityBill>): UtilityBill {
  return {
    id: 'bill-1',
    meter_id: 'meter-1',
    property_id: 'property-1',
    unit_id: null,
    bill_number: 'UB-1',
    billing_period_start: '2026-07-01',
    billing_period_end: '2026-07-31',
    amount: 100,
    paid_amount: 0,
    due_date: TODAY,
    status: 'unpaid',
    responsible_party: 'tenant',
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  } as UtilityBill;
}

describe('Today utility obligations summary', () => {
  it('returns the neutral signal when there is nothing to read', () => {
    expect(buildUtilityObligationsSignal(undefined, TODAY)).toBe(EMPTY_UTILITY_OBLIGATIONS_SIGNAL);
    expect(buildUtilityObligationsSignal([], TODAY)).toBe(EMPTY_UTILITY_OBLIGATIONS_SIGNAL);
  });

  it('counts late plus imminently due obligations without rebuilding bill rows', () => {
    const signal = buildUtilityObligationsSignal(
      [
        bill({ id: 'a', due_date: '2026-08-10' }),
        bill({ id: 'b', due_date: '2026-08-30' }),
        bill({ id: 'c', due_date: '2026-11-30' }),
        bill({ id: 'd', due_date: '2026-08-01', status: 'paid', paid_amount: 100 }),
      ],
      TODAY,
    );

    expect(signal.actionableCount).toBe(2);
    expect(signal.summary.overdueCount).toBe(1);
    expect(signal.summary.dueSoonCount).toBe(1);
    expect('rows' in signal).toBe(false);
  });

  it('keeps complete-set money totals and the oldest overdue age', () => {
    const signal = buildUtilityObligationsSignal(
      [
        bill({ id: 'old', due_date: '2026-08-01', amount: 100, paid_amount: 30 }),
        bill({ id: 'new', due_date: '2026-08-20', amount: 50, paid_amount: 0 }),
      ],
      TODAY,
    );

    expect(signal.summary.overdueAmount).toBe(120);
    expect(signal.oldestOverdueDays).toBe(26);
  });

  it('keeps scheduled future obligations out of the Today action count', () => {
    const signal = buildUtilityObligationsSignal(
      [bill({ id: 'future', due_date: '2026-11-30' })],
      TODAY,
    );

    expect(signal.actionableCount).toBe(0);
    expect(signal.oldestOverdueDays).toBe(0);
  });
});
