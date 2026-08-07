import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: supabaseMock,
}));

describe('recordInvoicePaymentAtomic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the payment facade with the stable payload and returns receipt ids', async () => {
    const rpcResult = {
      status: 'recorded',
      request_id: 'request-1',
      invoice_id: 'inv_1',
      payment_id: 'payment_123',
      receipt_id: 'receipt_123',
    };
    supabaseMock.rpc.mockResolvedValue({ data: rpcResult, error: null });
    const { recordInvoicePaymentAtomic } = await import('./paymentService');
    const payload = {
      invoice_id: 'inv_1',
      amount: 50,
      method: 'cash' as const,
      date: '2026-05-14',
      reference: 'REF-1',
      request_id: 'request-1',
    };

    await expect(recordInvoicePaymentAtomic(payload)).resolves.toEqual(rpcResult);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('record_invoice_payment_atomic', { payload });
  });

  it('does not convert RPC errors into fake success', async () => {
    const error = new Error('overpayment rejected');
    supabaseMock.rpc.mockResolvedValue({ data: null, error });
    const { recordInvoicePaymentAtomic } = await import('./paymentService');

    await expect(recordInvoicePaymentAtomic({
      invoice_id: 'inv_1',
      amount: 5000,
      method: 'cash',
      date: '2026-05-14',
      reference: null,
      request_id: 'request-1',
    })).rejects.toThrow('تعذر تسجيل الدفعة');
  });

  it('rejects malformed successful RPC responses', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { status: 'recorded' }, error: null });
    const { recordInvoicePaymentAtomic } = await import('./paymentService');

    await expect(recordInvoicePaymentAtomic({
      invoice_id: 'inv_1',
      amount: 50,
      method: 'cash',
      date: '2026-05-14',
      reference: null,
      request_id: 'request-1',
    })).rejects.toThrow('تم استلام استجابة غير مكتملة بعد تسجيل الدفعة. حدّث السجل قبل إعادة المحاولة.');
  });
});

describe('payment request id helpers', () => {
  it('preserves the same request_id across retries and creates a new one after reset', async () => {
    const { getOrCreatePaymentRequestId, resetPaymentRequestId } = await import('./paymentService');
    const state = { current: null };
    const createId = vi.fn()
      .mockReturnValueOnce('request-1')
      .mockReturnValueOnce('request-2');

    expect(getOrCreatePaymentRequestId(state, createId)).toBe('request-1');
    expect(getOrCreatePaymentRequestId(state, createId)).toBe('request-1');
    expect(createId).toHaveBeenCalledTimes(1);

    resetPaymentRequestId(state);

    expect(getOrCreatePaymentRequestId(state, createId)).toBe('request-2');
    expect(createId).toHaveBeenCalledTimes(2);
  });
});
