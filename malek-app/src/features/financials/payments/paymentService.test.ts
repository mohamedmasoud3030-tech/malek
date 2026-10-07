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

describe('payment acknowledgement identity and status', () => {
  const payload = { invoice_id: 'invoice', amount: 50, method: 'cash' as const, date: '2026-09-09', reference: null, request_id: 'request' };
  const ack = { status: 'recorded', request_id: 'request', invoice_id: 'invoice', payment_id: 'payment', receipt_id: 'receipt' };
  it.each([
    { success: false }, { status: 'failed' }, { status: undefined },
    { payment_id: {} }, { receipt_id: 23 }, { payment_id: '   ' },
    { invoice_id: 'different-invoice' }, { request_id: 'different-request' },
  ])('rejects an unconfirmed or mismatched acknowledgement: %j', async (change) => {
    supabaseMock.rpc.mockResolvedValue({ data: { ...ack, ...change }, error: null });
    const { recordInvoicePaymentAtomic } = await import('./paymentService');
    await expect(recordInvoicePaymentAtomic(payload)).rejects.toThrow();
  });
});
