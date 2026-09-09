import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createExpenseWithJournal, updateExpense } from './expenseService';

const mocks = vi.hoisted(() => {
  const returns = vi.fn();
  const maybeSingle = vi.fn(() => ({ returns }));
  const is = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ is }));
  const select = vi.fn(() => ({ eq }));
  return {
    rpc: vi.fn(),
    from: vi.fn(() => ({ select })),
    select,
    eq,
    is,
    maybeSingle,
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
    mocks.rpc.mockImplementation(
      (_fn: string, { p_payload }: { p_payload: { request_id: string } }) =>
        Promise.resolve({
          data: {
            success: true,
            expense_id: 'expense-1',
            request_id: p_payload.request_id,
            idempotent: false,
          },
          error: null,
        }),
    );
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
  it.each([null, {}, { success: false }, { success: true }])(
    'rejects incomplete creation and update acknowledgements (%j)',
    async (data) => {
      mocks.rpc.mockResolvedValue({ data, error: null });
      await expect(
        createExpenseWithJournal({
          propertyId: 'property-1',
          category: 'صيانة',
          amount: 20,
          expenseDate: '2026-09-01',
        }),
      ).rejects.toThrow();
      await expect(
        updateExpense('expense-1', {
          property_id: 'property-1',
          category: 'صيانة',
          amount: 20,
          expense_date: '2026-09-01',
          description: null,
        }),
      ).rejects.toThrow();
      expect(mocks.returns).not.toHaveBeenCalled();
    },
  );

  it('rejects acknowledgements for a different command or expense', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        success: true,
        expense_id: 'other-expense',
        expense_no: 'EXP-1',
        request_id: 'other-request',
        idempotent: false,
      },
      error: null,
    });
    await expect(
      createExpenseWithJournal({
        propertyId: 'property-1',
        category: 'صيانة',
        amount: 20,
        expenseDate: '2026-09-01',
        requestId: 'expected-request',
      }),
    ).rejects.toThrow('request mismatch');
    await expect(
      updateExpense('expense-1', {
        property_id: 'property-1',
        category: 'صيانة',
        amount: 20,
        expense_date: '2026-09-01',
        description: null,
      }),
    ).rejects.toThrow('scope mismatch');
    expect(mocks.returns).not.toHaveBeenCalled();
  });
});
