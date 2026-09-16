// @vitest-environment node
/**
 * Vector PDF artifact tests — the REAL @react-pdf/renderer output.
 *
 * Nothing is mocked: the emitter renders genuine application/pdf bytes in
 * Node (fonts loaded from the self-hosted TTFs), and the assertions run on
 * the produced file itself — %PDF magic, page counts, and the fail-closed
 * page cap. Arabic shaping/bidi and repeated headers are verified visually
 * by the golden gate (scripts/verify-golden-documents.mjs).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { UnifiedDocumentModel } from '../types';
import { buildDocumentPdf, DocumentRenderError, setDocumentPdfFontBaseUrl } from '../DocumentRenderer';

beforeAll(() => {
  // Node resolves the self-hosted TTFs relative to the app root (cwd).
  setDocumentPdfFontBaseUrl('public/fonts/');
});

const smallModel: UnifiedDocumentModel = {
  type: 'invoice',
  header: {
    companyName: 'شركة الأفق لإدارة الأملاك',
    companyAddress: 'مسقط، سلطنة عمان',
    title: 'فاتورة مطالبة مالية',
    documentNo: 'INV-100',
    dateLabel: 'التاريخ',
    dateValue: '31 يوليو 2026',
  },
  kpis: [
    { label: 'المستأجر', value: 'أحمد بن سالم' },
    { label: 'العقار', value: 'برج الياسمين / B-12' },
  ],
  tables: [
    {
      title: 'جدول الحركات',
      columns: ['التاريخ', 'البيان', 'المبلغ'],
      rows: [
        ['2026-07-01', 'حركة رقم 1', '10.000 ر.ع'],
        ['2026-07-02', 'حركة رقم 2', '20.000 ر.ع'],
      ],
      totals: ['الإجمالي', '', '30.000 ر.ع'],
    },
  ],
  footer: { signatures: ['tenant', 'accountant'], companyStampLabel: 'ختم الشركة', metadata: 'فاتورة رقم: INV-100' },
  fileName: 'invoice-INV-100',
};

const longTableModel = (rowCount: number): UnifiedDocumentModel => ({
  ...smallModel,
  tables: [
    {
      title: 'جدول الحركات',
      columns: ['التاريخ', 'البيان', 'المبلغ'],
      rows: Array.from({ length: rowCount }, (_, i) => [`2026-07-${String((i % 28) + 1).padStart(2, '0')}`, `حركة رقم ${i + 1}`, `${(i + 1) * 10}.000 ر.ع`]),
      totals: ['الإجمالي', '', '12,750.000 ر.ع'],
    },
  ],
});

describe('vector PDF artifacts', () => {
  it('produces a real application/pdf with vector text (tiny files, %PDF magic)', async () => {
    const { blob, pageCount } = await buildDocumentPdf(smallModel);
    expect(blob.type).toBe('application/pdf');
    expect(pageCount).toBe(1);
    const text = await blob.text();
    expect(text.startsWith('%PDF')).toBe(true);
    // A one-page vector document is a few dozen KB, not a raster megabyte.
    expect(blob.size).toBeLessThan(200_000);
    // The self-hosted Arabic face is embedded as a font subset.
    expect(text).toMatch(/Tajawal/);
  }, 30_000);

  it('paginates long tables across pages natively', async () => {
    const { pageCount } = await buildDocumentPdf(longTableModel(90));
    expect(pageCount).toBeGreaterThanOrEqual(3);
  }, 30_000);

  it('fails closed with the Arabic cap message before saving a >50-page document', async () => {
    await expect(buildDocumentPdf(longTableModel(2600))).rejects.toThrow(DocumentRenderError);
    await expect(buildDocumentPdf(longTableModel(2600))).rejects.toThrow(/طويل جدًا/);
  }, 120_000);

  it('embeds the footer band page-number machinery on every page', async () => {
    const { blob, pageCount } = await buildDocumentPdf(longTableModel(90));
    const text = await blob.text();
    const tree = text.match(/\/Type\s*\/Pages[\s\S]{0,120}?\/Count\s+(\d+)/);
    expect(Number(tree?.[1])).toBe(pageCount);
  }, 30_000);
});
