import { describe, expect, it } from 'vitest';
import { contractSchema, renewalSchema } from './contractSchema';

const validContract = {
  property_id: '11111111-1111-4111-8111-111111111111',
  unit_id: '22222222-2222-4222-8222-222222222222',
  tenant_id: '33333333-3333-4333-8333-333333333333',
  start_date: '2026-07-01',
  end_date: '2027-06-30',
  rent_amount: 12000,
  payment_cycle: 'annual' as const,
  status: 'active' as const,
  cancellation_reason: '',
  notes: '',
};

describe('contract date validation', () => {
  it('accepts valid ISO contract and renewal windows', () => {
    expect(contractSchema.safeParse(validContract).success).toBe(true);
    expect(renewalSchema.safeParse({ new_start: '2027-07-01', new_end: '2028-06-30', new_amount: 13000 }).success).toBe(true);
  });

  it('accepts the text property identifiers used by the live contract RPC', () => {
    expect(contractSchema.safeParse({ ...validContract, property_id: 'PROP-001' }).success).toBe(true);
  });

  it('rejects non-existent calendar dates before they reach Supabase', () => {
    expect(contractSchema.safeParse({ ...validContract, start_date: '2026-02-30' }).success).toBe(false);
    expect(renewalSchema.safeParse({ new_start: '2027-02-29', new_end: '2028-06-30', new_amount: 13000 }).success).toBe(false);
  });

  it('rejects malformed dates and reversed windows', () => {
    expect(contractSchema.safeParse({ ...validContract, start_date: '01/07/2026' }).success).toBe(false);
    expect(contractSchema.safeParse({ ...validContract, end_date: '2026-06-30' }).success).toBe(false);
    expect(renewalSchema.safeParse({ new_start: '2028-07-01', new_end: '2028-06-30', new_amount: 13000 }).success).toBe(false);
  });
});

describe('short stay lease mode validation', () => {
  it('defaults to long-term leasing without a lease mode input', () => {
    const parsed = contractSchema.parse(validContract);
    expect(parsed.lease_mode).toBe('long_term');
    expect(parsed.daily_reference_rate).toBeNull();
  });

  it('accepts a short stay with a negotiated total and an optional reference daily rate', () => {
    const parsed = contractSchema.parse({
      ...validContract,
      lease_mode: 'short_stay',
      daily_reference_rate: 85.5,
    });
    expect(parsed.lease_mode).toBe('short_stay');
    expect(parsed.daily_reference_rate).toBe(85.5);
  });

  it('rejects a reference daily rate on a long-term contract', () => {
    const result = contractSchema.safeParse({
      ...validContract,
      lease_mode: 'long_term',
      daily_reference_rate: 85.5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('daily_reference_rate');
    }
  });

  it('rejects negative or over-precise reference daily rates', () => {
    expect(contractSchema.safeParse({ ...validContract, lease_mode: 'short_stay', daily_reference_rate: -5 }).success).toBe(false);
    expect(contractSchema.safeParse({ ...validContract, lease_mode: 'short_stay', daily_reference_rate: 85.0004 }).success).toBe(false);
  });

  it('rejects an unknown lease mode', () => {
    expect(contractSchema.safeParse({ ...validContract, lease_mode: 'hotel' as never }).success).toBe(false);
  });
});
