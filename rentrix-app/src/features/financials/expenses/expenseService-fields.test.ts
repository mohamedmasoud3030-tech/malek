import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateExpense } from './expenseService';

const mocks = vi.hoisted(() => {
  const returns = vi.fn();
  const single = vi.fn(() => ({ returns }));
  const is = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ is }));
  const select = vi.fn(() => ({ eq }));
  return {
    rpc: vi.fn(),
    from: vi.fn(() => ({ select })),
    select,
    eq,
    is,
    single,
    returns,
    handleSupabaseError: vi.fn(),
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
}));

vi.mock('@/lib/supabase-error', () => ({
  handleSupabaseError: mocks.handleSupabaseError,
}));

describe('expense atomic update field contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: { success: true }, error: null });
    mocks.returns.mockResolvedValue({
      data: {
        id: 'expense-1',
        property_id: 'text-property-id',
        category: 'صيانة',
        amount: 75,
        expense_date: '2026-07-20',
        description: 'updated',
      },
      error: null,
    });
  });

  it('submits every editable field instead of silently dropping metadata', async () => {
    await updateExpense('expense-1', {
      property_id: 'text-property-id',
      category: 'صيانة',
      amount: 75,
      expense_date: '2026-07-20',
      cost_center_id: 'cost-center-1',
      contract_id: 'contract-1',
      charged_to: 'OWNER',
      description: 'updated',
      attachment_url: 'https://example.com/file.pdf',
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      'update_expense_with_journal_atomic',
      {
        p_payload: expect.objectContaining({
          expense_id: 'expense-1',
          property_id: 'text-property-id',
          category: 'صيانة',
          amount: 75,
          expense_date: '2026-07-20',
          cost_center_id: 'cost-center-1',
          contract_id: 'contract-1',
          charged_to: 'OWNER',
          description: 'updated',
          attachment_url: 'https://example.com/file.pdf',
        }),
      },
    );
  });
});
