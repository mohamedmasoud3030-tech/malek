import { beforeEach, describe, expect, it, vi } from 'vitest';

function createQueryMock(result: unknown) {
  const chain = {
    eq: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    returns: vi.fn(() => Promise.resolve(result)),
    select: vi.fn(() => chain),
    single: vi.fn(() => ({ ...chain, returns: vi.fn(() => Promise.resolve(result)) })),
    update: vi.fn(() => chain),
  };

  return chain;
}

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

describe('maintenance service failure and mutation boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws list failures instead of returning an empty success state', async () => {
    const chain = createQueryMock({ data: null, error: new Error('maintenance table unavailable') });
    supabaseMock.from.mockReturnValue(chain);
    const { listMaintenance } = await import('./maintenance-service');

    await expect(listMaintenance('all', '')).rejects.toThrow('maintenance table unavailable');
    expect(supabaseMock.from).toHaveBeenCalledWith('maintenance_records');
  });

  it('throws create failures so the mutation does not report success', async () => {
    const chain = createQueryMock({ data: null, error: new Error('insert rejected') });
    supabaseMock.from.mockReturnValue(chain);
    const { createMaintenance } = await import('./maintenance-service');

    await expect(createMaintenance({ property_id: 'property-1', title: 'Test', priority: 'medium', status: 'open', cost: 0 })).rejects.toThrow('insert rejected');
  });

  it('updates only non-financial request fields', async () => {
    const chain = createQueryMock({ data: { id: 'maintenance-1' }, error: null });
    supabaseMock.from.mockReturnValue(chain);
    const { updateMaintenance } = await import('./maintenance-service');

    await updateMaintenance('maintenance-1', {
      title: 'إصلاح المضخة',
      priority: 'high',
      assigned_to: 'فني الاختبار',
      scheduled_date: '2026-07-14',
    });

    expect(chain.update).toHaveBeenCalledWith({
      title: 'إصلاح المضخة',
      priority: 'high',
      assigned_to: 'فني الاختبار',
      scheduled_date: '2026-07-14',
    });
  });

  it('rejects direct status updates to resolved — must go through resolveMaintenanceWithExpense', async () => {
    const { updateMaintenanceStatus } = await import('./maintenance-service');
    await expect(updateMaintenanceStatus('maintenance-1', 'resolved')).rejects.toThrow('resolveMaintenanceWithExpense');
  });

  it('sets resolved_at only for the closed status, not in_progress', async () => {
    const chain = createQueryMock({ data: { id: 'maintenance-1' }, error: null });
    supabaseMock.from.mockReturnValue(chain);
    const { updateMaintenanceStatus } = await import('./maintenance-service');

    await updateMaintenanceStatus('maintenance-1', 'closed');
    expect(chain.update).toHaveBeenCalledWith({ status: 'closed', resolved_at: expect.any(String) });

    await updateMaintenanceStatus('maintenance-1', 'in_progress');
    expect(chain.update).toHaveBeenLastCalledWith({ status: 'in_progress', resolved_at: null });
  });

  it('resolves a maintenance request and records the linked expense via the atomic RPC', async () => {
    const result = { maintenance: { id: 'maintenance-1', status: 'resolved', cost: 250 }, expense_id: 'expense-9' };
    supabaseMock.rpc.mockReturnValue({ single: vi.fn(() => Promise.resolve({ data: result, error: null })) });
    const { resolveMaintenanceWithExpense } = await import('./maintenance-service');

    const outcome = await resolveMaintenanceWithExpense('maintenance-1', 250, 'تم استبدال المضخة');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('resolve_maintenance_with_expense', {
      p_request_id: 'maintenance-1',
      p_cost: 250,
      p_notes: 'تم استبدال المضخة',
    });
    expect(outcome).toEqual(result);
  });

  it('throws when the resolve RPC returns an error instead of silently succeeding', async () => {
    supabaseMock.rpc.mockReturnValue({ single: vi.fn(() => Promise.resolve({ data: null, error: new Error('duplicate resolve') })) });
    const { resolveMaintenanceWithExpense } = await import('./maintenance-service');

    await expect(resolveMaintenanceWithExpense('maintenance-1', 100, null)).rejects.toThrow('duplicate resolve');
  });
});
