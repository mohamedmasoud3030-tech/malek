import { beforeEach, describe, expect, it, vi } from 'vitest';
import { financialReportKeys } from '../reports/useFinancialReports';
import { expenseKeys, useCreateExpenseAtomic, useUpdateExpense } from './useExpenses';

const mutationMock = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  useMutation: vi.fn((options) => options),
  useQuery: vi.fn((options) => options),
  useQueryClient: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: mutationMock.useMutation,
  useQuery: mutationMock.useQuery,
  useQueryClient: mutationMock.useQueryClient,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mutationMock.toastSuccess,
  },
}));

vi.mock('./expenseService', () => ({
  createExpenseWithJournal: vi.fn(),
  listExpenses: vi.fn(),
  updateExpense: vi.fn(),
}));

describe('expense report invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationMock.useQueryClient.mockReturnValue({ invalidateQueries: mutationMock.invalidateQueries });
    mutationMock.invalidateQueries.mockResolvedValue(undefined);
  });

  it('invalidates expense and financial report queries after creating an expense atomically', async () => {
    const mutationOptions = useCreateExpenseAtomic() as unknown as { onSuccess: () => Promise<void> };
    await mutationOptions.onSuccess();

    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: expenseKeys.all });
    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: financialReportKeys.all });
    expect(mutationMock.invalidateQueries).toHaveBeenCalledTimes(2);
    expect(mutationMock.toastSuccess).toHaveBeenCalledWith('تم إضافة المصروف وترحيله محاسبياً');
  });

  it('invalidates expense and financial report queries after updating an expense', async () => {
    const mutationOptions = useUpdateExpense('expense_1') as unknown as { onSuccess: () => Promise<void> };
    await mutationOptions.onSuccess();

    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: expenseKeys.all });
    expect(mutationMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: financialReportKeys.all });
    expect(mutationMock.invalidateQueries).toHaveBeenCalledTimes(2);
    expect(mutationMock.toastSuccess).toHaveBeenCalledWith('تم تحديث المصروف');
  });
});
