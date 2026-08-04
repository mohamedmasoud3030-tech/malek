import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommissionFormValues } from '../types';
import { archiveCommission, commissionPayload, createCommission, updateCommission } from './commissions-service';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
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

const commission = {
  id: 'commission-1',
  staff_name: 'وسيط 1',
  type: 'contract',
  status: 'pending',
  source_id: 'contract-1',
  deal_value: null,
  percentage: null,
  amount: 125.5,
  paid_at: null,
  expense_id: null,
  company_id: 'company-1',
  created_at: '2026-08-04T00:00:00Z',
  updated_at: '2026-08-04T00:00:00Z',
  staff_id: null,
};

beforeEach(() => {
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: { commission }, error: null });
});

describe('commissions service validation and trusted writes', () => {
  it('normalizes only operational fields and never emits lifecycle or ownership fields', () => {
    const payload = commissionPayload(baseValues);
    expect(payload).toEqual({
      staff_name: 'وسيط 1',
      type: 'contract',
      source_id: 'contract-1',
      deal_value: null,
      percentage: null,
      amount: 125.5,
    });
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('paid_at');
    expect(payload).not.toHaveProperty('expense_id');
    expect(payload).not.toHaveProperty('company_id');
  });

  it('derives positive commission amounts from deal value and percentage', () => {
    expect(commissionPayload({ ...baseValues, amount: '', deal_value: '1000', percentage: '2.5' })).toMatchObject({
      deal_value: 1000,
      percentage: 2.5,
      amount: 25,
    });
  });

  it('routes create through create_commission_atomic with pending-only semantics', async () => {
    await expect(createCommission(baseValues)).resolves.toMatchObject({ id: 'commission-1' });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [name, args] = rpcMock.mock.calls[0];
    expect(name).toBe('create_commission_atomic');
    expect(args.p_payload).toMatchObject({ staff_name: 'وسيط 1', type: 'contract', amount: 125.5 });
    expect(args.p_payload).toHaveProperty('request_id');
    expect(args.p_payload).not.toHaveProperty('status');
    expect(args.p_payload).not.toHaveProperty('company_id');
    await expect(createCommission({ ...baseValues, status: 'approved' })).rejects.toThrow('تُنشأ العمولة بحالة قيد المراجعة');
  });

  it('routes update and cancellation through their trusted RPCs', async () => {
    await updateCommission('commission-1', { ...baseValues, status: 'approved' });
    expect(rpcMock).toHaveBeenNthCalledWith(
      1,
      'update_commission_atomic',
      expect.objectContaining({
        p_payload: expect.objectContaining({
          commission_id: 'commission-1',
          requested_status: 'approved',
          staff_name: 'وسيط 1',
        }),
      }),
    );

    await archiveCommission('commission-1');
    expect(rpcMock).toHaveBeenNthCalledWith(
      2,
      'cancel_commission_atomic',
      expect.objectContaining({
        p_payload: expect.objectContaining({ commission_id: 'commission-1' }),
      }),
    );
  });

  it('rejects direct final-status edits and invalid numeric inputs before RPC calls', async () => {
    await expect(updateCommission('commission-1', { ...baseValues, status: 'cancelled' })).rejects.toThrow('استخدم إجراء الإلغاء');
    await expect(createCommission({ ...baseValues, amount: 'not-a-number' })).rejects.toThrow('مبلغ العمولة');
    await expect(createCommission({ ...baseValues, amount: '-1' })).rejects.toThrow('مبلغ العمولة');
    await expect(createCommission({ ...baseValues, amount: '0' })).rejects.toThrow('أدخل قيمة عمولة أكبر من صفر');
    await expect(createCommission({ ...baseValues, amount: '', deal_value: '1000', percentage: '101' })).rejects.toThrow('نسبة العمولة');
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
