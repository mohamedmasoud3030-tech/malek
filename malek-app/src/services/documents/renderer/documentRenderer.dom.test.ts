// @vitest-environment happy-dom
/**
 * Renderer DOM contract tests (HTML print/preview emitter).
 *
 * Verifies the real generated markup and the print popup lifecycle: A4/RTL
 * standalone sheet, native print fragmentation semantics (repeated table
 * headers, atomic signatures), whole-table rendering (no pre-chunking),
 * self-hosted Tajawal faces, popup-blocked handling, single-flight
 * double-activation protection, bounded image waits, and XSS neutralization.
 * The vector PDF peer is covered by pdfArtifacts.test.ts and the golden gate.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedDocumentModel } from '../types';

import { DocumentRenderError, DocumentRenderer } from '../DocumentRenderer';
import { buildDocumentBodyHtml, buildPrintableDocumentHtml } from './documentHtml';
import { IMAGE_WAIT_TIMEOUT_MS, waitForImages } from './offscreen';

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RTL A4 document structure', () => {
  it('the printable document is a standalone RTL Arabic A4 page with native print fragmentation', () => {
    const html = buildPrintableDocumentHtml(baseModel);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
    expect(html).toContain('size: A4 portrait');
    expect(html).toContain('table-header-group'); // repeated table headers in real print
    expect(html).toContain('فاتورة مطالبة مالية');
    expect(html).toContain('شركة الأفق لإدارة الأملاك');
  });

  it('self-hosts Tajawal in the print sheet (same faces the vector PDF embeds)', () => {
    const html = buildPrintableDocumentHtml(baseModel);
    expect(html).toContain("/fonts/Tajawal-400.ttf");
    expect(html).toContain("/fonts/Tajawal-900.ttf");
    expect(html).not.toContain('fonts.googleapis.com'); // fully offline-capable
  });

  it('renders each logical table WHOLE — the browser repeats thead natively (no pre-chunking)', () => {
    const body = buildDocumentBodyHtml(baseModel);
    expect(body.match(/<table/g)).toHaveLength(1);
    expect(body.match(/<thead>/g)).toHaveLength(1);
    expect(body.match(/<tfoot>/g)).toHaveLength(1);
    expect(body).toContain('12,750.000 ر.ع');
  });

  it('numeric columns stay direction-stable (left) while text columns align right', () => {
    const body = buildDocumentBodyHtml(baseModel);
    const firstRow = body.slice(body.indexOf('<tbody>'), body.indexOf('</tbody>'));
    expect(firstRow).toContain('text-align: right'); // date/description cells
    expect(firstRow).toContain('text-align: left'); // numeric amount cell
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

  it('keeps the signature block atomic so it can never be clipped mid-way', () => {
    const body = buildDocumentBodyHtml(baseModel);
    const signatureStart = body.indexOf('التوقيعات والاعتماد');
    expect(signatureStart).toBeGreaterThan(-1);
    const signatureBlock = body.slice(body.lastIndexOf('<div class="document-block"', signatureStart), body.indexOf('وقت الإنشاء'));
    expect(signatureBlock).toContain('page-break-inside: avoid');
    expect(signatureBlock).toContain('ختم الشركة');
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

  it('surfaces a clear Arabic error when fonts fail to load', async () => {
    const fontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.reject(new Error('font boom')) },
    });
    vi.stubGlobal('open', vi.fn(() => makePopup()));
    await expect(DocumentRenderer.printDocument(baseModel)).rejects.toThrow(DocumentRenderError);
    await expect(DocumentRenderer.printDocument(baseModel)).rejects.toThrow(/تعذر تحميل الخط المطلوب للطباعة/);
    if (fontsDescriptor) Object.defineProperty(document, 'fonts', fontsDescriptor);
    else Reflect.deleteProperty(document, 'fonts');
  });
});

describe('preview fragment isolation', () => {
  it('never injects <style>/<link> or a full document into the app DOM', () => {
    const fragment = buildDocumentBodyHtml(baseModel);
    expect(fragment).not.toMatch(/<style|<link|<html|<head/i);
    expect(fragment).not.toContain('DOCTYPE');
  });

  it('carries fully inline-styled blocks so preview and print share one layout (no class-dependent rules)', () => {
    const body = buildDocumentBodyHtml(baseModel);
    const printable = buildPrintableDocumentHtml(baseModel);
    // Header layout is inline — identical in both artifacts.
    for (const markup of [body, printable]) {
      expect(markup).toContain('border-bottom: 3px double #0F172A');
      expect(markup).toContain('font-weight: 900'); // company brand
    }
    // The popup stylesheet keeps ONLY page/body/table rules — no class rules,
    // so preview and print can never diverge.
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
