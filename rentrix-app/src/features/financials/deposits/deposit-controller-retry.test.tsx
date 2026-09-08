// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { useDepositWorkspaceController } from './use-deposit-workspace-controller';
import { createTenantDeposit } from './deposit-service';
import { financialReadModelRoots } from '@/lib/financial-cache';
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: 'actor' } }) }));
vi.mock('@/features/settings/useDocumentSettings', () => ({ useDocumentSettings: () => ({ companySettings: { currency: 'OMR' } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./deposit-service', async (original) => ({ ...await original<typeof import('./deposit-service')>(), createTenantDeposit: vi.fn() }));
vi.mock('./deposit-workspace-queries', () => {
  const query = () => ({ data: [], isLoading: false, isError: false });
  return { useTenantDeposits: query, useDepositClaims: query, useDepositRefundEvents: query, useContracts: query, useDepositInvoices: query, useReviewedMoveOutInspections: query };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('keeps retry identity through controller failure and invalidates downstream balances after acknowledgement', async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  for (const root of financialReadModelRoots) client.setQueryData([root, 'test'], 'old');
  const { result } = renderHook(useDepositWorkspaceController, { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  act(() => {
    result.current.setActionType('create');
    result.current.setCreateForm({ contract_id: 'contract', amount: 100, received_date: '2026-09-09', notes: '' });
  });
  vi.mocked(createTenantDeposit).mockRejectedValueOnce(new Error('response lost')).mockResolvedValue({ deposit_id: 'deposit' });
  await act(async () => { await expect(result.current.createMut.mutateAsync()).rejects.toThrow(); });
  expect(result.current.actionType).toBe('create');
  const firstRequest = vi.mocked(createTenantDeposit).mock.calls[0][0].request_id;
  await act(async () => { await result.current.createMut.mutateAsync(); });
  expect(vi.mocked(createTenantDeposit).mock.calls[1][0].request_id).toBe(firstRequest);
  expect(result.current.actionType).toBeNull();
  for (const root of financialReadModelRoots) expect(client.getQueryState([root, 'test'])?.isInvalidated).toBe(true);
  client.clear();
});
