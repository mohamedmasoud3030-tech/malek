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
    })).rejects.toThrow('Bank statement line is already processed.');
  });
});
