import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  executeFixedMonthlyAccruals,
  listFixedMonthlyAccruals,
  reverseFixedMonthlyAccrual,
} from './fixed-monthly-accrual-service';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  handleSupabaseError: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/lib/supabase-error', () => ({ handleSupabaseError: mocks.handleSupabaseError }));

describe('fixed monthly daily accrual service boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists governed source, posting and reversal fields through the read RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        date_from: '2024-02-01',
        date_to: '2024-02-29',
        total_count: 1,
        returned_count: 1,
        truncated: false,
        net_amount: '3.448',
        tax_amount: '0.000',
        gross_amount: '3.448',
        reversed_count: 1,
        tax_authority_status: 'OUT_OF_SCOPE_NO_VERSIONED_AUTHORITY',
        accruals: [{
          id: 'accrual-1',
          owner_agreement_id: 'agreement-1',
          agreement_version_id: 'version-1',
          version_no: 2,
          owner_name: 'المالك',
          property_name: 'العقار',
          accrual_date: '2024-02-29',
          monthly_contract_amount: '100.000000',
          monthly_amount_omr: '100.000',
          net_amount: '3.448',
          tax_amount: '0.000',
          gross_amount: '3.448',
          tax_authority_status: 'OUT_OF_SCOPE_NO_VERSIONED_AUTHORITY',
          status: 'REVERSED',
          journal_batch_id: 'batch-1',
          accounting_period_id: 'period-1',
          posting_date: '2024-02-29',
          period_resolution_reason: 'EFFECTIVE_PERIOD_OPEN',
          late_posting: false,
          reversal_id: 'reversal-1',
          reversal_journal_batch_id: 'batch-2',
          reversal_reason: 'تصحيح المصدر',
          reversed_at: '2024-03-01T00:00:00Z',
        }],
      },
      error: null,
    });

    const result = await listFixedMonthlyAccruals('2024-02-01', '2024-02-29');

    expect(mocks.rpc).toHaveBeenCalledWith('list_fixed_monthly_accruals', {
      p_payload: { date_from: '2024-02-01', date_to: '2024-02-29' },
    });
    expect(result).toMatchObject({
      totalCount: 1,
      netAmount: 3.448,
      taxAmount: 0,
      reversedCount: 1,
      taxAuthorityStatus: 'OUT_OF_SCOPE_NO_VERSIONED_AUTHORITY',
    });
    expect(result.accruals[0]).toMatchObject({
      id: 'accrual-1',
      agreementVersionId: 'version-1',
      accrualDate: '2024-02-29',
      netAmount: 3.448,
      status: 'REVERSED',
      reversalBatchId: 'batch-2',
    });
  });

  it('executes with orchestration inputs only and never browser-authored financial data', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        date_from: '2024-03-01',
        date_to: '2024-03-10',
        attempted_days: 10,
        created_days: 8,
        idempotent_days: 2,
        already_reversed_days: 0,
        zero_amount_days: 0,
        net_amount: '10.000',
        tax_amount: '0.000',
        gross_amount: '10.000',
      },
      error: null,
    });

    const result = await executeFixedMonthlyAccruals(
      '2024-03-01',
      '2024-03-10',
      'request-1',
    );

    expect(mocks.rpc).toHaveBeenCalledWith('execute_fixed_monthly_accruals_atomic', {
      p_payload: {
        request_id: 'request-1',
        date_from: '2024-03-01',
        date_to: '2024-03-10',
      },
    });
    const payload = mocks.rpc.mock.calls[0]?.[1]?.p_payload;
    expect(payload).not.toHaveProperty('company_id');
    expect(payload).not.toHaveProperty('net_amount');
    expect(payload).not.toHaveProperty('tax_amount');
    expect(payload).not.toHaveProperty('journal_lines');
    expect(result).toMatchObject({ createdDays: 8, idempotentDays: 2, grossAmount: 10 });
  });

  it('requests an explicit compensating reversal without mutating the ledger', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        accrual_id: 'accrual-1',
        reversal_id: 'reversal-1',
        original_batch_id: 'batch-1',
        reversal_batch_id: 'batch-2',
        idempotent: false,
      },
      error: null,
    });

    const result = await reverseFixedMonthlyAccrual(
      'accrual-1',
      'تصحيح تاريخ السريان',
      'request-2',
    );

    expect(mocks.rpc).toHaveBeenCalledWith('reverse_fixed_monthly_accrual_atomic', {
      p_payload: {
        request_id: 'request-2',
        accrual_id: 'accrual-1',
        reason: 'تصحيح تاريخ السريان',
      },
    });
    expect(result).toEqual({
      accrualId: 'accrual-1',
      reversalId: 'reversal-1',
      originalBatchId: 'batch-1',
      reversalBatchId: 'batch-2',
      idempotent: false,
    });
  });

  it('routes RPC failures through the actionable shared error mapping and rethrows', async () => {
    const rpcError = new Error('FIXED_MONTHLY_CATCHUP_LIMIT_EXCEEDED');
    mocks.rpc.mockResolvedValueOnce({ data: null, error: rpcError });

    await expect(executeFixedMonthlyAccruals(
      '2024-01-01',
      '2024-05-01',
      'request-3',
    )).rejects.toBe(rpcError);
    expect(mocks.handleSupabaseError).toHaveBeenCalledWith(
      rpcError,
      'تعذر تنفيذ استحقاقات العمولة الشهرية',
    );
  });
});
