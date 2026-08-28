import { describe, expect, it } from 'vitest';
import type { UtilityBill } from '@/features/utilities/utilities-service';
import {
  buildUtilityObligationsSignal,
  EMPTY_UTILITY_OBLIGATIONS_SIGNAL,
  UTILITY_QUEUE_ROW_LIMIT,
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

describe('Today utility obligations signal (P3)', () => {
  it('returns the neutral signal when there is nothing to read', () => {
    expect(buildUtilityObligationsSignal(undefined, TODAY)).toBe(EMPTY_UTILITY_OBLIGATIONS_SIGNAL);
    expect(buildUtilityObligationsSignal([], TODAY)).toBe(EMPTY_UTILITY_OBLIGATIONS_SIGNAL);
  });

  it('counts late plus imminently due claims as the Today action number', () => {
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
    // Scheduled and settled claims stay out of the action hierarchy.
    expect(signal.rows.map((row) => row.billId)).toEqual(['a', 'b']);
  });

  it('bounds the presentation rows without shrinking the counted total', () => {
    const bills = Array.from({ length: 7 }, (_, index) =>
      bill({ id: `late-${index}`, bill_number: `UB-${index}`, due_date: '2026-08-10' }),
    );

    const signal = buildUtilityObligationsSignal(bills, TODAY);

    expect(signal.rows).toHaveLength(UTILITY_QUEUE_ROW_LIMIT);
    expect(signal.actionableCount).toBe(7);
    expect(signal.summary.overdueCount).toBe(7);
  });

  it('writes operator language for each queue row instead of raw fields', () => {
    const signal = buildUtilityObligationsSignal(
      [
        bill({ id: 'late', bill_number: 'UB-9', due_date: '2026-08-20', responsible_party: 'landlord' }),
        bill({ id: 'today', bill_number: null, due_date: TODAY, responsible_party: 'company' }),
        bill({ id: 'soon', bill_number: 'UB-11', due_date: '2026-08-31', responsible_party: 'tenant' }),
      ],
      TODAY,
    );

    expect(signal.rows[0]).toMatchObject({ title: 'فاتورة UB-9', meta: 'متأخرة 7 يوم · المالك' });
    expect(signal.rows[1]).toMatchObject({ title: 'فاتورة مرافق بلا مرجع', meta: 'تستحق اليوم · شركة الإدارة' });
    expect(signal.rows[2]).toMatchObject({ title: 'فاتورة UB-11', meta: 'تستحق خلال 4 يوم · المستأجر' });
  });

  it('carries the remaining obligation, not the invoiced amount, into the queue', () => {
    const signal = buildUtilityObligationsSignal(
      [bill({ id: 'partial', due_date: '2026-08-10', amount: 100, paid_amount: 30 })],
      TODAY,
    );

    expect(signal.rows[0].remainingAmount).toBe(70);
    expect(signal.summary.overdueAmount).toBe(70);
  });
});
