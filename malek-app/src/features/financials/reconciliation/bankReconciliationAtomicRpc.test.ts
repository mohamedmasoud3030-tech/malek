import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

describe('bank reconciliation atomic RPC service boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses process_bank_reconciliation_match_atomic instead of split insert/update calls', async () => {
    const match = {
      id: 'match-1',
      statement_line_id: 'line-1',
      matched_entity_type: 'payment' as const,
      matched_entity_id: 'payment-1',
      matched_amount: 250,
      notes: 'مطابقة',
      matched_at: '2026-07-11T00:00:00Z',
      matched_by: 'user-1',
    };
    const returns = vi.fn().mockResolvedValue({ data: match, error: null });
    supabaseMock.rpc.mockReturnValue({ returns });

    const { matchBankStatementLine } = await import('./bankReconciliationService');

    await expect(matchBankStatementLine({
      statement_line_id: ' line-1 ',
      matched_entity_type: 'payment',
      matched_entity_id: ' payment-1 ',
      matched_amount: '250',
      notes: ' مطابقة ',
    })).resolves.toEqual(match);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('process_bank_reconciliation_match_atomic', {
      payload: {
        statement_line_id: 'line-1',
        matched_entity_type: 'payment',
        matched_entity_id: 'payment-1',
        matched_amount: 250,
        notes: 'مطابقة',
      },
    });
    expect(returns).toHaveBeenCalledTimes(1);
    expect(supabaseMock.from).not.toHaveBeenCalledWith('bank_reconciliation_matches');
    expect(supabaseMock.from).not.toHaveBeenCalledWith('bank_statement_lines');
  });

  it('does not hide atomic rollback errors from the RPC', async () => {
    const returns = vi.fn().mockResolvedValue({ data: null, error: new Error('Bank statement line is already processed.') });
    supabaseMock.rpc.mockReturnValue({ returns });

    const { matchBankStatementLine } = await import('./bankReconciliationService');

    await expect(matchBankStatementLine({
      statement_line_id: 'line-1',
      matched_entity_type: 'payment',
      matched_entity_id: 'payment-1',
      matched_amount: '250',
      notes: '',
    })).rejects.toThrow('تعذر تسجيل المطابقة البنكية');
  });

  it('creates a manual statement line through the governed RPC, never a direct table insert', async () => {
    const line = {
      id: 'line-2',
      company_id: 'company-1',
      bank_account_id: 'bank-1',
      transaction_date: '2026-08-21',
      description: 'manual line',
      amount: 42.5,
      status: 'unmatched',
    };
    supabaseMock.rpc.mockResolvedValue({ data: line, error: null });

    const { createBankStatementLine } = await import('./bankReconciliationService');

    await expect(createBankStatementLine({
      bank_account_id: 'bank-1',
      transaction_date: '2026-08-21',
      description: 'manual line',
      reference: '',
      amount: '42.5',
    })).resolves.toEqual(line);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_bank_statement_line_governed', {
      payload: {
        bank_account_id: 'bank-1',
        transaction_date: '2026-08-21',
        description: 'manual line',
        reference: undefined,
        amount: 42.5,
      },
    });
    expect(supabaseMock.from).not.toHaveBeenCalledWith('bank_statement_lines');
  });

  it('ignores a statement line through the governed RPC, never a direct table update', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });

    const { ignoreBankStatementLine } = await import('./bankReconciliationService');

    await expect(ignoreBankStatementLine('line-3')).resolves.toBeUndefined();

    expect(supabaseMock.rpc).toHaveBeenCalledWith('ignore_bank_statement_line_governed', {
      p_statement_line_id: 'line-3',
    });
    expect(supabaseMock.from).not.toHaveBeenCalledWith('bank_statement_lines');
  });

  it('does not hide governed create/ignore errors from the RPC', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: new Error('BANK_LINE_MATCHED_CANNOT_BE_IGNORED') });

    const { ignoreBankStatementLine } = await import('./bankReconciliationService');
    await expect(ignoreBankStatementLine('line-4')).rejects.toThrow('تعذر تجاهل حركة كشف البنك');
  });
});
