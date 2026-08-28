import { describe, expect, it } from 'vitest';
import type { UtilityBill } from './utilities-service';
import {
  compareUtilityObligationUrgency,
  deriveUtilityObligation,
  deriveUtilityObligations,
  summarizeUtilityObligations,
  utilityBillRemaining,
  UTILITY_DUE_SOON_WINDOW_DAYS,
} from './utility-obligations';

const TODAY = '2026-08-27';

function bill(overrides: Partial<UtilityBill> = {}): UtilityBill {
  return {
    id: overrides.id ?? 'bill-1',
    meter_id: 'meter-1',
    property_id: 'property-1',
    unit_id: null,
    bill_number: 'U-001',
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

describe('utility obligation derivation (P3)', () => {
  it('never reports a negative remaining amount when a bill was overpaid', () => {
    expect(utilityBillRemaining({ amount: 100, paid_amount: 130 })).toBe(0);
    expect(utilityBillRemaining({ amount: 100.5, paid_amount: 40.25 })).toBe(60.25);
  });

  it('keeps derived remainders on the three-decimal money grid', () => {
    expect(utilityBillRemaining({ amount: 0.3, paid_amount: 0.1 })).toBe(0.2);
  });

  it('marks a past due date with a still-open balance as overdue', () => {
    const obligation = deriveUtilityObligation(bill({ due_date: '2026-08-20', paid_amount: 40 }), TODAY);
    expect(obligation.urgency).toBe('overdue');
    expect(obligation.daysOverdue).toBe(7);
    expect(obligation.daysUntilDue).toBe(-7);
    expect(obligation.remainingAmount).toBe(60);
  });

  it('treats today as due-soon rather than overdue', () => {
    const obligation = deriveUtilityObligation(bill({ due_date: TODAY }), TODAY);
    expect(obligation.urgency).toBe('due_soon');
    expect(obligation.daysOverdue).toBe(0);
  });

  it('uses the near operating window boundary inclusively', () => {
    const inside = deriveUtilityObligation(bill({ due_date: '2026-09-03' }), TODAY);
    const outside = deriveUtilityObligation(bill({ due_date: '2026-09-04' }), TODAY);
    expect(UTILITY_DUE_SOON_WINDOW_DAYS).toBe(7);
    expect(inside.urgency).toBe('due_soon');
    expect(outside.urgency).toBe('scheduled');
  });

  it('never escalates a settled bill even when its due date passed', () => {
    const paidStatus = deriveUtilityObligation(bill({ due_date: '2026-01-01', status: 'paid' }), TODAY);
    const fullyPaid = deriveUtilityObligation(bill({ due_date: '2026-01-01', paid_amount: 100 }), TODAY);
    expect(paidStatus.urgency).toBe('settled');
    expect(fullyPaid.urgency).toBe('settled');
  });

  it('stays stable when the due date is unusable instead of inventing lateness', () => {
    const obligation = deriveUtilityObligation(bill({ due_date: '' }), TODAY);
    expect(obligation.urgency).toBe('due_soon');
    expect(obligation.daysOverdue).toBe(0);
  });

  it('summarizes only unsettled obligations and splits remaining by responsible party', () => {
    const summary = summarizeUtilityObligations(
      deriveUtilityObligations(
        [
          bill({ id: 'a', due_date: '2026-08-01', amount: 100, paid_amount: 25, responsible_party: 'tenant' }),
          bill({ id: 'b', due_date: '2026-08-29', amount: 60, responsible_party: 'landlord' }),
          bill({ id: 'c', due_date: '2026-12-01', amount: 90, responsible_party: 'company' }),
          bill({ id: 'd', due_date: '2026-05-01', amount: 40, paid_amount: 40, responsible_party: 'tenant' }),
        ],
        TODAY,
      ),
    );

    expect(summary.overdueCount).toBe(1);
    expect(summary.overdueAmount).toBe(75);
    expect(summary.dueSoonCount).toBe(1);
    expect(summary.dueSoonAmount).toBe(60);
    expect(summary.outstandingCount).toBe(3);
    expect(summary.outstandingAmount).toBe(225);
    expect(summary.remainingByResponsibleParty).toEqual({ tenant: 75, landlord: 60, company: 90 });
  });

  it('returns an all-zero summary for an empty operational day', () => {
    const summary = summarizeUtilityObligations([]);
    expect(summary).toEqual({
      overdueCount: 0,
      overdueAmount: 0,
      dueSoonCount: 0,
      dueSoonAmount: 0,
      outstandingCount: 0,
      outstandingAmount: 0,
      remainingByResponsibleParty: { tenant: 0, landlord: 0, company: 0 },
    });
  });

  it('ranks the latest and largest obligations first for triage', () => {
    const ordered = deriveUtilityObligations(
      [
        bill({ id: 'scheduled', due_date: '2026-12-01' }),
        bill({ id: 'late-small', due_date: '2026-08-25', amount: 10 }),
        bill({ id: 'late-old', due_date: '2026-06-01' }),
        bill({ id: 'soon', due_date: '2026-08-30' }),
        bill({ id: 'settled', due_date: '2026-01-01', status: 'paid' }),
      ],
      TODAY,
    )
      .sort(compareUtilityObligationUrgency)
      .map((obligation) => obligation.billId);

    expect(ordered).toEqual(['late-old', 'late-small', 'soon', 'scheduled', 'settled']);
  });
});
