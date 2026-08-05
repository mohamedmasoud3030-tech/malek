// @vitest-environment happy-dom
/**
 * Latin PDF fallback artifact tests.
 *
 * `buildLatinPdf` is the native-text jsPDF path used ONLY for models with
 * no Arabic text anywhere (`modelHasArabicText` gates it). These tests pin:
 *  - the artifact is a real multi-page application/pdf;
 *  - header/KPI/table/totals/footer content actually lands on the pages;
 *  - signature chrome renders LATIN labels — no Arabic glyph may ever
 *    reach jsPDF's core fonts (they cannot shape Arabic).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const textRecorder = vi.hoisted(() => ({ lines: [] as string[] }));

vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf')>();
  class CapturingJsPDF extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args);
      // jsPDF v4 installs `text` as an own instance property — capture it
      // before wrapping.
      const originalText = this.text.bind(this);
      this.text = ((text: string | string[], x: number, y: number, ...rest: unknown[]) => {
        textRecorder.lines.push(...(Array.isArray(text) ? text : [text]).map(String));
        return originalText(text, x, y, ...rest);
      }) as typeof this.text;
    }
  }
  return { ...actual, jsPDF: CapturingJsPDF };
});

import { buildLatinPdf } from './latinPdf';
import type { UnifiedDocumentModel } from '../types';

const latinModel: UnifiedDocumentModel = {
  type: 'generic_report',
  header: {
    companyName: 'Afaq Property Management LLC',
    companyAddress: 'Muscat, Oman',
    companyPhone: '+968 9000 0000',
    title: 'Occupancy Report',
    documentNo: 'RPT-82',
    dateLabel: 'Period',
    dateValue: '2026-07-01 - 2026-07-31',
  },
  kpis: [
    { label: 'Occupancy', value: '92%' },
    { label: 'Units', value: '120' },
  ],
  tables: [
    {
      title: 'Occupancy by property',
      columns: ['Property', 'Occupied', 'Vacant'],
      rows: Array.from({ length: 80 }, (_, index) => [`Property ${index + 1}`, `${(index * 3) % 21}`, `${(index * 2) % 7}`]),
      totals: ['Total', '850', '140'],
    },
  ],
  footer: { signatures: ['accountant', 'general_manager'], companyStampLabel: 'Company stamp area', metadata: 'Occupancy report' },
  fileName: 'report-occupancy',
};

const shortLatinModel: UnifiedDocumentModel = {
  ...latinModel,
  tables: [{ columns: ['Item'], rows: [['One row']] }],
  footer: { signatures: [], companyStampLabel: null, metadata: null },
};

beforeEach(() => {
  textRecorder.lines.length = 0;
});

describe('latin PDF fallback (non-Arabic models only)', () => {
  it('produces a genuine non-empty multi-page application/pdf', () => {
    const doc = buildLatinPdf(latinModel);
    const bytes = new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(1000);
    // 80 rows + header + signatures must paginate beyond one A4 page.
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  it('keeps a short latin document on exactly one page', () => {
    const doc = buildLatinPdf(shortLatinModel);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('writes the full document content as native text', () => {
    buildLatinPdf(latinModel);
    const blob = textRecorder.lines.join('\n');
    expect(blob).toContain('Afaq Property Management LLC');
    expect(blob).toContain('Occupancy Report');
    expect(blob).toContain('No: RPT-82');
    expect(blob).toContain('Period: 2026-07-01 - 2026-07-31');
    expect(blob).toContain('Occupancy:');
    expect(blob).toContain('Property | Occupied | Vacant');
    expect(blob).toContain('Property 80 |');
    expect(blob).toContain('Total | 850 | 140');
    expect(blob).toContain('Company stamp area');
  });

  it('renders LATIN signature labels — Arabic glyphs never reach the core-font path', () => {
    buildLatinPdf(latinModel);
    const blob = textRecorder.lines.join('\n');
    expect(blob).toContain('Accountant: ____________________');
    expect(blob).toContain('General Manager: ____________________');
    expect(blob).not.toMatch(/[؀-ۿ]/);
  });
});
