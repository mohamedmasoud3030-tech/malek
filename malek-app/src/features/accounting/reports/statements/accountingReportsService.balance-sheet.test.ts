import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));

describe('balance sheet section normalization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies the same row mapping to assets, liabilities, and equity without changing totals', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: {
        assets: [{ code: ' 100 ', name: ' Cash ', amount: 100.125 }],
        liabilities: [{ code: ' 200 ', name: ' Payable ', amount: 40 }],
        equity: [{ code: ' 300 ', name: ' Capital ', amount: 60.125 }],
      },
      error: null,
    });

    const { getBalanceSheetReport } = await import('./accountingReportsService');
    const report = await getBalanceSheetReport('2026-08-31');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('rpt_balance_sheet', { p_as_of: '2026-08-31' });
    expect(report).toEqual({
      asOf: '2026-08-31',
      assets: [{ code: '100', name: 'Cash', amount: 100.125 }],
      totalAssets: 100.125,
      liabilities: [{ code: '200', name: 'Payable', amount: 40 }],
      totalLiabilities: 40,
      equity: [{ code: '300', name: 'Capital', amount: 60.125 }],
      totalEquity: 60.125,
      isBalanced: true,
    });
  });
});
