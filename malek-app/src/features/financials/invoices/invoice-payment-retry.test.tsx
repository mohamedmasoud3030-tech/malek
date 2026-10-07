// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useInvoiceWorkspaceController } from './useInvoiceWorkspaceController';

const mocks = vi.hoisted(() => ({ submit: vi.fn(), search: {} }));
vi.mock('@tanstack/react-router', () => ({ useSearch: () => mocks.search }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ authorization: {} }) }));
vi.mock('@/features/auth/permissions', () => ({ canAccess: () => true, financialOperationPermissions: {} }));
vi.mock('@/features/contracts/useContracts', () => ({ useAllContracts: () => ({ data: { rows: [] } }) }));
vi.mock('./useInvoices', () => ({
  useInvoicesPaginated: () => ({ data: { rows: [] } }),
  useInvoice: (id: string) => ({ data: { id, amount: 100, tax_amount: 0, credited_amount: 0, paid_amount: 0, status: 'UNPAID' } }),
  useGenerateInvoices: () => ({}),
}));
vi.mock('../payments/usePayments', () => ({ usePostPayment: () => ({ mutateAsync: mocks.submit, isPending: false }) }));
vi.mock('../receipts/useReceipts', () => ({ useReceipt: () => ({}) }));
vi.mock('@/features/settings/useDocumentSettings', () => ({ useDocumentSettings: () => ({ isReady: false }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('binds retry identities to payment intent, retaining failure while allowing edited payments', async () => {
  mocks.submit.mockRejectedValue(new Error('uncertain response'));
  const { result } = renderHook(useInvoiceWorkspaceController);
  act(() => {
    result.current.setSelectedInvoiceId('invoice');
    result.current.setAmount('10');
    result.current.setPaymentDate('2026-09-09');
  });
  const send = async (count: number) => {
    await act(async () => { result.current.onPostPayment(); });
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(count));
  };
  await send(1);
  expect(result.current.collectionSuccess).toBeNull();
  expect(result.current.amount).toBe('10');
  const originalRequest = mocks.submit.mock.calls[0][0].request_id;
  act(() => result.current.setAmount('20'));
  await send(2);
  expect(mocks.submit.mock.calls[1][0].request_id).not.toBe(originalRequest);
  act(() => result.current.setAmount('10'));
  mocks.submit.mockResolvedValue({ receipt_id: 'receipt', receipt_no: 'REC-1' });
  await send(3);
  expect(mocks.submit.mock.calls[2][0].request_id).toBe(originalRequest);
  expect(result.current.collectionSuccess).toMatchObject({ receiptId: 'receipt', amount: 10 });
  expect(result.current.amount).toBe('');
  act(() => result.current.setAmount('10'));
  await send(4);
  expect(mocks.submit.mock.calls[3][0].request_id).not.toBe(originalRequest);
});
