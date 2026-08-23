import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

describe('WP05 GL-backed cash flow authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads cash flow from wp05_rpt_cash_flow_gl and preserves its reconciliation fields', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: {
        period: { from: '2026-08-01', to: '2026-08-31' },
        opening_cash: '100.125',
        operating: '25.250',
        investing: '-10.000',
        financing: '5.000',
        unclassified: '0.000',
        total_change: '20.250',
        closing_cash: '120.375',
        variance: '0.000',
        is_balanced: true,
        currency: 'OMR',
      },
      error: null,
    });

    const { getCashFlowReport } = await import('./wp05Services');
    const report = await getCashFlowReport('2026-08-01', '2026-08-31');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('wp05_rpt_cash_flow_gl', {
      p_from: '2026-08-01',
      p_to: '2026-08-31',
    });
    expect(report).toEqual({
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
    });
  });

  it('fails closed when the authoritative GL cash-flow RPC fails', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'cash-flow authority unavailable' },
    });

    const { getCashFlowReport } = await import('./wp05Services');
    await expect(getCashFlowReport('2026-08-01', '2026-08-31')).rejects.toEqual({
      message: 'cash-flow authority unavailable',
    });
  });
});
