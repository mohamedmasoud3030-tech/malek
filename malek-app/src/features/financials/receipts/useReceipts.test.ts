import { beforeEach, describe, expect, it, vi } from 'vitest';
import { receiptKeys } from './useReceipts';

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
  useQuery: vi.fn((options) => options),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mutationMock.toastSuccess,
    error: mutationMock.toastError,
  },
}));

vi.mock('./receiptService', () => ({
  requestReceiptVoid: vi.fn(),
  approveReceiptVoid: vi.fn(),
  listPendingReceiptVoidRequests: vi.fn(),
  listReceipts: vi.fn(),
  getReceiptDetail: vi.fn(),
}));

describe('receipt VOID maker-checker hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationMock.useQueryClient.mockReturnValue({ invalidateQueries: mutationMock.invalidateQueries });
  });

  it('uses the request RPC service as the maker mutation', async () => {
    const { requestReceiptVoid } = await import('./receiptService');
    const { useRequestReceiptVoid } = await import('./useReceipts');

    const mutationOptions = useRequestReceiptVoid() as unknown as { mutationFn: typeof requestReceiptVoid };

    expect(mutationOptions.mutationFn).toBe(requestReceiptVoid);
  });

  it('uses the approval RPC service as the checker mutation', async () => {
    const { approveReceiptVoid } = await import('./receiptService');
    const { useApproveReceiptVoid } = await import('./useReceipts');

    const mutationOptions = useApproveReceiptVoid() as unknown as { mutationFn: typeof approveReceiptVoid };

    expect(mutationOptions.mutationFn).toBe(approveReceiptVoid);
  });

  it('invalidates receipt queries and reports a pending request instead of claiming the receipt is void', async () => {
    const { useRequestReceiptVoid } = await import('./useReceipts');

    const mutationOptions = useRequestReceiptVoid() as unknown as { onSuccess: () => void };
    mutationOptions.onSuccess();

    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: receiptKeys.all });
    expect(mutationMock.toastSuccess).toHaveBeenCalledWith('تم إرسال طلب إلغاء الإيصال للمراجعة');
  });

  it('reports successful approval only after the checker executes the reversal', async () => {
    const { useApproveReceiptVoid } = await import('./useReceipts');

    const mutationOptions = useApproveReceiptVoid() as unknown as { onSuccess: () => void };
    mutationOptions.onSuccess();

    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: receiptKeys.all });
    expect(mutationMock.toastSuccess).toHaveBeenCalledWith('تم اعتماد إلغاء الإيصال وتنفيذ القيد العكسي');
  });

  it('surfaces safe Arabic fallbacks for request and approval failures', async () => {
    const { useApproveReceiptVoid, useRequestReceiptVoid } = await import('./useReceipts');

    const requestOptions = useRequestReceiptVoid() as unknown as { onError: (error: Error) => void };
    const approvalOptions = useApproveReceiptVoid() as unknown as { onError: (error: Error) => void };
    requestOptions.onError(new Error(''));
    approvalOptions.onError(new Error(''));

    expect(mutationMock.toastError).toHaveBeenNthCalledWith(1, 'تعذّر إرسال طلب إلغاء الإيصال');
    expect(mutationMock.toastError).toHaveBeenNthCalledWith(2, 'تعذّر اعتماد إلغاء الإيصال');
  });
});
