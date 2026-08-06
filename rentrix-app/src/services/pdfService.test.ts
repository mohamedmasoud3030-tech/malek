/**
 * Compatibility-adapter error propagation tests.
 *
 * The legacy `pdfService` used to fire-and-forget
 * (`void import(...).then(...)`), silently dropping every render failure.
 * These tests pin the new contract: the adapters return real promises,
 * engine/renderer failures reject through them, and a missing company
 * identity surfaces the Arabic readiness error — never a silent success.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rendererMock = vi.hoisted(() => ({
  printDocument: vi.fn(async () => undefined),
  downloadDocumentPdf: vi.fn(async () => undefined),
}));

vi.mock('./documents/DocumentRenderer', () => ({
  DocumentRenderer: rendererMock,
  DocumentRenderError: class DocumentRenderError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
      super(message);
      this.name = 'DocumentRenderError';
    }
  },
}));

import {
  exportBalanceSheetToPdf,
  exportContractToPdf,
  exportExpenseToPdf,
  exportIncomeStatementToPdf,
  exportInvoiceToPdf,
  exportTrialBalanceToPdf,
} from './pdfService';
import type { Contract, Expense, Invoice } from '@/types/domain';

const readyDb = {
  settings: { company: { companyName: 'شركة الأفق', defaultCurrency: 'OMR' } },
  contracts: [],
  tenants: [],
  units: [],
  properties: [],
};

const missingIdentityDb = {
  settings: { company: { companyName: '', defaultCurrency: '' } },
  contracts: [],
  tenants: [],
  units: [],
  properties: [],
};

beforeEach(() => {
  rendererMock.downloadDocumentPdf.mockClear();
  rendererMock.printDocument.mockClear();
});

describe('pdfService compatibility adapters return real promises', () => {
  it('resolves through to the renderer on the PDF path (never print)', async () => {
    const expense = { id: 'exp-1', property_id: null, category: 'صيانة', amount: 20, expense_date: '2026-07-25', description: null } as unknown as Expense;
    await expect(exportExpenseToPdf(expense, readyDb)).resolves.toBeUndefined();
    expect(rendererMock.downloadDocumentPdf).toHaveBeenCalledTimes(1);
    expect(rendererMock.printDocument).not.toHaveBeenCalled();
  });

  it('accepts the legacy { general/operational } settings container without inventing identity', async () => {
    const legacySettings = {
      settings: {},
      general: { company: { name: 'شركة الأفق' } },
      operational: { currency: 'OMR' },
      contracts: [],
      tenants: [],
      units: [],
      properties: [],
    };
    const trial = { lines: [{ no: '1', name: 'الصندوق', debit: 1, credit: 0 }], totalDebit: 1, totalCredit: 1 };
    await expect(exportTrialBalanceToPdf(trial, legacySettings, '2026-07-31')).resolves.toBeUndefined();
    expect(rendererMock.downloadDocumentPdf).toHaveBeenCalledTimes(1);

    const pnl = { totalRevenue: 1, totalExpense: 0, netIncome: 1, revenues: [], expenses: [] };
    await expect(exportIncomeStatementToPdf(pnl, legacySettings, '2026-07')).resolves.toBeUndefined();

    const sheet = { assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0 };
    await expect(exportBalanceSheetToPdf(sheet, legacySettings, '2026-07-31')).resolves.toBeUndefined();
    expect(rendererMock.downloadDocumentPdf).toHaveBeenCalledTimes(3);
  });

  it('rejects with the Arabic identity error when company identity is incomplete', async () => {
    const invoice = { id: 'inv-1', contract_id: 'c-1', amount: 10, paid_amount: 0, status: 'UNPAID' } as unknown as Invoice;
    await expect(exportInvoiceToPdf(invoice, missingIdentityDb)).rejects.toThrow(/بيانات هوية الشركة غير مكتملة/);
    expect(rendererMock.downloadDocumentPdf).not.toHaveBeenCalled();

    const contract = { id: 'c-1', status: 'draft' } as unknown as Contract;
    await expect(exportContractToPdf(contract, missingIdentityDb)).rejects.toThrow(/بيانات هوية الشركة غير مكتملة/);
    expect(rendererMock.downloadDocumentPdf).not.toHaveBeenCalled();
  });

  it('propagates renderer failures instead of swallowing them', async () => {
    rendererMock.downloadDocumentPdf.mockRejectedValueOnce(new Error('popup night'));
    const expense = { id: 'exp-2', property_id: null, category: 'كهرباء', amount: 5, expense_date: '2026-07-25', description: null } as unknown as Expense;
    await expect(exportExpenseToPdf(expense, readyDb)).rejects.toThrow('popup night');
  });

  it('rejects malformed legacy payloads with a clear Arabic error', async () => {
    const expense = { id: 'exp-3' } as unknown as Expense;
    await expect(exportExpenseToPdf(expense, {} as never)).rejects.toThrow(/بنية بيانات المستند غير مدعومة|بيانات هوية الشركة غير مكتملة/);
  });
});
