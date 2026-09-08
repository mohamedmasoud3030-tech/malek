import { beforeEach, describe, expect, it, vi } from 'vitest';
import { financialReadModelRoots } from '@/lib/financial-cache';
import { invoiceKeys } from '../invoices/useInvoices';
import { receiptKeys } from '../receipts/useReceipts';
import { financialReportKeys } from '../reports/useFinancialReports';

const mutationMock = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  useMutation: vi.fn((options) => options),
  useQueryClient: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: mutationMock.useMutation,
  useQueryClient: mutationMock.useQueryClient,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mutationMock.toastSuccess,
    error: mutationMock.toastError,
  },
}));

vi.mock('./paymentService', () => ({
  recordInvoicePaymentAtomic: vi.fn(),
}));

describe('usePostPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationMock.useQueryClient.mockReturnValue({ invalidateQueries: mutationMock.invalidateQueries });
    mutationMock.invalidateQueries.mockResolvedValue(undefined);
  });

  it('invalidates invoice and receipt queries after a successful payment post', async () => {
    const { usePostPayment } = await import('./usePayments');

    const mutationOptions = usePostPayment() as unknown as { onSuccess: () => Promise<void> };
    await mutationOptions.onSuccess();

    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: invoiceKeys.all });
    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: receiptKeys.all });
    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: financialReportKeys.all });
    expect(mutationMock.invalidateQueries).toHaveBeenCalledTimes(financialReadModelRoots.length);
    expect(mutationMock.toastSuccess).toHaveBeenCalledWith('تم تسجيل الدفعة بنجاح');
  });

  it('maps the RPC ledger receipt id to a payment-backed UI receipt id without mutating the RPC result', async () => {
    const rpcResult = {
      status: 'recorded' as const,
      request_id: 'request-1',
      invoice_id: 'inv_1',
      payment_id: 'payment_123',
      receipt_id: 'ledger_receipt_123',
      receipt_no: 'REC-2026-0001',
    };
    const originalResult = { ...rpcResult };
    const { toPaymentBackedReceiptResult } = await import('./usePayments');

    const uiResult = toPaymentBackedReceiptResult(rpcResult);

    expect(uiResult).toEqual({
      status: 'recorded',
      request_id: 'request-1',
      invoice_id: 'inv_1',
      payment_id: 'payment_123',
      receipt_id: 'payment_123',
      ledger_receipt_id: 'ledger_receipt_123',
      receipt_no: 'REC-2026-0001',
    });
    expect(rpcResult).toEqual(originalResult);
    expect(uiResult.invoice_id).toBe(rpcResult.invoice_id);
    expect(uiResult.request_id).toBe(rpcResult.request_id);
    expect(uiResult.receipt_no).toBe(rpcResult.receipt_no);
  });

  it('returns the payment-backed receipt id from the mutation result', async () => {
    const { recordInvoicePaymentAtomic } = await import('./paymentService');
    vi.mocked(recordInvoicePaymentAtomic).mockResolvedValue({
      status: 'recorded',
      request_id: 'request-1',
      invoice_id: 'inv_1',
      payment_id: 'payment_123',
      receipt_id: 'ledger_receipt_123',
      receipt_no: 'REC-2026-0001',
    });
    const { usePostPayment } = await import('./usePayments');

    const mutationOptions = usePostPayment() as unknown as {
      mutationFn: (payload: Parameters<typeof recordInvoicePaymentAtomic>[0]) => Promise<Awaited<ReturnType<typeof recordInvoicePaymentAtomic>> & { ledger_receipt_id: string }>;
    };
    const result = await mutationOptions.mutationFn({
      invoice_id: 'inv_1',
      amount: 50,
      method: 'cash',
      date: '2026-05-14',
      reference: null,
      request_id: 'request-1',
    });

    expect(result.receipt_id).toBe('payment_123');
    expect(result.ledger_receipt_id).toBe('ledger_receipt_123');
    expect(result.invoice_id).toBe('inv_1');
    expect(result.request_id).toBe('request-1');
    expect(result.receipt_no).toBe('REC-2026-0001');
  });
});
