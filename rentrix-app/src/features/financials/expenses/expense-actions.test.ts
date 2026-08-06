import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportExpenseVoucher, printExpenseVoucher } from './expense-actions';
import type { DocumentCompanySettings } from '@/services/documents/companyIdentity';
import type { Expense, Property } from '@/types/domain';

vi.mock('@/services/documents/DocumentService', () => ({
  documentService: {
    printDocument: vi.fn(async () => undefined),
    downloadDocumentPdf: vi.fn(async () => undefined),
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
const settings = {
  companyName: 'Rentrix LLC',
  currency: 'OMR',
  documentPrefixes: {},
} as DocumentCompanySettings;

describe('expense document actions', () => {
  beforeEach(() => {
    vi.mocked(documentService.printDocument).mockClear();
    vi.mocked(documentService.downloadDocumentPdf).mockClear();
  });

  it('prints a scoped expense voucher through the canonical typed service', async () => {
    await printExpenseVoucher(expense, property, settings);

    expect(documentService.printDocument).toHaveBeenCalledWith('expense_voucher', {
      settings,
      payload: {
        reference: null,
        date: '2026-07-25',
        category: 'صيانة',
        amount: 75,
        description: 'إصلاح مضخة',
        propertyTitle: 'برج صحار',
        kind: 'expense',
      },
    });
    expect(documentService.downloadDocumentPdf).not.toHaveBeenCalled();
  });

  it('downloads the same expense voucher as PDF', async () => {
    await exportExpenseVoucher(expense, property, settings);

    expect(documentService.downloadDocumentPdf).toHaveBeenCalledWith('expense_voucher', expect.objectContaining({ settings, payload: expect.objectContaining({ amount: 75 }) }));
    expect(documentService.printDocument).not.toHaveBeenCalled();
  });
});
