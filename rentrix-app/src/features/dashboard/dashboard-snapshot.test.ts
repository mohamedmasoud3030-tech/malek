import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDashboardPeriod,
  normalizeDashboardSnapshot,
} from './dashboard-snapshot';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

const period = createDashboardPeriod(new Date(2026, 4, 18));

describe('dashboard snapshot (R1 authoritative read model)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the current dashboard month period from a date', () => {
    expect(period).toEqual({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-18',
      asOf: '2026-05-18',
      month: 5,
      year: 2026,
    });
  });

  it('normalizes a full server snapshot without recomputing any KPI', () => {
    const snapshot = normalizeDashboardSnapshot({
      meta: { from: '2026-05-01', to: '2026-05-18', as_of: '2026-05-18', source: 'rpt_dashboard_snapshot' },
      portfolio: { properties: 2, units: '8' },
      occupancy: { occupied_units: 5, vacant_units: 3, occupancy_rate: 63 },
      contracts: { active: 4, expiring_30: 1, expiring_60: 2, expiring_90: 3 },
      billing: { invoiced_amount: '1000.500', invoices_count: 4, invoices_total_count: 40 },
      collections: { collected_amount: 650.25, payments_count: 3, outstanding_amount: 350.25, collection_rate: 65 },
      expenses: { total_amount: 125, count: 2 },
      net_cash: 525.25,
      arrears: {
        total_overdue: 300,
        overdue_count: 2,
        average_days_overdue: 17,
        over_90_amount: 50,
        over_90_count: 1,
        total_outstanding: 350.25,
        buckets: {
          current: { total: 50.25, count: 1 },
          days_1_30: { total: 250, count: 1 },
          days_31_60: { total: 0, count: 0 },
          days_61_90: { total: 0, count: 0 },
          days_90_plus: { total: 50, count: 1 },
        },
      },
      owner_funds: { net_payable: 420.125, settlements_draft: 1, settlements_approved: 2 },
      maintenance: { open: 3, in_progress: 1, urgent_open: 2 },
      exceptions: { unmatched_bank_lines: 5, pending_settlements: 3 },
      queues: {
        expiring_contracts: [{
          id: 'contract-1', reference: 'CON-1', end_date: '2026-06-01', days_remaining: 14,
          tenant_name: 'Tenant', property_title: 'Property', unit_number: '101',
        }],
        overdue_invoices: [{
          invoice_id: 'invoice-1', reference: 'INV-1', due_date: '2026-05-01', days_overdue: 17,
          remaining_amount: 300, tenant_name: 'Tenant', property_title: 'Property', unit_number: '101',
        }],
        urgent_maintenance: [{
          id: 'maintenance-1', title: 'Leak', priority: 'urgent', property_title: 'Property', unit_number: '101',
        }],
      },
    }, period);

    expect(snapshot.portfolio).toEqual({ properties: 2, units: 8 });
    expect(snapshot.occupancy).toEqual({ occupiedUnits: 5, vacantUnits: 3, occupancyRate: 63 });
    expect(snapshot.contracts).toEqual({ active: 4, expiring30: 1, expiring60: 2, expiring90: 3 });
    expect(snapshot.billing).toEqual({ invoicedAmount: 1000.5, invoicesCount: 4, invoicesTotalCount: 40 });
    expect(snapshot.collections).toEqual({ collectedAmount: 650.25, paymentsCount: 3, outstandingAmount: 350.25, collectionRate: 65 });
    expect(snapshot.expenses).toEqual({ totalAmount: 125, count: 2 });
    expect(snapshot.netCash).toBe(525.25);
    expect(snapshot.arrears.totalOverdue).toBe(300);
    expect(snapshot.arrears.buckets.days_90_plus).toEqual({ total: 50, count: 1 });
    expect(snapshot.ownerFunds).toEqual({ netPayable: 420.125, settlementsDraft: 1, settlementsApproved: 2 });
    expect(snapshot.maintenance).toEqual({ open: 3, inProgress: 1, urgentOpen: 2 });
    expect(snapshot.exceptions).toEqual({ unmatchedBankLines: 5, pendingSettlements: 3 });
    expect(snapshot.queues.expiringContracts).toEqual([{
      id: 'contract-1', reference: 'CON-1', endDate: '2026-06-01', daysRemaining: 14,
      tenantName: 'Tenant', propertyTitle: 'Property', unitNumber: '101',
    }]);
    expect(snapshot.queues.overdueInvoices[0]?.remainingAmount).toBe(300);
    expect(snapshot.queues.urgentMaintenance[0]?.title).toBe('Leak');
    expect(snapshot.period).toEqual(period);
  });

  it('normalizes a degenerate payload to honest zeros and empty queues (never crashes)', () => {
    const snapshot = normalizeDashboardSnapshot(null, period);
    expect(snapshot.portfolio).toEqual({ properties: 0, units: 0 });
    expect(snapshot.arrears.buckets.current).toEqual({ total: 0, count: 0 });
    expect(snapshot.queues).toEqual({ expiringContracts: [], overdueInvoices: [], urgentMaintenance: [] });
  });

  it('loads the snapshot through the authoritative RPC only — no table reads', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: {}, error: null });
    const { getDashboardSnapshot } = await import('./dashboard-snapshot');
    await getDashboardSnapshot(new Date(2026, 6, 11));

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('rpt_dashboard_snapshot', {
      p_from: '2026-07-01',
      p_to: '2026-07-11',
      p_as_of: '2026-07-11',
    });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('propagates the RPC error instead of fabricating zeros', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: new Error('boom') });
    const { getDashboardSnapshot } = await import('./dashboard-snapshot');
    await expect(getDashboardSnapshot(new Date(2026, 6, 11))).rejects.toThrow('boom');
  });
});
