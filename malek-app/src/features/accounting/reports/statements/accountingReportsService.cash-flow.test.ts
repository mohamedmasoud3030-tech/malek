import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

describe('GL-backed cash flow authority (accountingReportsService)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads cash flow from the canonical rpt_cash_flow_gl boundary and preserves its reconciliation fields', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: {
        period: { from: '2026-08-01', to: '2026-08-31' },
        opening_cash: 100.125,
        operating: 25.25,
        investing: -10,
        financing: 5,
        unclassified: 0,
        total_change: 20.25,
        closing_cash: 120.375,
        variance: 0,
        is_balanced: true,
        currency: 'OMR',
      },
      error: null,
    });

    const { getCashFlowReport } = await import('./accountingReportsService');
    const report = await getCashFlowReport('2026-08-01', '2026-08-31');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('rpt_cash_flow_gl', {
      p_from: '2026-08-01',
      p_to: '2026-08-31',
    });
    expect(report).toEqual({
      period: { from: '2026-08-01', to: '2026-08-31' },
      openingCash: 100.125,
      operating: 25.25,
      investing: -10,
      financing: 5,
      unclassified: 0,
      totalChange: 20.25,
      closingCash: 120.375,
      variance: 0,
      isBalanced: true,
      currency: 'OMR',
    });
  });

  it('fails closed when the authoritative GL cash-flow RPC fails', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'cash-flow authority unavailable' },
    });

    const { getCashFlowReport } = await import('./accountingReportsService');
    await expect(getCashFlowReport('2026-08-01', '2026-08-31')).rejects.toEqual({
      message: 'cash-flow authority unavailable',
    });
  });
});
