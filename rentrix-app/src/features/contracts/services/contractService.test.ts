import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

describe('renewContract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls renew_contract_atomic with old_contract_id and new_contract_data', async () => {
    const result = { status: 'renewed', old_contract_id: 'contract-1', new_contract_id: 'contract-2' } as const;
    supabaseMock.rpc.mockResolvedValue({ data: result, error: null });
    const { renewContract } = await import('./contractService');

    await expect(renewContract('contract-1', {
      new_start: '2026-07-01',
      new_end: '2027-06-30',
      new_amount: 12000,
    })).resolves.toEqual(result);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('renew_contract_atomic', {
      old_contract_id: 'contract-1',
      new_contract_data: {
        new_start: '2026-07-01',
        new_end: '2027-06-30',
        new_amount: 12000,
      },
    });
  });

  it('extracts the returned new_contract_id from the parsed object', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { status: 'renewed', old_contract_id: 'contract-1', new_contract_id: 'contract-2' }, error: null });
    const { renewContract } = await import('./contractService');

    const result = await renewContract('contract-1', { new_start: '2026-07-01', new_end: '2027-06-30', new_amount: 12000 });

    expect(result.new_contract_id).toBe('contract-2');
  });

  it('keeps renewal RPC errors visible', async () => {
    const error = new Error('invalid renewal dates');
    supabaseMock.rpc.mockResolvedValue({ data: null, error });
    const { renewContract } = await import('./contractService');

    await expect(renewContract('contract-1', { new_start: '2027-07-01', new_end: '2027-06-30', new_amount: 12000 })).rejects.toThrow('invalid renewal dates');
  });

  it('rejects malformed renewal success responses', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { status: 'renewed', old_contract_id: 'contract-1' }, error: null });
    const { renewContract } = await import('./contractService');

    await expect(renewContract('contract-1', { new_start: '2026-07-01', new_end: '2027-06-30', new_amount: 12000 })).rejects.toThrow('missing the new contract id');
  });
});

describe('updateContract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const payload = {
    property_id: 'prop-1',
    unit_id: 'unit-1',
    tenant_id: 'tenant-1',
    agreement_id: 'agreement-1',
    start_date: '2026-07-01',
    end_date: '2027-06-30',
    rent_amount: 12000,
    payment_cycle: 'monthly',
    payment_terms_id: null,
    status: 'active',
    cancellation_reason: null,
    notes: null,
    attachment_url: null,
  } as const;

  it('calls update_contract_atomic instead of a raw table update', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { id: 'contract-1', ...payload }, error: null });
    const { updateContract } = await import('./contractService');

    await updateContract('contract-1', payload);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('update_contract_atomic', expect.objectContaining({
      p_contract_id: 'contract-1',
      p_property_id: 'prop-1',
      p_unit_id: 'unit-1',
      p_tenant_id: 'tenant-1',
      p_agreement_id: 'agreement-1',
      p_status: 'active',
    }));
  });

  it('surfaces invariant-violation errors from the RPC (e.g. overlapping unit)', async () => {
    const error = new Error('الوحدة محجوزة خلال هذه الفترة');
    supabaseMock.rpc.mockResolvedValue({ data: null, error });
    const { updateContract } = await import('./contractService');

    await expect(updateContract('contract-1', payload)).rejects.toThrow('الوحدة محجوزة');
  });
});

describe('terminateContract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls terminate_contract_atomic with contract id and reason', async () => {
    const result = { status: 'terminated', contract_id: 'contract-1', cancelled_invoice_ids: ['inv-1'] };
    supabaseMock.rpc.mockResolvedValue({ data: result, error: null });
    const { terminateContract } = await import('./contractService');

    await expect(terminateContract('contract-1', 'tenant requested early exit')).resolves.toEqual(result);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('terminate_contract_atomic', {
      p_contract_id: 'contract-1',
      p_reason: 'tenant requested early exit',
    });
  });

  it('keeps termination RPC errors visible (e.g. already terminated)', async () => {
    const error = new Error('لا يمكن إنهاء عقد بحالته الحالية');
    supabaseMock.rpc.mockResolvedValue({ data: null, error });
    const { terminateContract } = await import('./contractService');

    await expect(terminateContract('contract-1', 'reason')).rejects.toThrow('لا يمكن إنهاء عقد');
  });
});

describe('softDeleteContract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls soft_delete_contract_atomic instead of a direct table update', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { success: true, status: 'soft_deleted', contract_id: 'contract-1', cancelled_invoice_ids: [] }, error: null });
    const { softDeleteContract } = await import('./contractService');

    await softDeleteContract('contract-1');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('soft_delete_contract_atomic', {
      p_contract_id: 'contract-1',
    });
  });

  it('propagates errors when soft_delete_contract_atomic fails', async () => {
    const error = new Error('غير مصرح: يجب أن تكون مديراً أو مشرفاً لحذف عقد');
    supabaseMock.rpc.mockResolvedValue({ data: null, error });
    const { softDeleteContract } = await import('./contractService');

    await expect(softDeleteContract('contract-1')).rejects.toThrow('غير مصرح');
  });
});
