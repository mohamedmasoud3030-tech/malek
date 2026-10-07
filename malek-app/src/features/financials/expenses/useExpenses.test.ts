// @vitest-environment happy-dom
import { createElement, type ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateExpenseAtomic, useUpdateExpense } from './useExpenses';
import { financialReadModelRoots } from '@/lib/financial-cache';
const api = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('./expenseService', () => ({
  createExpenseWithJournal: api.create,
  updateExpense: api.update,
  listExpenses: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: api.success, error: api.error },
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  api.create.mockReset();
  api.update.mockReset();
});
const payload = {
  propertyId: 'property-1',
  category: 'صيانة',
  amount: 20,
  expenseDate: '2026-09-01',
};
function harness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  for (const root of [...financialReadModelRoots, 'expenses'])
    client.setQueryData([root], { evidence: true });
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children),
  };
}
describe('expense mutation evidence and retries', () => {
  it.each([true, false])(
    'invalidates all affected read models after creation (success=%s)',
    async (success) => {
      const h = harness();
      api.create.mockImplementation(() =>
        success
          ? Promise.resolve({ expenseId: 'expense-1' })
          : Promise.reject(new Error('lost response')),
      );
      const hook = renderHook(() => useCreateExpenseAtomic(), {
        wrapper: h.wrapper,
      });
      await act(async () => {
        await hook.result.current.mutateAsync(payload).catch(() => undefined);
      });
      for (const root of [...financialReadModelRoots, 'expenses'])
        expect(h.client.getQueryState([root])?.isInvalidated, root).toBe(true);
      expect(api.success).toHaveBeenCalledTimes(success ? 1 : 0);
      h.client.clear();
    },
  );
  it('reuses an uncertain create key, then starts a new intent only after confirmation', async () => {
    const h = harness();
    api.create
      .mockRejectedValueOnce(new Error('lost response'))
      .mockResolvedValue({ expenseId: 'expense-1' });
    const hook = renderHook(() => useCreateExpenseAtomic(), {
      wrapper: h.wrapper,
    });
    await act(async () => {
      await hook.result.current.mutateAsync(payload).catch(() => undefined);
    });
    await act(async () => {
      await hook.result.current.mutateAsync(payload);
    });
    expect(api.create.mock.calls[1][0].requestId).toBe(
      api.create.mock.calls[0][0].requestId,
    );
    await act(async () => {
      await hook.result.current.mutateAsync(payload);
    });
    expect(api.create.mock.calls[2][0].requestId).not.toBe(
      api.create.mock.calls[0][0].requestId,
    );
    h.client.clear();
  });
  it.each([true, false])(
    'invalidates update read models even if its acknowledgement is uncertain (success=%s)',
    async (success) => {
      const h = harness();
      api.update.mockImplementation(() =>
        success
          ? Promise.resolve({ id: 'expense-1' })
          : Promise.reject(new Error('lost response')),
      );
      const hook = renderHook(() => useUpdateExpense('expense-1'), {
        wrapper: h.wrapper,
      });
      await act(async () => {
        await hook.result.current
          .mutateAsync({
            property_id: 'property-1',
            category: 'صيانة',
            amount: 20,
            expense_date: '2026-09-01',
            description: null,
          })
          .catch(() => undefined);
      });
      for (const root of [...financialReadModelRoots, 'expenses'])
        expect(h.client.getQueryState([root])?.isInvalidated, root).toBe(true);
      h.client.clear();
    },
  );
});
