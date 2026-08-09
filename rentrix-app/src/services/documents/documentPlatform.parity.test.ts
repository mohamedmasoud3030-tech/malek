/**
 * Print/PDF parity and financial pass-through contract (Phase 7).
 *
 * Locks the platform-wide rule that the SAME canonical `UnifiedDocumentModel`
 * produced by `documentEngine.buildDocument` from authoritative typed payloads
 * drives BOTH the print path and the PDF path — so a figure shown on screen,
 * on a printout, and inside the exported PDF can never diverge, because none
 * of the three is computed a second time by the renderer.
 *
 * Also pins legitimate zero/negative amounts: they must render verbatim with
 * the REAL company-currency precision (never dropped, never flipped to a
 * placeholder), because zero/negative figures are meaningful in statements.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { documentEngine } from './DocumentEngine';
import type { DocumentCompanySettings } from './companyIdentity';
import type { UnifiedDocumentModel } from './types';

type RenderOperation = (model: UnifiedDocumentModel) => Promise<void>;

/* ------------------------------------------------------------------ */
/* Controller wiring parity — the same model feeds print and PDF.      */
/* ------------------------------------------------------------------ */

const renderer = vi.hoisted(() => ({
  printDocument: vi.fn<RenderOperation>(async (_model: UnifiedDocumentModel) => undefined),
  downloadDocumentPdf: vi.fn<RenderOperation>(async (_model: UnifiedDocumentModel) => undefined),
}));

vi.mock('./DocumentRenderer', () => ({
  DocumentRenderer: {
    printDocument: renderer.printDocument,
    downloadDocumentPdf: renderer.downloadDocumentPdf,
  },
}));

import { DocumentController } from './DocumentController';

const settings: DocumentCompanySettings = {
  companyName: 'شركة الأفق لإدارة الأملاك',
  currency: 'OMR',
  currencySymbol: 'ر.ع',
  documentPrefixes: {},
};

describe('print/PDF parity — one engine model drives both outputs', () => {
  beforeEach(() => {
    renderer.printDocument.mockClear();
    renderer.downloadDocumentPdf.mockClear();
  });

  it('print and PDF consume an identical model for the same receipt payload', async () => {
    const input = {
      settings,
      payload: { amount: 250.5, payerName: 'أحمد بن سالم', paymentDate: '2026-08-01', paymentMethod: 'cash' },
    };
    await DocumentController.printDocument('receipt', input);
    await DocumentController.downloadDocumentPdf('receipt', input);

    expect(renderer.printDocument).toHaveBeenCalledTimes(1);
    expect(renderer.downloadDocumentPdf).toHaveBeenCalledTimes(1);

    const printModel = renderer.printDocument.mock.calls[0]![0];
    const pdfModel = renderer.downloadDocumentPdf.mock.calls[0]![0];

    // Financial cells, KPIs and the header grid are byte-for-byte identical
    // between the two render targets: no per-output recompute.
    expect(pdfModel.tables).toEqual(printModel.tables);
    expect(pdfModel.kpis).toEqual(printModel.kpis);
    expect(pdfModel.header).toEqual(printModel.header);

    // The amount passes through verbatim from the authoritative payload.
    const flat = printModel.tables[0].rows.flat().join(' | ');
    expect(flat).toContain('250.500 ر.ع');
  });

  it('statement totals are passed through, never derived by the render target', async () => {
    const input = {
      settings,
      payload: {
        ownerName: 'مالك العقار',
        periodFrom: '2026-01-01',
        periodTo: '2026-06-30',
        totalRent: 1000,
        totalExpenses: 300,
        totalCommission: 100,
        netAmount: 600,
        transactions: [
          { date: '2026-01-15', type: 'إيجار', description: 'قسط يناير', amount: 500 },
          { date: '2026-02-15', type: 'إيجار', description: 'قسط فبراير', amount: 500 },
        ],
      },
    };
    await DocumentController.printDocument('owner_statement', input);
    await DocumentController.downloadDocumentPdf('owner_statement', input);

    const printModel = renderer.printDocument.mock.calls[0]![0];
    const pdfModel = renderer.downloadDocumentPdf.mock.calls[0]![0];
    expect(pdfModel.tables).toEqual(printModel.tables);
    expect(pdfModel.kpis).toEqual(printModel.kpis);

    // The authoritative net figure appears verbatim, formatted to OMR, in
    // both the KPI and the totals row — never re-summed by the render path.
    const kpiNet = printModel.kpis.find((k) => k.label === 'صافي المستحق للمالك')?.value;
    expect(kpiNet).toBe('600.000 ر.ع');
    expect(printModel.tables[0].totals).toContain('600.000 ر.ع');
  });

  it('zero and negative amounts render verbatim with the real currency precision', () => {
    const receiptZero = documentEngine.buildDocument('receipt', {
      settings,
      payload: { amount: 0, payerName: 'بدون مبلغ', paymentDate: '2026-08-01' },
    });
    const flatZero = receiptZero.tables[0].rows.flat().join(' | ');
    expect(flatZero).toContain('0.000 ر.ع');

    const expenseNegative = documentEngine.buildDocument('expense_voucher', {
      settings,
      payload: { amount: -150.5, kind: 'expense', category: 'تسوية', description: 'قيد تسوية سالب' },
    });
    const flatNegative = expenseNegative.tables[0].rows.flat().join(' | ');
    expect(flatNegative).toContain('-150.500 ر.ع');
  });

  it('non-finite optional amounts degrade to a zero figure instead of a broken row', () => {
    // Required amounts are rejected by validation; an optional pass-through
    // figure (e.g. paidAmount on an invoice without an authoritative balance)
    // must never print NaN.
    const model = documentEngine.buildDocument('invoice', {
      settings,
      payload: { amount: 100, paidAmount: Number.NaN, totalAmount: 100, description: 'إيجار' },
    });
    const flat = model.tables[0].rows.flat().join(' | ');
    expect(flat).not.toContain('NaN');
  });
});
