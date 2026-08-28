import { beforeEach, describe, expect, it, vi } from 'vitest';

function createQueryMock(result: unknown) {
  const chain = {
    eq: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    in: vi.fn(() => chain),
    range: vi.fn(() => Promise.resolve(result)),
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

    await expect(listMaintenance('all', '')).rejects.toThrow('تعذر تحميل طلبات الصيانة');
    expect(supabaseMock.from).toHaveBeenCalledWith('maintenance_records');
  });

  it('routes create through the atomic RPC and never touches the raw insert path', async () => {
    const rpcChain = { single: vi.fn(() => Promise.resolve({ data: null, error: new Error('insert rejected') })) };
    supabaseMock.rpc.mockReturnValue(rpcChain);
    const { createMaintenance } = await import('./maintenance-service');

    await expect(createMaintenance({
      property_id: 'property-1',
      title: 'Test',
      priority: 'medium',
      service_provider_category_id: '10000000-0000-4000-8000-000000000001',
      service_provider_id: '10000000-0000-4000-8000-000000000002',
    })).rejects.toThrow('تعذر إنشاء طلب الصيانة');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_maintenance_atomic', expect.objectContaining({
      p_property_id: 'property-1',
      p_title: 'Test',
      p_priority: 'medium',
      p_service_provider_category_id: '10000000-0000-4000-8000-000000000001',
      p_service_provider_id: '10000000-0000-4000-8000-000000000002',
      p_request_id: expect.any(String),
    }));
    // Raw insert path must never be reached.
    expect(supabaseMock.from).not.toHaveBeenCalledWith('maintenance_records');
  });

  it('returns the typed maintenance row from the atomic RPC', async () => {
    const maintenanceRow = { id: 'maintenance-1', title: 'إصلاح', status: 'open' };
    supabaseMock.rpc.mockReturnValue({ single: vi.fn(() => Promise.resolve({ data: { maintenance: maintenanceRow, idempotent: false }, error: null })) });
    const { createMaintenance } = await import('./maintenance-service');

    const result = await createMaintenance({ property_id: 'property-1', title: 'إصلاح', priority: 'low' });
    expect(result).toEqual(maintenanceRow);
  });

  it('throws when the atomic RPC returns no maintenance payload', async () => {
    supabaseMock.rpc.mockReturnValue({ single: vi.fn(() => Promise.resolve({ data: { maintenance: null, idempotent: false }, error: null })) });
    const { createMaintenance } = await import('./maintenance-service');

    await expect(createMaintenance({ property_id: 'property-1', title: 'إصلاح', priority: 'low' })).rejects.toThrow(/استجابة الخادم/);
  });

  it('updates only non-financial request fields', async () => {
    const chain = createQueryMock({ data: { id: 'maintenance-1' }, error: null });
    supabaseMock.from.mockReturnValue(chain);
    const { updateMaintenance } = await import('./maintenance-service');

    await updateMaintenance('maintenance-1', {
      title: 'إصلاح المضخة',
      service_provider_category_id: '10000000-0000-4000-8000-000000000001',
      service_provider_id: '10000000-0000-4000-8000-000000000002',
      priority: 'high',
      assigned_to: 'فني الاختبار',
      scheduled_date: '2026-07-14',
    });

    expect(chain.update).toHaveBeenCalledWith({
      title: 'إصلاح المضخة',
      service_provider_category_id: '10000000-0000-4000-8000-000000000001',
      service_provider_id: '10000000-0000-4000-8000-000000000002',
      priority: 'high',
      assigned_to: 'فني الاختبار',
      scheduled_date: '2026-07-14',
    });
  });

  it('routes technical completion through the server transition command', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { id: 'maintenance-1', status: 'resolved' }, error: null });
    const { updateMaintenanceStatus } = await import('./maintenance-service');
    await expect(updateMaintenanceStatus('maintenance-1', 'resolved')).resolves.toMatchObject({ status: 'resolved' });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('transition_maintenance_status_atomic', {
      p_request_id: 'maintenance-1', p_next_status: 'resolved', p_reason: null,
    });
  });

  it('routes every status transition through the R8 server command (no raw updates)', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { id: 'maintenance-1', status: 'closed' }, error: null });
    const { updateMaintenanceStatus } = await import('./maintenance-service');

    await updateMaintenanceStatus('maintenance-1', 'closed');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('transition_maintenance_status_atomic', {
      p_request_id: 'maintenance-1',
      p_next_status: 'closed',
      p_reason: null,
    });

    await updateMaintenanceStatus('maintenance-1', 'cancelled', 'سبب الإلغاء');
    expect(supabaseMock.rpc).toHaveBeenLastCalledWith('transition_maintenance_status_atomic', {
      p_request_id: 'maintenance-1',
      p_next_status: 'cancelled',
      p_reason: 'سبب الإلغاء',
    });
    // Never a raw table update for status.
    expect(supabaseMock.from).not.toHaveBeenCalledWith('maintenance_records');
  });

  it('closes a completed request only through the verified closure RPC', async () => {
    const result = { maintenance: { id: 'maintenance-1', status: 'closed', cost: 250 }, expense_id: null };
    supabaseMock.rpc.mockReturnValue({ single: vi.fn(() => Promise.resolve({ data: result, error: null })) });
    const { closeMaintenanceWithExpense } = await import('./maintenance-service');

    const outcome = await closeMaintenanceWithExpense({ requestId: 'maintenance-1', cost: 250, chargedTo: 'OWNER', notes: 'تم استبدال المضخة', evidenceUrl: 'https://example.test/invoice', confirmed: true });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('close_maintenance_with_expense', {
      p_request_id: 'maintenance-1', p_cost: 250, p_charged_to: 'OWNER', p_notes: 'تم استبدال المضخة',
      p_evidence_url: 'https://example.test/invoice', p_confirmed: true,
    });
    expect(outcome).toEqual(result);
  });

  it('throws when the closure RPC returns an error instead of silently succeeding', async () => {
    supabaseMock.rpc.mockReturnValue({ single: vi.fn(() => Promise.resolve({ data: null, error: new Error('duplicate resolve') })) });
    const { closeMaintenanceWithExpense } = await import('./maintenance-service');

    await expect(closeMaintenanceWithExpense({ requestId: 'maintenance-1', cost: 100, chargedTo: 'OFFICE', notes: null, evidenceUrl: null, confirmed: true })).rejects.toThrow('تعذر إغلاق طلب الصيانة وتسجيل التكلفة');
  });
});
