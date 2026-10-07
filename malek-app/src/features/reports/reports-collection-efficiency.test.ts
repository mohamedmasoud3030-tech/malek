import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

import { getAuthoritativeReportsCollectionRate } from './reports-collection-efficiency';

describe('getAuthoritativeReportsCollectionRate', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('reads the server-authoritative cohort rate without recomputing from period cash', async () => {
    rpcMock.mockResolvedValue({
      data: {
        collections: {
          collected_amount: 300,
          collection_rate: 76,
        },
      },
      error: null,
    });

    await expect(getAuthoritativeReportsCollectionRate({ from: '2026-08-01', to: '2026-08-31' })).resolves.toBe(76);
    expect(rpcMock).toHaveBeenCalledWith('rpt_dashboard_snapshot', {
      p_from: '2026-08-01',
      p_to: '2026-08-31',
      p_as_of: '2026-08-31',
    });
  });

  it('fails closed when the authoritative value is missing, null, or invalid', async () => {
    for (const value of [undefined, null, 101]) {
      rpcMock.mockResolvedValueOnce({ data: { collections: { collection_rate: value } }, error: null });
      await expect(getAuthoritativeReportsCollectionRate({ from: '2026-08-01', to: '2026-08-31' }))
        .rejects.toThrow(/كفاءة التحصيل المعتمدة/);
    }
  });

  it('propagates the RPC failure instead of fabricating a zero', async () => {
    const failure = new Error('snapshot unavailable');
    rpcMock.mockResolvedValue({ data: null, error: failure });

    await expect(getAuthoritativeReportsCollectionRate({ from: '2026-08-01', to: '2026-08-31' }))
      .rejects.toBe(failure);
  });
});
