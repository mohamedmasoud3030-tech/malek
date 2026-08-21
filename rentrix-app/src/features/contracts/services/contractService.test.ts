import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

describe('getContract missing-row handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function getContractQueryMock(result: { data: unknown; error: unknown }) {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      maybeSingle: vi.fn(() => chain),
      returns: vi.fn(() => Promise.resolve(result)),
    };
    return chain;
  }

  it('returns null when the contract is missing instead of throwing a 406', async () => {
    supabaseMock.from.mockReturnValue(getContractQueryMock({ data: null, error: null }));
    const { getContract } = await import('./contractService');
    await expect(getContract('missing-contract')).resolves.toBeNull();
  });

  it('normalizes a phantom empty array to null', async () => {
    supabaseMock.from.mockReturnValue(getContractQueryMock({ data: [], error: null }));
    const { getContract } = await import('./contractService');
    await expect(getContract('missing-contract')).resolves.toBeNull();
  });

  it('returns the contract when one row exists', async () => {
    const row = { id: 'contract-1', status: 'active' };
    supabaseMock.from.mockReturnValue(getContractQueryMock({ data: row, error: null }));
    const { getContract } = await import('./contractService');
    await expect(getContract('contract-1')).resolves.toMatchObject(row);
  });

  it('propagates a real query error', async () => {
    supabaseMock.from.mockReturnValue(getContractQueryMock({
      data: null,
      error: new Error('permission denied for table contracts'),
    }));
    const { getContract } = await import('./contractService');
    await expect(getContract('contract-1')).rejects.toThrow('permission denied');
  });
});


describe('draft duplicate guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const payload = {
    property_id: 'prop-1', unit_id: 'unit-1', tenant_id: 'tenant-1', agreement_id: null,
    start_date: '2026-09-01', end_date: '2027-08-31', rent_amount: 100,
    payment_cycle: 'monthly', billing_day: 1, grace_days: 0, payment_terms_id: null,
    status: 'draft', cancellation_reason: null, notes: null, attachment_url: null,
  } as const;

  function propertyQuery() {
    const chain = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn() };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.is.mockReturnValue(chain);
    chain.maybeSingle.mockResolvedValue({ data: { id: 'prop-1', status: 'active' }, error: null });
    return chain;
  }

  function draftQuery(rows: unknown[]) {
    const chain = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), in: vi.fn(), neq: vi.fn(), limit: vi.fn() };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.is.mockReturnValue(chain);
    chain.in.mockReturnValue(chain); chain.neq.mockReturnValue(chain); chain.limit.mockResolvedValue({ data: rows, error: null });
    return chain;
  }

  it('refuses a second draft for the same unit and tenant before the write RPC', async () => {
    supabaseMock.from.mockReturnValueOnce(propertyQuery()).mockReturnValueOnce(draftQuery([{ id: 'draft-1' }]));
    const { createContract } = await import('./contractService');

    await expect(createContract(payload)).rejects.toThrow('توجد بالفعل مسودة عقد');
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('allows the first draft after the duplicate guard returns no row', async () => {
    supabaseMock.from.mockReturnValueOnce(propertyQuery()).mockReturnValueOnce(draftQuery([]));
    supabaseMock.rpc.mockResolvedValue({ data: { id: 'contract-1', ...payload }, error: null });
    const { createContract } = await import('./contractService');

    await expect(createContract(payload)).resolves.toMatchObject({ id: 'contract-1' });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_contract_atomic', expect.objectContaining({ p_unit_id: 'unit-1', p_tenant_id: 'tenant-1' }));
  });
});

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
        agreement_id: null,
      },
    });
  });

  it('passes a selected covering agreement when renewing under a new owner agreement', async () => {
    const result = { status: 'renewed', old_contract_id: 'contract-1', new_contract_id: 'contract-2', agreement_id: '00000000-0000-4000-9000-000000000001' } as const;
    supabaseMock.rpc.mockResolvedValue({ data: result, error: null });
    const { renewContract } = await import('./contractService');

    await expect(renewContract('contract-1', { new_start: '2026-07-01', new_end: '2027-06-30', new_amount: 12000, agreement_id: result.agreement_id })).resolves.toEqual(result);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('renew_contract_atomic', expect.objectContaining({
      new_contract_data: expect.objectContaining({ agreement_id: result.agreement_id }),
    }));
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
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      maybeSingle: vi.fn(),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.is.mockReturnValue(chain);
    chain.maybeSingle.mockResolvedValue({ data: { id: 'prop-1', status: 'active' }, error: null });
    supabaseMock.from.mockReturnValue(chain);
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
    billing_day: 1,
    grace_days: 0,
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

  it('rejects contracts on inactive properties before calling the write RPC', async () => {
    const chain = supabaseMock.from();
    chain.maybeSingle.mockResolvedValueOnce({ data: { id: 'prop-1', status: 'inactive' }, error: null });
    const { updateContract } = await import('./contractService');

    await expect(updateContract('contract-1', payload)).rejects.toThrow('عقار غير نشط');
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
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

describe('contract approval/activation chain (S04-T03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits a draft for approval with the maker signature', async () => {
    const row = { status: 'draft', approval_status: 'PENDING', maker_signature: 'محمد' };
    supabaseMock.rpc.mockResolvedValue({ data: row, error: null });
    const { submitContractForApproval } = await import('./contractService');

    await expect(submitContractForApproval('contract-1', 'محمد')).resolves.toEqual(row);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('submit_contract_for_approval_atomic', {
      p_contract_id: 'contract-1',
      p_maker_signature: 'محمد',
    });
  });

  it('approves a pending contract with the checker signature', async () => {
    const row = { status: 'draft', approval_status: 'APPROVED', maker_signature: 'محمد', checker_signature: 'خالد' };
    supabaseMock.rpc.mockResolvedValue({ data: row, error: null });
    const { approveContract } = await import('./contractService');

    await expect(approveContract('contract-1', 'خالد')).resolves.toEqual(row);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('approve_contract_atomic', {
      p_contract_id: 'contract-1',
      p_checker_signature: 'خالد',
    });
  });

  it('rejects a pending contract with checker signature and a mandatory reason', async () => {
    const row = { status: 'draft', approval_status: 'REJECTED', rejection_reason: 'بيانات ناقصة' };
    supabaseMock.rpc.mockResolvedValue({ data: row, error: null });
    const { rejectContract } = await import('./contractService');

    await expect(rejectContract('contract-1', 'خالد', 'بيانات ناقصة')).resolves.toEqual(row);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('reject_contract_atomic', {
      p_contract_id: 'contract-1',
      p_checker_signature: 'خالد',
      p_reason: 'بيانات ناقصة',
    });
  });

  it('activates an approved contract so the agreement snapshot is frozen server-side', async () => {
    const row = {
      status: 'active',
      approval_status: 'APPROVED',
      collection_role_snapshot: 'OWNER_IS_CREDITOR',
      operating_model_snapshot: 'OWNER_AGENCY',
      agreement_version_id: '00000000-0000-4000-9000-000000000001',
    };
    supabaseMock.rpc.mockResolvedValue({ data: row, error: null });
    const { activateContract } = await import('./contractService');

    await expect(activateContract('contract-1')).resolves.toEqual(row);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('activate_contract_with_agreement_snapshot_atomic', {
      p_contract_id: 'contract-1',
    });
  });

  it('propagates backend approval-gate errors unchanged', async () => {
    const error = new Error('MAKER_CHECKER_MUST_BE_DISTINCT');
    supabaseMock.rpc.mockResolvedValue({ data: null, error });
    const { approveContract } = await import('./contractService');

    await expect(approveContract('contract-1', 'محمد')).rejects.toThrow('MAKER_CHECKER_MUST_BE_DISTINCT');
  });

  it('rejects malformed approval responses that omit the lifecycle fields', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { status: 'active' }, error: null });
    const { activateContract } = await import('./contractService');

    await expect(activateContract('contract-1')).rejects.toThrow('ناقصة الحقول');
  });
});
