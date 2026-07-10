import { describe, expect, it, vi } from 'vitest';
import type { CommissionFormValues } from '../types';
import { commissionPayload, createCommission } from './commissions-service';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: () => ({ returns: async () => ({ data: null, error: null }) }) }) }),
    }),
  },
}));

const baseValues: CommissionFormValues = {
  staff_name: ' وسيط 1 ',
  type: 'contract',
  status: 'pending',
  source_id: ' contract-1 ',
  deal_value: '',
  percentage: '',
  amount: '125.500',
};

describe('commissions service validation', () => {
  it('normalizes commission payloads and preserves positive direct amounts', () => {
    expect(commissionPayload(baseValues)).toMatchObject({
      staff_name: 'وسيط 1',
      type: 'contract',
      status: 'pending',
      source_id: 'contract-1',
      deal_value: null,
      percentage: null,
      amount: 125.5,
      paid_at: null,
    });
  });

  it('derives positive commission amounts from deal value and percentage', () => {
    expect(commissionPayload({ ...baseValues, amount: '', deal_value: '1000', percentage: '2.5' })).toMatchObject({
      deal_value: 1000,
      percentage: 2.5,
      amount: 25,
    });
  });

  it('rejects NaN, negative, zero, and over-100 percentage commission inputs before writes', async () => {
    await expect(createCommission({ ...baseValues, amount: 'not-a-number' })).rejects.toThrow('مبلغ العمولة');
    await expect(createCommission({ ...baseValues, amount: '-1' })).rejects.toThrow('مبلغ العمولة');
    await expect(createCommission({ ...baseValues, amount: '0' })).rejects.toThrow('أدخل قيمة عمولة أكبر من صفر');
    await expect(createCommission({ ...baseValues, amount: '', deal_value: '1000', percentage: '101' })).rejects.toThrow('نسبة العمولة');
  });
});
