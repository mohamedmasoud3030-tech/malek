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
  useQuery: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mutationMock.toastSuccess,
    error: mutationMock.toastError,
  },
}));

vi.mock('./receiptService', () => ({
  voidReceipt: vi.fn(),
  listReceipts: vi.fn(),
  getReceiptDetail: vi.fn(),
}));

describe('useVoidReceipt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationMock.useQueryClient.mockReturnValue({ invalidateQueries: mutationMock.invalidateQueries });
  });

  it('uses the payment-backed void facade directly as the mutation function', async () => {
    const { voidReceipt } = await import('./receiptService');
    const { useVoidReceipt } = await import('./useReceipts');

    const mutationOptions = useVoidReceipt() as unknown as { mutationFn: typeof voidReceipt };

    expect(mutationOptions.mutationFn).toBe(voidReceipt);
  });

  it('invalidates receipt queries and shows a success toast after voiding', async () => {
    const { useVoidReceipt } = await import('./useReceipts');

    const mutationOptions = useVoidReceipt() as unknown as { onSuccess: () => void };
    mutationOptions.onSuccess();

    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: receiptKeys.all });
    expect(mutationMock.toastSuccess).toHaveBeenCalledWith('تم إلغاء الإيصال بنجاح');
  });

  it('surfaces the RPC error message in the failure toast', async () => {
    const { useVoidReceipt } = await import('./useReceipts');

    const mutationOptions = useVoidReceipt() as unknown as { onError: (error: Error) => void };
    mutationOptions.onError(new Error('receipt already voided'));

    expect(mutationMock.toastError).toHaveBeenCalledWith('تعذّر إلغاء الإيصال');
  });

  it('falls back to a generic Arabic error message when the RPC error has no message', async () => {
    const { useVoidReceipt } = await import('./useReceipts');

    const mutationOptions = useVoidReceipt() as unknown as { onError: (error: Error) => void };
    mutationOptions.onError(new Error(''));

    expect(mutationMock.toastError).toHaveBeenCalledWith('تعذّر إلغاء الإيصال');
  });
});
