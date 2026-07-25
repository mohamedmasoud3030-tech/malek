import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportExpenseVoucher, printExpenseVoucher } from './expense-actions';
import type { Expense, Property } from '@/types/domain';

vi.mock('@/services/documents/DocumentService', () => ({
  documentService: {
    print: vi.fn(async () => undefined),
    downloadPdf: vi.fn(async () => undefined),
  },
}));

const { documentService } = await import('@/services/documents/DocumentService');

const expense = {
  id: 'expense-1',
  property_id: 'property-1',
  category: 'صيانة',
  amount: 75,
  expense_date: '2026-07-25',
  description: 'إصلاح مضخة',
} as Expense;
const property = { id: 'property-1', title: 'برج صحار' } as Property;

describe('expense document actions', () => {
  beforeEach(() => {
    vi.mocked(documentService.print).mockClear();
    vi.mocked(documentService.downloadPdf).mockClear();
  });

  it('prints a scoped expense voucher document', async () => {
    await printExpenseVoucher(expense, property, 'Rentrix LLC', 'OMR');

    expect(documentService.print).toHaveBeenCalledWith({
      type: 'expense_voucher',
      payload: {
        expense,
        db: expect.objectContaining({
          settings: { company: { companyName: 'Rentrix LLC', defaultCurrency: 'OMR' } },
          properties: [property],
        }),
      },
    });
    expect(documentService.downloadPdf).not.toHaveBeenCalled();
  });

  it('downloads the same expense voucher as PDF', async () => {
    await exportExpenseVoucher(expense, property, 'Rentrix LLC', 'OMR');

    expect(documentService.downloadPdf).toHaveBeenCalledWith(expect.objectContaining({ type: 'expense_voucher' }));
    expect(documentService.print).not.toHaveBeenCalled();
  });
});
