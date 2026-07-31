import { describe, expect, it } from 'vitest';
import { depositDeductionBalanceSchema, depositDeductionPayloadSchema, depositPayloadSchema } from './deposit-schema';

const id = '00000000-0000-4000-8000-000000000001';
const deduction = { deposit_id: id, deduction_amount: 25, reason: 'other' as const, description: 'charge', charged_date: '2026-08-01' };

describe('deposit schema', () => {
  it('rejects a zero deposit or deduction amount', () => {
    expect(() => depositPayloadSchema.parse({ contract_id: id, amount: 0 })).toThrow();
    expect(() => depositDeductionPayloadSchema.parse({ ...deduction, deduction_amount: 0 })).toThrow();
  });

  it('rejects a deduction greater than the authoritative remaining balance', () => {
    expect(() => depositDeductionBalanceSchema.parse({ ...deduction, remaining_amount: 20, archived: false })).toThrow(/يتجاوز/);
  });

  it('rejects an archived deposit', () => {
    expect(() => depositDeductionBalanceSchema.parse({ ...deduction, remaining_amount: 25, archived: true })).toThrow(/مؤرشفة/);
  });
});
