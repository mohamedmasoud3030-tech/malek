import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

describe('dashboard service database aggregation boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads dashboard overview through the database aggregation RPC only', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: {
        financial: {
          total_collected: '100',
          total_overdue_invoices: 25,
          total_expenses: null,
          net_revenue: '75',
        },
        operational: {
          properties: 2,
          units: '10',
          activeContracts: 5,
          expiringContracts30Days: 1,
          vacantUnits: 3,
          overdueInvoices: 4,
        },
      },
      error: null,
    });

    const { getDashboardOverview } = await import('./dashboard-service');
    await expect(getDashboardOverview(new Date(2026, 6, 11))).resolves.toEqual({
      financial: {
        total_collected: 100,
        total_overdue_invoices: 25,
        total_expenses: 0,
        net_revenue: 75,
      },
      operational: {
        properties: 2,
        units: 10,
        activeContracts: 5,
        expiringContracts30Days: 1,
        vacantUnits: 3,
        overdueInvoices: 4,
      },
    });

    expect(supabaseMock.rpc).toHaveBeenCalledWith('rpt_dashboard_overview', {
      p_from: '2026-07-01',
      p_to: '2026-07-31',
      p_as_of: '2026-07-11',
    });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
