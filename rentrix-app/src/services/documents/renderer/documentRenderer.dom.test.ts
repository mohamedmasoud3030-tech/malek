// @vitest-environment happy-dom
/**
 * Renderer DOM contract tests.
 *
 * Verifies the real generated markup and DOM lifecycle: A4/RTL structure,
 * repeated table headers across page chunks, atomic signature blocks,
 * multi-page splitting between whole blocks, Arabic page numbering as
 * pixels, offscreen-container cleanup on success and failure, popup-blocked
 * handling, broken-logo tolerance, font-failure errors, single-flight
 * double-activation protection, and XSS neutralization.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedDocumentModel } from '../types';

const html2canvasMock = vi.hoisted(() =>
  vi.fn(async (element: HTMLElement) => {
    const width = element.getBoundingClientRect().width || 794;
    const height = element.getBoundingClientRect().height || 1122;
    return {
      width,
      height,
      toDataURL: () =>
        // Real 1x1 transparent PNG so jsPDF can parse image data.
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    } as unknown as HTMLCanvasElement;
  }),
);

vi.mock('html2canvas-pro', () => ({ default: html2canvasMock }));

import { buildArabicDocumentPdf, DocumentRenderError, DocumentRenderer } from '../DocumentRenderer';
import { buildDocumentBodyBlocks, buildDocumentBodyHtml, buildPrintableDocumentHtml, chunkTableBlocks } from './documentHtml';
import { createOffscreenContainer, IMAGE_WAIT_TIMEOUT_MS, removeAllRenderContainers, RENDER_ROOT_ATTRIBUTE, waitForImages } from './offscreen';
import { createPageNumberLabel, measureA4Metrics, paginateBlocks } from './pagination';

const baseModel: UnifiedDocumentModel = {
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
      rows: Array.from({ length: 50 }, (_, index) => [`2026-07-${String((index % 28) + 1).padStart(2, '0')}`, `حركة رقم ${index + 1}`, `${(index + 1) * 10}.000 ر.ع`]),
      totals: ['الإجمالي', '', '12,750.000 ر.ع'],
    },
  ],
  footer: { signatures: ['tenant', 'accountant', 'general_manager'], companyStampLabel: null, metadata: 'فاتورة رقم: INV-100' },
  fileName: 'invoice-INV-100',
};

const renderRootCount = () => document.querySelectorAll(`[${RENDER_ROOT_ATTRIBUTE}]`).length;

beforeEach(() => {
  html2canvasMock.mockClear();
  removeAllRenderContainers();
});

afterEach(() => {
  removeAllRenderContainers();
  vi.restoreAllMocks();
});

describe('RTL A4 document structure', () => {
  it('the printable document is a standalone RTL Arabic A4 page', () => {
    const html = buildPrintableDocumentHtml(baseModel);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
    expect(html).toContain('size: A4 portrait');
    expect(html).toContain('table-header-group'); // repeated table headers in real print
    expect(html).toContain('فاتورة مطالبة مالية');
    expect(html).toContain('شركة الأفق لإدارة الأملاك');
  });

  it('numeric columns stay direction-stable (left) while text columns align right', () => {
    const container = createOffscreenContainer(buildDocumentBodyHtml(baseModel));
    const firstRowCells = container.querySelectorAll('tbody tr:first-child td');
    expect(firstRowCells[0].getAttribute('style')).toContain('text-align: right'); // التاريخ نصي هنا (يحمل شرطات)
    expect(firstRowCells[2].getAttribute('style')).toContain('text-align: left'); // المبلغ رقمي
    container.remove();
  });

  it('renders an explicit Arabic empty-state note when a table has no rows', () => {
    const model: UnifiedDocumentModel = {
      ...baseModel,
      tables: [{ columns: ['التاريخ', 'البيان'], rows: [], emptyNote: 'لا توجد حركات مالية في الفترة المحددة.' }],
    };
    const html = buildDocumentBodyHtml(model);
    expect(html).toContain('لا توجد حركات مالية في الفترة المحددة.');
    expect(html).toContain('colspan="2"');
  });
});

describe('table chunking and repeated headers', () => {
  it('splits long tables into page-sized chunks that each repeat the header', () => {
    const blocks = chunkTableBlocks(baseModel.tables[0]);
    expect(blocks.length).toBe(3); // 22 + 22 + 6 rows
    for (const block of blocks) {
      expect(block.html).toContain('<thead>');
      expect(block.html).toContain('المبلغ');
    }
    // Table title appears only on the first block; totals only on the last.
    expect(blocks[0].title).toBe('جدول الحركات');
    expect(blocks[1].title).toBeUndefined();
    expect(blocks[0].html).not.toContain('توقيع');
    expect(blocks[0].html).not.toContain('<tfoot>');
    expect(blocks[2].html).toContain('<tfoot>');
    expect(blocks[2].html).toContain('12,750.000 ر.ع');
  });

  it('keeps the signature block atomic so it can never be clipped mid-way', () => {
    const blocks = buildDocumentBodyBlocks(baseModel);
    const signatureBlocks = blocks.filter((block) => block.includes('التوقيعات والاعتماد'));
    expect(signatureBlocks).toHaveLength(1);
    expect(signatureBlocks[0]).toContain('page-break-inside: avoid');
    expect(signatureBlocks[0]).toContain('ختم الشركة');
  });
});

describe('A4 pagination', () => {
  const stubHeight = (element: HTMLElement, height: number) => {
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ height, width: 794, top: 0, left: 0, right: 794, bottom: height }),
      configurable: true,
    });
  };

  it('splits blocks across pages without ever splitting a block', () => {
    const container = createOffscreenContainer('');
    container.innerHTML = '';
    const heights = [400, 700, 700, 300, 900];
    for (const height of heights) {
      const block = document.createElement('div');
      block.textContent = `block-${height}`;
      container.appendChild(block);
      stubHeight(block, height);
    }

    const metrics = { pageHeightPx: 1122, contentHeightPx: 1000, pxPerMm: 794 / 210 };
    const pages = paginateBlocks(container, metrics);

    // 400+700=1100>1000 ⇒ p1:[400], p2:[700], 700+300=1000 ⇒ p3:[700,300], p4:[900]
    expect(pages.map((page) => page.blockCount)).toEqual([1, 1, 2, 1]);
    expect(pages[0].blockCount + pages[1].blockCount + pages[2].blockCount + pages[3].blockCount).toBe(5);
    container.remove();
  });

  it('measures A4 in millimetres with a content budget after margins', () => {
    const container = createOffscreenContainer('');
    Object.defineProperty(container, 'clientWidth', { value: 794, configurable: true });
    const metrics = measureA4Metrics(container);
    expect(metrics.pxPerMm).toBeCloseTo(794 / 210, 4);
    expect(metrics.pageHeightPx).toBe(Math.round(297 * (794 / 210)));
    expect(metrics.contentHeightPx).toBe(Math.round((297 - 12 - 15) * (794 / 210)));
    container.remove();
  });

  it('renders page numbers as Arabic pixel labels (jsPDF cannot shape Arabic text)', () => {
    const label = createPageNumberLabel(2, 5);
    expect(label.textContent).toBe('صفحة 2 من 5');
    expect(label.getAttribute('data-document-page-number')).not.toBeNull();
  });
});

describe('PDF render lifecycle', () => {
  it('produces one captured canvas per page and cleans every offscreen container', async () => {
    const result = await buildArabicDocumentPdf(baseModel);
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
    expect(html2canvasMock).toHaveBeenCalledTimes(result.pageCount);
    expect(renderRootCount()).toBe(0);
    expect(result.doc.getNumberOfPages()).toBe(result.pageCount);
  });

  it('injects an Arabic page-number label into every captured page', async () => {
    await buildArabicDocumentPdf(baseModel);
    for (const call of html2canvasMock.mock.calls) {
      const shell = call[0] as HTMLElement;
      expect(shell.querySelector('[data-document-page-number]')?.textContent).toMatch(/صفحة \d+ من \d+/);
    }
  });

  it('cleans up offscreen containers when capture fails', async () => {
    html2canvasMock.mockRejectedValueOnce(new Error('canvas exploded'));
    await expect(buildArabicDocumentPdf(baseModel)).rejects.toThrow(DocumentRenderError);
    expect(renderRootCount()).toBe(0);
  });

  it('surfaces a clear Arabic error when fonts fail to load', async () => {
    const fontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.reject(new Error('font boom')) },
    });
    await expect(buildArabicDocumentPdf(baseModel)).rejects.toThrow(/تعذر تحميل الخط العربي المطلوب للطباعة/);
    expect(renderRootCount()).toBe(0);
    if (fontsDescriptor) Object.defineProperty(document, 'fonts', fontsDescriptor);
    else Reflect.deleteProperty(document, 'fonts');
  });
});

describe('print popup lifecycle', () => {
  const makePopup = () => {
    const listeners = new Map<string, Array<() => void>>();
    const popup = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        readyState: 'complete',
        fonts: undefined,
        querySelectorAll: () => [],
      },
      addEventListener: vi.fn((event: string, handler: () => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), handler]);
      }),
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
      __emit: (event: string) => (listeners.get(event) ?? []).forEach((handler) => handler()),
    };
    return popup;
  };

  it('prints only the scoped document popup and closes it after afterprint', async () => {
    const popup = makePopup();
    vi.stubGlobal('open', vi.fn(() => popup));

    await DocumentRenderer.printDocument(baseModel);

    expect(popup.document.write).toHaveBeenCalledTimes(1);
    const writtenHtml = popup.document.write.mock.calls[0][0] as string;
    expect(writtenHtml).toContain('dir="rtl"');
    expect(writtenHtml).toContain('فاتورة مطالبة مالية');
    expect(popup.print).toHaveBeenCalledTimes(1);

    expect(popup.close).not.toHaveBeenCalled();
    popup.__emit('afterprint');
    expect(popup.close).toHaveBeenCalledTimes(1);
  });

  it('a double activation renders a single popup (single-flight)', async () => {
    const popup = makePopup();
    const openMock = vi.fn(() => popup);
    vi.stubGlobal('open', openMock);

    await Promise.all([DocumentRenderer.printDocument(baseModel), DocumentRenderer.printDocument(baseModel)]);
    expect(openMock).toHaveBeenCalledTimes(1);
    expect(popup.print).toHaveBeenCalledTimes(1);
  });

  it('throws the Arabic popup-blocked message when window.open returns null', async () => {
    vi.stubGlobal('open', vi.fn(() => null));
    await expect(DocumentRenderer.printDocument(baseModel)).rejects.toThrow(/تعذر فتح نافذة الطباعة/);
    expect(renderRootCount()).toBe(0);
  });

  it('closes the popup when asset preparation fails', async () => {
    const popup = makePopup();
    popup.document.readyState = 'loading';
    vi.stubGlobal('open', vi.fn(() => popup));
    // No 'load' event ever fires and happy-dom timers can be advanced via a short timeout override.
    vi.useFakeTimers();
    const pending = DocumentRenderer.printDocument(baseModel);
    const assertion = expect(pending).rejects.toThrow(/تعذر تجهيز نافذة الطباعة/);
    await vi.advanceTimersByTimeAsync(11_000);
    await assertion;
    expect(popup.close).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  }, 20_000);
});

describe('offscreen isolation from the live app document', () => {
  it('never injects <style>/<link> or a full document into the app DOM; <head> stays untouched', () => {
    const fragment = buildDocumentBodyHtml(baseModel);
    expect(fragment).not.toMatch(/<style|<link|<html|<head/i);
    expect(fragment).not.toContain('DOCTYPE');

    const headHtmlBefore = document.head.innerHTML;
    const headCountBefore = document.head.childElementCount;
    const styleSheetCountBefore = document.styleSheets.length;

    const container = createOffscreenContainer(fragment);
    expect(document.head.innerHTML).toBe(headHtmlBefore);
    expect(document.head.childElementCount).toBe(headCountBefore);
    expect(document.styleSheets.length).toBe(styleSheetCountBefore);

    container.remove();
    expect(document.head.innerHTML).toBe(headHtmlBefore);
    expect(document.styleSheets.length).toBe(styleSheetCountBefore);
  });

  it('carries fully inline-styled blocks so print and offscreen PDF share one layout (no class-dependent rules)', () => {
    const body = buildDocumentBodyHtml(baseModel);
    const printable = buildPrintableDocumentHtml(baseModel);
    // Header layout is inline — identical in both artifacts.
    for (const markup of [body, printable]) {
      expect(markup).toContain('border-bottom: 3px double #0F172A');
      expect(markup).toContain('font-size: 20px; font-weight: 900'); // company brand
    }
    // The popup stylesheet keeps ONLY page/body/table rules — the former
    // class rules were removed so PDF and print can never diverge.
    expect(printable).not.toMatch(/\.(header-container|company-brand|company-sub|doc-title-badge|doc-meta|stamp-box|footer-audit)\s*\{/);
  });

  it('a stalled image never hangs the render (bounded per-image wait)', async () => {
    const root = document.createElement('div');
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: false, configurable: true });
    root.appendChild(img);

    const marker = vi.fn();
    vi.useFakeTimers(); // fake BEFORE the wait installs its timeout
    const pending = waitForImages(root).then(marker);
    await vi.advanceTimersByTimeAsync(IMAGE_WAIT_TIMEOUT_MS - 100);
    expect(marker).not.toHaveBeenCalled(); // still waiting within the bound
    await vi.advanceTimersByTimeAsync(200);
    expect(marker).toHaveBeenCalledTimes(1); // timed out and proceeded
    vi.useRealTimers();
    await pending;
  });
});

describe('XSS neutralization in generated markup', () => {
  it('escapes hostile names, descriptions, and notes in all document regions', () => {
    const hostile = `<img src=x onerror=alert(1)><script>alert("x")</script>`;
    const model: UnifiedDocumentModel = {
      ...baseModel,
      header: { ...baseModel.header, companyName: hostile, title: hostile, documentNo: hostile },
      kpis: [{ label: hostile, value: hostile }],
      tables: [{ title: hostile, columns: [hostile], rows: [[hostile]], totals: [hostile] }],
      footer: { signatures: ['accountant'], companyStampLabel: hostile, metadata: hostile },
      fileName: 'x',
    };
    const html = buildDocumentBodyHtml(model);
    const printable = buildPrintableDocumentHtml(model);
    for (const markup of [html, printable]) {
      // No executable markup survives; the payload is present only as inert,
      // entity-escaped text (`&lt;img ...&gt;`), which is safe by design.
      expect(markup).not.toContain('<img src=x');
      expect(markup).not.toContain('<script>alert');
      expect(markup).not.toMatch(/<script|<img/);
      expect(markup).toContain('&lt;img');
      expect(markup).toContain('&lt;script&gt;');
    }
  });
});
