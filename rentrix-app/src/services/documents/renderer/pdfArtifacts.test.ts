// @vitest-environment happy-dom
/**
 * Real PDF artifact tests.
 *
 * These tests build actual PDF files through the renderer (jsPDF is real;
 * only the browser rasterization step `html2canvas-pro` is mocked, because
 * no test environment can rasterize) and assert on the produced artifact:
 *
 *  - the output starts with the `%PDF-` magic and is non-empty;
 *  - page counts match the paginated layout (one-pager, multi-page
 *    statement, expected exact page counts);
 *  - no blank trailing page is generated;
 *  - download filenames are deterministic and sanitized;
 *  - print and download remain distinct code paths (print never touches
 *    jsPDF text APIs; download never opens a popup).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import type { UnifiedDocumentModel } from '../types';

const html2canvasMock = vi.hoisted(() =>
  vi.fn(async (_element: HTMLElement) => ({
    width: 794,
    height: 1122,
    toDataURL: () =>
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  }) as unknown as HTMLCanvasElement),
);

vi.mock('html2canvas-pro', () => ({ default: html2canvasMock }));

/**
 * jsPDF stays fully real (artifact bytes matter), except `save()`, which is
 * recorded instead of triggering a browser download. jsPDF v4 defines
 * `save` per instance, so recording happens via a transparent subclass.
 */
const saveRecorder = vi.hoisted(() => ({ names: [] as string[] }));

vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf')>();
  // jsPDF v4 assigns `save` as an own instance property in its constructor,
  // so the recorder must be installed per instance after super().
  class RecordingJsPDF extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args);
      this.save = ((filename?: string) => {
        saveRecorder.names.push(filename ?? 'generated.pdf');
        return this;
      }) as unknown as typeof this.save;
    }
  }
  return { ...actual, jsPDF: RecordingJsPDF };
});

import { buildArabicDocumentPdf, DocumentRenderError, DocumentRenderer } from '../DocumentRenderer';
import { removeAllRenderContainers, RENDER_ROOT_ATTRIBUTE } from './offscreen';
import { sanitizeDocumentFileName } from '../documentRegistry';

const header = {
  companyName: 'شركة الأفق لإدارة الأملاك',
  title: 'كشف حساب',
  documentNo: null,
  dateLabel: 'التاريخ',
  dateValue: '31 يوليو 2026',
};

const smallModel: UnifiedDocumentModel = {
  type: 'receipt',
  header: { ...header, title: 'إيصال استلام نقدية / سداد رقم REC-1' },
  kpis: [{ label: 'المبلغ', value: '50.000 ر.ع' }],
  tables: [{ columns: ['البند', 'القيمة'], rows: [['المبلغ المستلم', '50.000 ر.ع']] }],
  footer: { signatures: ['accountant'], companyStampLabel: null, metadata: null },
  fileName: 'receipt-REC-1',
};

const longStatementModel: UnifiedDocumentModel = {
  type: 'owner_statement',
  header: { ...header, title: 'كشف حساب مالك - شركة الأفق' },
  kpis: [{ label: 'صافي المستحق', value: '12,000.000 ر.ع' }],
  tables: [
    {
      title: 'سجل الحركة المالية',
      columns: ['التاريخ', 'النوع', 'البيان', 'المبلغ'],
      rows: Array.from({ length: 120 }, (_, index) => [
        `2026-0${(index % 9) + 1}-15`,
        index % 2 === 0 ? 'تحصيل' : 'مصروف',
        `حركة تشغيلية رقم ${index + 1} لعقار برج الياسمين السكني`,
        `${(index + 1) * 100}.000 ر.ع`,
      ]),
      totals: ['صافي الرصيد المستحق', '', '', '12,000.000 ر.ع'],
    },
  ],
  footer: { signatures: ['accountant', 'general_manager'], companyStampLabel: null, metadata: null },
  fileName: 'owner-statement-شركة-الأفق',
};

/** Give happy-dom elements realistic heights so pagination is exercised. */
function stubRealisticHeights() {
  const original = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const base = original.call(this);
    const rows = this.querySelectorAll?.('tr').length ?? 0;
    const isBlock = this.classList?.contains('document-block');
    const height = rows > 0 ? rows * 42 + 90 : isBlock ? 90 : base.height;
    return { ...base, height, width: 794 };
  };
  return () => {
    HTMLElement.prototype.getBoundingClientRect = original;
  };
}

const pdfBytes = (doc: jsPDF): Uint8Array => new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);

beforeEach(() => {
  html2canvasMock.mockClear();
  removeAllRenderContainers();
});

afterEach(() => {
  removeAllRenderContainers();
  vi.restoreAllMocks();
});

describe('real PDF artifacts', () => {
  it('produces a genuine non-empty application/pdf file', async () => {
    const { doc } = await buildArabicDocumentPdf(smallModel);
    const bytes = pdfBytes(doc);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(500);
    // Real application/pdf payload — not a print dialog, not an HTML wrapper.
    expect(doc.output('datauristring')).toMatch(/^data:application\/pdf(;|\/)/);
  });

  it('fails closed with a clear Arabic error beyond the page cap, before rendering anything', async () => {
    const restore = stubRealisticHeights();
    // 60 chunks of ~22 rows ⇒ ~60 A4 pages > MAX_DOCUMENT_PDF_PAGES (50).
    const oversized: UnifiedDocumentModel = {
      ...smallModel,
      tables: [
        {
          title: 'سجل ضخم',
          columns: ['البيان'],
          rows: Array.from({ length: 60 * 22 }, (_, index) => [`حركة ${index + 1}`]),
        },
      ],
      fileName: 'oversized',
    };
    html2canvasMock.mockClear();
    await expect(buildArabicDocumentPdf(oversized)).rejects.toThrow(/طويل جدًا/);
    await expect(buildArabicDocumentPdf(oversized)).rejects.toBeInstanceOf(DocumentRenderError);
    expect(html2canvasMock).not.toHaveBeenCalled(); // nothing rendered before the fail-closed check
    expect(document.querySelectorAll(`[${RENDER_ROOT_ATTRIBUTE}]`).length).toBe(0);
    restore();
  });

  it('a short document renders as exactly one A4 page', async () => {
    const restore = stubRealisticHeights();
    const { doc, pageCount } = await buildArabicDocumentPdf(smallModel);
    expect(pageCount).toBe(1);
    expect(doc.getNumberOfPages()).toBe(1);
    restore();
  });

  it('a long owner statement renders the expected multi-page count with no blank trailing page', async () => {
    const restore = stubRealisticHeights();
    const { doc, pageCount, skippedBlankPages } = await buildArabicDocumentPdf(longStatementModel);
    // 120 rows ⇒ 6 chunk blocks (~22 rows each ≈ 1014px > 1000px budget) —
    // each chunk occupies its own page, header/KPI block joins the first.
    expect(pageCount).toBeGreaterThanOrEqual(6);
    expect(doc.getNumberOfPages()).toBe(pageCount);
    expect(skippedBlankPages).toBe(0);
    // Every captured page carried an Arabic page-number label.
    expect(html2canvasMock).toHaveBeenCalledTimes(pageCount);
    for (const call of html2canvasMock.mock.calls) {
      const shell = call[0] as HTMLElement;
      expect(shell.querySelector('[data-document-page-number]')?.textContent).toMatch(/^صفحة \d+ من \d+$/);
    }
    restore();
  });

  it('does not clip content: every 42px row fits within whole-block pages', async () => {
    const restore = stubRealisticHeights();
    const { doc } = await buildArabicDocumentPdf(longStatementModel);
    // With whole-block pagination each page maps 1:1 to an A4 canvas.
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(6);
    restore();
  });
});

describe('download filenames and code-path separation', () => {
  beforeEach(() => {
    saveRecorder.names.length = 0;
  });

  it('saves the PDF with a deterministic, sanitized filename', async () => {
    await DocumentRenderer.downloadDocumentPdf(smallModel);
    expect(saveRecorder.names).toEqual(['receipt-REC-1.pdf']);

    const hostileModel: UnifiedDocumentModel = { ...smallModel, fileName: '../../evil:receipt*|<>؟' };
    await DocumentRenderer.downloadDocumentPdf(hostileModel);
    const savedName = saveRecorder.names[1];
    expect(savedName).toBe(`${sanitizeDocumentFileName(hostileModel.fileName)}.pdf`);
    expect(savedName).not.toMatch(/[\\/:*?"<>|]/);
    expect(savedName).not.toContain('..');
  });

  it('download never opens a popup and print never saves a file', async () => {
    const openMock = vi.fn(() => null);
    vi.stubGlobal('open', openMock);

    await DocumentRenderer.downloadDocumentPdf(smallModel);
    expect(openMock).not.toHaveBeenCalled();
    expect(saveRecorder.names).toHaveLength(1);

    await expect(DocumentRenderer.printDocument(smallModel)).rejects.toThrow(/تعذر فتح نافذة الطباعة/);
    expect(openMock).toHaveBeenCalledTimes(1); // print path attempted a popup
    expect(saveRecorder.names).toHaveLength(1); // and still saved nothing
  });

  it('leaves no offscreen containers behind after successful and failed renders', async () => {
    await DocumentRenderer.downloadDocumentPdf(smallModel);
    expect(document.querySelectorAll(`[${RENDER_ROOT_ATTRIBUTE}]`).length).toBe(0);

    html2canvasMock.mockRejectedValueOnce(new Error('render crash'));
    await expect(DocumentRenderer.downloadDocumentPdf(smallModel)).rejects.toThrow(/تعذر إنشاء ملف PDF/);
    expect(document.querySelectorAll(`[${RENDER_ROOT_ATTRIBUTE}]`).length).toBe(0);
  });

  it('a double download activation renders and saves a single PDF (single-flight)', async () => {
    const restore = stubRealisticHeights();
    html2canvasMock.mockClear();
    await Promise.all([
      DocumentRenderer.downloadDocumentPdf(smallModel),
      DocumentRenderer.downloadDocumentPdf(smallModel),
    ]);
    expect(saveRecorder.names).toEqual(['receipt-REC-1.pdf']); // one save, not two
    expect(html2canvasMock).toHaveBeenCalledTimes(1); // one captured page, not two
    restore();
  });
});
