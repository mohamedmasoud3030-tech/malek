import { describe, expect, it } from 'vitest';
import { utilityBillPayloadSchema, utilityMeterFormSchema } from './utility-schema';

describe('utility bill financial guards', () => {
  const bill = {
    meter_id: null, property_id: '00000000-0000-4000-8000-000000000001', unit_id: null,
    bill_number: null, billing_period_start: '2026-07-01', billing_period_end: '2026-07-31',
    previous_reading: 10, current_reading: 20, consumption_units: 10, amount: 100,
    paid_amount: 0, due_date: '2026-08-01', responsible_party: 'tenant' as const,
    attachment_url: null, notes: null,
  };
  it('rejects paid amount above the bill amount', () => {
    expect(() => utilityBillPayloadSchema.parse({ ...bill, paid_amount: 101 })).toThrow(/يتجاوز/);
  });
});

describe('utility meter normalization', () => {
  it('removes formatting whitespace and canonicalizes meter numbers', () => {
    const value = utilityMeterFormSchema.parse({
      property_id: '00000000-0000-4000-8000-000000000001', unit_id: null,
      utility_type: 'electricity', meter_number: ' ab  12- c ', account_number: 'account-1',
      provider_name: '', responsible_party: 'tenant', is_active: true, notes: '',
    });
    expect(value.meter_number).toBe('AB12-C');
  });
});
