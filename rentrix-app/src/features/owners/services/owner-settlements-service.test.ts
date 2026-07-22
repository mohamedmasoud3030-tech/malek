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
    management_fee_rate: 10,
    management_fee_type: 'percentage',
    management_fee_amount: 100,
    maintenance_deductions: 20,
    utility_deductions: 5,
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
      makeSettlement({ id: 's-2', gross_rent_collected: 500, management_fee_amount: 50, maintenance_deductions: 0, utility_deductions: 0, net_payable_amount: 450 }),
    ]);

    expect(totals).toEqual({ gross: 1500, fees: 150, deductions: 25, net: 1325 });
  });

  it('excludes cancelled drafts from every total — they never create a payable or collection', () => {
    const totals = summarizeLiveOwnerSettlements([
      makeSettlement({ id: 's-1', status: 'pending' }),
      makeSettlement({ id: 's-2', status: 'cancelled', gross_rent_collected: 9999, management_fee_amount: 9999, net_payable_amount: 9999 }),
    ]);

    expect(totals).toEqual({ gross: 1000, fees: 100, deductions: 25, net: 875 });
  });

  it('returns all-zero totals for an empty or fully-cancelled list', () => {
    expect(summarizeLiveOwnerSettlements([])).toEqual({ gross: 0, fees: 0, deductions: 0, net: 0 });
    expect(summarizeLiveOwnerSettlements([makeSettlement({ status: 'cancelled' })])).toEqual({ gross: 0, fees: 0, deductions: 0, net: 0 });
  });
});
