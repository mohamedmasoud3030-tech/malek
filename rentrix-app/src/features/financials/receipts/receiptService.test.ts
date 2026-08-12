import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payment } from '@/types/domain';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

const basePayment: Payment = {
  id: 'pay_1234567890abcdef',
  invoice_id: 'inv_1',
  amount: 1250.5,
  payment_method: 'cash',
  reference_number: 'REF-1',
  reference_no: null,
  contract_id: null,
  date_time: null,
  channel: null,
  status: 'POSTED',
  notes: null,
  receipt_id: null,
  created_by: null,
  payment_date: '2026-05-14',
  created_at: '2026-05-14T10:30:00Z',
  updated_at: '2026-05-14T10:30:00Z',
  deleted_at: null,
};

function createPaymentFixture(overrides: Partial<Payment> = {}): Payment {
  return { ...basePayment, ...overrides };
}

type TableName = 'payments' | 'receipt_allocations' | 'receipts' | 'invoices' | 'contracts' | 'units' | 'properties' | 'people' | 'receipt_void_requests';
type TableResponses = Partial<Record<TableName, unknown[]>>;

type QueryLogEntry = { table: string; method: string; args: unknown[] };

function createQueryBuilder(table: string, responses: TableResponses, log: QueryLogEntry[]) {
  const eqFilters: Array<{ column: string; value: unknown }> = [];
  const builder = {
    select: vi.fn((...args: unknown[]) => {
      log.push({ table, method: 'select', args });
      return builder;
    }),
    is: vi.fn((...args: unknown[]) => {
      log.push({ table, method: 'is', args });
      return builder;
    }),
    in: vi.fn((...args: unknown[]) => {
      log.push({ table, method: 'in', args });
      return builder;
    }),
    eq: vi.fn((...args: unknown[]) => {
      log.push({ table, method: 'eq', args });
      eqFilters.push({ column: String(args[0]), value: args[1] });
      return builder;
    }),
    order: vi.fn((...args: unknown[]) => {
      log.push({ table, method: 'order', args });
      return builder;
    }),
    limit: vi.fn((...args: unknown[]) => {
      log.push({ table, method: 'limit', args });
      return builder;
    }),
    single: vi.fn(() => {
      log.push({ table, method: 'single', args: [] });
      return builder;
    }),
    returns: vi.fn(async () => {
      log.push({ table, method: 'returns', args: [] });
      const data = (responses[table as TableName] ?? []).filter((row) => (
        eqFilters.every((filter) => {
          if (!row || typeof row !== 'object') return false;
          return (row as Record<string, unknown>)[filter.column] === filter.value;
        })
      ));
      return {
        data: table === 'payments' && builder.single.mock.calls.length > 0 ? data[0] ?? null : data,
        error: null,
      };
    }),
  };
  return builder;
}

function mockSupabaseTables(responses: TableResponses) {
  const log: QueryLogEntry[] = [];
  supabaseMock.from.mockImplementation((table: TableName) => createQueryBuilder(table, responses, log));
  return log;
}

describe('receiptService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats receipt numbers from the payment id prefix', async () => {
    const { formatReceiptNumber } = await import('./receiptService');

    expect(formatReceiptNumber('1234567890abcdef')).toBe('إيصال بلا مرجع تجاري');
  });

  it('lists receipt projections with batched invoice, contract, tenant, unit, and property enrichment', async () => {
    const log = mockSupabaseTables({
      payments: [basePayment],
      invoices: [{ id: 'inv_1', contract_id: 'contract_1', status: 'paid' }],
      contracts: [{ id: 'contract_1', property_id: 'property_1', unit_id: 'unit_1', tenant_id: 'tenant_1' }],
      units: [{ id: 'unit_1', unit_number: 'A-101' }],
      properties: [{ id: 'property_1', title: 'Tower A' }],
      people: [{ id: 'tenant_1', full_name: 'Test Tenant' }],
    });
    const { listReceipts } = await import('./receiptService');

    const receipts = await listReceipts({ limit: 10 });

    expect(receipts).toEqual([
      {
        id: 'pay_1234567890abcdef',
        receipt_number: 'إيصال بلا مرجع تجاري',
        payment_id: 'pay_1234567890abcdef',
        invoice_id: 'inv_1',
        invoice_reference: null,
        invoice_status: 'paid',
        contract_id: 'contract_1',
        payment_date: '2026-05-14',
        amount: 1250.5,
        payment_method: 'cash',
        reference_number: 'REF-1',
        created_at: '2026-05-14T10:30:00Z',
        status: 'posted',
        tenant_name: 'Test Tenant',
        unit_number: 'A-101',
        property_title: 'Tower A',
      },
    ]);
    expect(supabaseMock.from).toHaveBeenCalledTimes(8);
    expect(supabaseMock.from.mock.calls.map(([table]) => table)).toEqual([
      'payments',
      'receipt_allocations',
      'receipts',
      'invoices',
      'contracts',
      'units',
      'properties',
      'people',
    ]);
    expect(log.filter((entry) => entry.method === 'in')).toEqual([
      { table: 'receipt_allocations', method: 'in', args: ['receipt_id', ['pay_1234567890abcdef']] },
      { table: 'receipts', method: 'in', args: ['id', ['pay_1234567890abcdef']] },
      { table: 'invoices', method: 'in', args: ['id', ['inv_1']] },
      { table: 'contracts', method: 'in', args: ['id', ['contract_1']] },
      { table: 'units', method: 'in', args: ['id', ['unit_1']] },
      { table: 'properties', method: 'in', args: ['id', ['property_1']] },
      { table: 'people', method: 'in', args: ['id', ['tenant_1']] },
    ]);
  });

  it('prefers the server-generated receipt reference over the UUID-slice fallback', async () => {
    mockSupabaseTables({
      payments: [basePayment],
      receipts: [{ id: 'pay_1234567890abcdef', reference: 'RCT-2026-000123' }],
      invoices: [{ id: 'inv_1', contract_id: 'contract_1', status: 'paid' }],
      contracts: [{ id: 'contract_1', property_id: 'property_1', unit_id: 'unit_1', tenant_id: 'tenant_1' }],
      units: [{ id: 'unit_1', unit_number: 'A-101' }],
      properties: [{ id: 'property_1', title: 'Tower A' }],
      people: [{ id: 'tenant_1', full_name: 'Test Tenant' }],
    });
    const { listReceipts } = await import('./receiptService');

    const receipts = await listReceipts({ limit: 10 });

    // The primary visible label is the business reference, not a UUID slice.
    expect(receipts[0].receipt_number).toBe('RCT-2026-000123');
  });

  it('recovers the invoice context from a single receipt allocation when the payment shadow row has no invoice_id', async () => {
    mockSupabaseTables({
      payments: [createPaymentFixture({ id: 'payment_123', receipt_id: 'payment_123', invoice_id: null })],
      receipt_allocations: [{ receipt_id: 'payment_123', invoice_id: 'inv_1' }],
      invoices: [{ id: 'inv_1', contract_id: 'contract_1', status: 'paid' }],
      contracts: [{ id: 'contract_1', property_id: 'property_1', unit_id: 'unit_1', tenant_id: 'tenant_1' }],
      units: [{ id: 'unit_1', unit_number: 'A-101' }],
      properties: [{ id: 'property_1', title: 'Tower A' }],
      people: [{ id: 'tenant_1', full_name: 'Test Tenant' }],
    });
    const { listReceipts } = await import('./receiptService');

    await expect(listReceipts()).resolves.toMatchObject([{
      id: 'payment_123',
      invoice_id: 'inv_1',
      contract_id: 'contract_1',
      tenant_name: 'Test Tenant',
      unit_number: 'A-101',
      property_title: 'Tower A',
    }]);
  });

  it('projects receipt detail from a single payment id', async () => {
    const log = mockSupabaseTables({
      payments: [basePayment],
      invoices: [{ id: 'inv_1', contract_id: null, status: 'partial' }],
    });
    const { getReceiptDetail } = await import('./receiptService');

    const receipt = await getReceiptDetail('pay_1234567890abcdef');

    expect(receipt).toMatchObject({
      id: 'pay_1234567890abcdef',
      receipt_number: 'إيصال بلا مرجع تجاري',
      payment_id: 'pay_1234567890abcdef',
      invoice_id: 'inv_1',
      invoice_status: 'partial',
      contract_id: null,
      tenant_name: null,
      unit_number: null,
      property_title: null,
      status: 'posted',
    });
    expect(log.filter((entry) => entry.table === 'payments' && entry.method === 'eq')).toEqual([
      { table: 'payments', method: 'eq', args: ['id', 'pay_1234567890abcdef'] },
    ]);
  });

  it('loads receipt detail with the payment-backed identifier returned after posting a payment', async () => {
    const log = mockSupabaseTables({
      payments: [createPaymentFixture({ id: 'payment_123', invoice_id: 'inv_1' })],
      invoices: [{ id: 'inv_1', contract_id: null, status: 'paid' }],
    });
    const { getReceiptDetail } = await import('./receiptService');

    const receipt = await getReceiptDetail('payment_123');

    expect(receipt.id).toBe('payment_123');
    expect(receipt.payment_id).toBe('payment_123');
    expect(receipt.receipt_number).toBe('إيصال بلا مرجع تجاري');
    expect(log.filter((entry) => entry.table === 'payments' && entry.method === 'eq')).toEqual([
      { table: 'payments', method: 'eq', args: ['id', 'payment_123'] },
    ]);
  });

  it('keeps browser receipt lookup payment-backed when the RPC returns the same ledger receipt id', async () => {
    mockSupabaseTables({
      payments: [createPaymentFixture({ id: 'payment_123', invoice_id: 'inv_1' })],
      invoices: [{ id: 'inv_1', contract_id: null, status: 'paid' }],
    });
    const { toPaymentBackedReceiptResult } = await import('../payments/usePayments');
    const { getReceiptDetail } = await import('./receiptService');

    const uiResult = toPaymentBackedReceiptResult({
      status: 'recorded',
      request_id: 'request-1',
      invoice_id: 'inv_1',
      payment_id: 'payment_123',
      receipt_id: 'payment_123',
    });

    await expect(getReceiptDetail(uiResult.receipt_id)).resolves.toMatchObject({
      id: 'payment_123',
      payment_id: 'payment_123',
      invoice_id: 'inv_1',
    });
    expect(uiResult.ledger_receipt_id).toBe('payment_123');
  });

  it('projects voided payment rows as void receipts so the UI does not show them as posted', async () => {
    mockSupabaseTables({
      payments: [createPaymentFixture({ id: 'payment_void', status: 'VOID' })],
      invoices: [{ id: 'inv_1', contract_id: null, status: 'unpaid' }],
    });
    const { listReceipts } = await import('./receiptService');

    await expect(listReceipts()).resolves.toMatchObject([{ id: 'payment_void', status: 'void' }]);
  });

  it('uses posted payment amounts as receipt truth without deriving balances', async () => {
    mockSupabaseTables({
      payments: [
        createPaymentFixture({ id: 'payment_cash', amount: 300, payment_method: 'cash' }),
        createPaymentFixture({ id: 'payment_bank', amount: 450.75, payment_method: 'bank_transfer', reference_number: null }),
      ],
      invoices: [{ id: 'inv_1', contract_id: 'contract_1', status: 'partial' }],
      contracts: [{ id: 'contract_1', property_id: 'property_1', unit_id: 'unit_1', tenant_id: 'tenant_1' }],
      units: [{ id: 'unit_1', unit_number: 'A-101' }],
      properties: [{ id: 'property_1', title: 'Tower A' }],
      people: [{ id: 'tenant_1', full_name: 'Test Tenant' }],
    });
    const { listReceipts } = await import('./receiptService');

    const receipts = await listReceipts({ limit: 25 });

    expect(receipts.map((receipt) => ({ id: receipt.id, amount: receipt.amount, status: receipt.status }))).toEqual([
      { id: 'payment_cash', amount: 300, status: 'posted' },
      { id: 'payment_bank', amount: 450.75, status: 'posted' },
    ]);
    expect(receipts.reduce((total, receipt) => total + receipt.amount, 0)).toBe(750.75);
    expect(receipts.every((receipt) => !('remaining_amount' in receipt))).toBe(true);
  });
});

const pendingRequestRpcResult = {
  success: true,
  idempotent: false,
  void_request_id: 'void-ledger-1',
  request_id: 'void-request-1',
  receipt_id: 'payment_123',
  status: 'PENDING' as const,
  reason: 'دفعة مكررة',
  requested_by: 'maker-1',
  requested_at: '2026-08-13T10:00:00Z',
};

const approvedVoidRpcResult = {
  success: true,
  idempotent: false,
  request_id: 'void-approved:approval-1',
  requested_receipt_id: 'payment_123',
  payment_id: 'payment_123',
  receipt_id: 'payment_123',
  status: 'VOID' as const,
  reason: 'دفعة مكررة',
  journal_reversal_batch_id: 'journal-batch-1',
  journal_reversal_entries: 2,
  void_request_id: 'void-ledger-1',
  void_request_status: 'EXECUTED' as const,
  requested_by: 'maker-1',
  approved_by: 'checker-1',
  approval_request_id: 'approval-1',
};

describe('receipt VOID maker-checker service', () => {
  it('creates a pending request without claiming that the receipt is already void', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: pendingRequestRpcResult, error: null });
    const { requestReceiptVoid } = await import('./receiptService');
    const payload = { receipt_id: 'payment_123', reason: 'دفعة مكررة', request_id: 'void-request-1' };

    await expect(requestReceiptVoid(payload)).resolves.toEqual(pendingRequestRpcResult);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('request_receipt_void_atomic', { payload });
  });

  it('approves a pending request through the separate checker RPC', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: approvedVoidRpcResult, error: null });
    const { approveReceiptVoid } = await import('./receiptService');
    const payload = { void_request_id: 'void-ledger-1', request_id: 'approval-1' };

    await expect(approveReceiptVoid(payload)).resolves.toEqual(approvedVoidRpcResult);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('approve_receipt_void_atomic', { payload });
  });

  it('loads only pending company-scoped requests exposed by RLS', async () => {
    const request = {
      id: 'void-ledger-1',
      company_id: 'company-1',
      receipt_id: 'payment_123',
      reason: 'دفعة مكررة',
      status: 'PENDING',
      requested_by: 'maker-1',
      requested_at: '2026-08-13T10:00:00Z',
      reviewed_by: null,
      reviewed_at: null,
      request_id: 'void-request-1',
      execution_request_id: null,
      reversal_batch_id: null,
    };
    const log = mockSupabaseTables({ receipt_void_requests: [request] });
    const { listPendingReceiptVoidRequests } = await import('./receiptService');

    await expect(listPendingReceiptVoidRequests()).resolves.toEqual([request]);
    expect(log).toContainEqual({ table: 'receipt_void_requests', method: 'eq', args: ['status', 'PENDING'] });
  });

  it('does not convert request or approval RPC errors into fake success', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: new Error('maker-checker denied') });
    const { approveReceiptVoid, requestReceiptVoid } = await import('./receiptService');

    await expect(requestReceiptVoid({
      receipt_id: 'payment_123',
      reason: 'سبب',
      request_id: 'void-request-1',
    })).rejects.toThrow('maker-checker denied');
    await expect(approveReceiptVoid({
      void_request_id: 'void-ledger-1',
      request_id: 'approval-1',
    })).rejects.toThrow('maker-checker denied');
  });

  it('rejects missing and malformed RPC response contracts', async () => {
    const { approveReceiptVoid, requestReceiptVoid } = await import('./receiptService');

    supabaseMock.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(requestReceiptVoid({
      receipt_id: 'payment_123',
      reason: 'سبب',
      request_id: 'void-request-1',
    })).rejects.toThrow('request_receipt_void_atomic returned no data');

    supabaseMock.rpc.mockResolvedValueOnce({ data: { success: true, status: 'VOID' }, error: null });
    await expect(approveReceiptVoid({
      void_request_id: 'void-ledger-1',
      request_id: 'approval-1',
    })).rejects.toThrow('approve_receipt_void_atomic returned an invalid response contract');
  });
});
