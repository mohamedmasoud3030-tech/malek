import { describe, expect, it } from 'vitest';
import { summarizeLiveOwnerSettlements, type OwnerSettlementRecord } from './owner-settlements-service';

function makeSettlement(overrides: Partial<OwnerSettlementRecord> = {}): OwnerSettlementRecord {
  return {
    id: 'settlement-1',
    owner_id: 'owner-1',
    owner_name: 'مالك',
    property_id: 'property-1',
    property_title: 'عقار',
    period_start: '2026-07-01',
    period_end: '2026-07-31',
    gross_rent_collected: 1000,
    management_fee_amount: 100,
    owner_expenses: 20,
    fee_vat_amount: 5,
    net_payable_amount: 875,
    status: 'pending',
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('summarizeLiveOwnerSettlements', () => {
  it('sums gross/fees/deductions/net across live settlements', () => {
    const totals = summarizeLiveOwnerSettlements([
      makeSettlement({ id: 's-1' }),
      makeSettlement({ id: 's-2', gross_rent_collected: 500, management_fee_amount: 50, owner_expenses: 0, fee_vat_amount: 0, net_payable_amount: 450 }),
    ]);

    // Historical volume (both pending here), and outstanding == historical net.
    expect(totals.gross).toBe(1500);
    expect(totals.fees).toBe(150);
    expect(totals.expenses).toBe(20);
    expect(totals.feeVat).toBe(5);
    expect(totals.net).toBe(1325);
    expect(totals.outstandingNet).toBe(1325);
  });

  it('excludes cancelled drafts from every total — they never create a payable or collection', () => {
    const totals = summarizeLiveOwnerSettlements([
      makeSettlement({ id: 's-1', status: 'pending' }),
      makeSettlement({ id: 's-2', status: 'cancelled', gross_rent_collected: 9999, management_fee_amount: 9999, net_payable_amount: 9999 }),
    ]);

    expect(totals.gross).toBe(1000);
    expect(totals.fees).toBe(100);
    expect(totals.expenses).toBe(20);
    expect(totals.feeVat).toBe(5);
    expect(totals.net).toBe(875);
    expect(totals.outstandingNet).toBe(875);
  });

  it('PAID settlements contribute to historical volume but NOT to outstanding payable', () => {
    const totals = summarizeLiveOwnerSettlements([
      makeSettlement({ id: 's-1', status: 'pending' }),
      makeSettlement({ id: 's-2', status: 'paid', gross_rent_collected: 500, management_fee_amount: 50, net_payable_amount: 450 }),
    ]);

    // Historical: paid settlement still collected / earned fees / incurred net.
    expect(totals.gross).toBe(1500);
    expect(totals.fees).toBe(150);
    expect(totals.net).toBe(1325);
    // Outstanding payable: only the pending draft remains (875), NOT the paid 450.
    expect(totals.outstandingNet).toBe(875);
  });

  it('APPROVED settlements count toward outstanding payable; a mixture of all statuses is exact', () => {
    const totals = summarizeLiveOwnerSettlements([
      makeSettlement({ id: 's-draft', status: 'pending', net_payable_amount: 100 }),
      makeSettlement({ id: 's-approved', status: 'approved', net_payable_amount: 200 }),
      makeSettlement({ id: 's-paid', status: 'paid', net_payable_amount: 400 }),
      makeSettlement({ id: 's-cancelled', status: 'cancelled', net_payable_amount: 800 }),
    ]);

    // outstanding = DRAFT(100) + APPROVED(200); PAID and CANCELLED excluded.
    expect(totals.outstandingNet).toBe(300);
    // historical net = every non-cancelled settlement (100 + 200 + 400).
    expect(totals.net).toBe(700);
  });

  it('returns all-zero totals for an empty or fully-cancelled list', () => {
    expect(summarizeLiveOwnerSettlements([])).toEqual({ gross: 0, fees: 0, expenses: 0, feeVat: 0, net: 0, outstandingNet: 0 });
    expect(summarizeLiveOwnerSettlements([makeSettlement({ status: 'cancelled' })])).toEqual({ gross: 0, fees: 0, expenses: 0, feeVat: 0, net: 0, outstandingNet: 0 });
  });

  it('preserves OMR precision to 3 decimal places across fractional nets', () => {
    const totals = summarizeLiveOwnerSettlements([
      makeSettlement({ id: 's-1', status: 'approved', net_payable_amount: 100.005 }),
      makeSettlement({ id: 's-2', status: 'approved', net_payable_amount: 0.001 }),
    ]);
    expect(totals.outstandingNet).toBeCloseTo(100.006, 3);
  });
});
