/**
 * DocumentRenderer — the ONLY place print and PDF output happens.
 *
 * One model, two peer emitters (neither built from the other):
 *  - PRINT  → the model becomes inline-styled HTML (documentHtml) rendered
 *    in a scoped A4 RTL popup; the BROWSER paginates natively (repeated
 *    table headers via `thead` groups, row-level break avoidance).
 *  - PDF    → the model becomes a VECTOR PDF (@react-pdf/renderer): real
 *    selectable/searchable text, HarfBuzz-shaped Arabic, native pagination
 *    with repeated table headers and native page numbers in the footer band.
 *
 * The raster era (html2canvas screenshots stitched into jsPDF) is gone: it
 * produced blurry, heavy, unsearchable files and forced a fragile manual
 * paginator to compensate for capturing whole pages as images.
 *
 * Print contract:
 *  - prints the document alone in a scoped A4 RTL popup, never the app screen;
 *  - waits for the POPUP's fonts and images before invoking print() (with a
 *    bounded watchdog so a stuck popup fails cleanly instead of hanging);
 *  - popup-closed cleanup on every failure path; closes after `afterprint`
 *    where the browser supports it; popup-blocked produces a clear Arabic error.
 *
 * PDF contract:
 *  - produces a real application/pdf (multi-page A4), never a print dialog;
 *  - footer band (company / reference / صفحة X من Y) repeats on every page;
 *  - tables keep their headers on every page; rows never split mid-row;
 *  - a page-count cap prevents pathological documents from freezing the tab;
 *  - filenames pass through the registry sanitizer.
 */
import { createElement as h, type ReactElement } from 'react';
import { pdf, type DocumentProps } from '@react-pdf/renderer';
import type { UnifiedDocumentModel } from './types';
import { MAX_DOCUMENT_PDF_PAGES, sanitizeDocumentFileName } from './documentRegistry';
import { buildPrintableDocumentHtml, collectDocumentTextChunks, escapeDocumentHtml } from './renderer/documentHtml';
import { ModelPdfDocument, registerDocumentPdfFonts } from './renderer/pdf/pdfDocument';
import { POPUP_READY_TIMEOUT_MS, settleLayout, waitForFontsReady, waitForImages } from './renderer/offscreen';
import { documentIdentityKey } from './renderer/documentIdentity';

export { collectDocumentTextChunks, escapeDocumentHtml };

/**
 * Errors the print/PDF engine raises. Callers (page components) should
 * catch these and show `error.message` directly — every message here is
 * already a complete, user-facing Arabic sentence.
 */
export class DocumentRenderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DocumentRenderError';
  }
}

const POPUP_BLOCKED_MESSAGE = 'تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع ثم إعادة المحاولة.';
const FONT_LOAD_FAILED_MESSAGE = 'تعذر تحميل الخط المطلوب للطباعة. يرجى إعادة المحاولة أو التحقق من الاتصال بالإنترنت.';
const PDF_GENERATION_FAILED_MESSAGE = 'تعذر إنشاء ملف PDF لهذا المستند. يرجى إعادة المحاولة، وإذا استمرت المشكلة يرجى التواصل مع الدعم الفني.';
const POPUP_LOAD_FAILED_MESSAGE = 'تعذر تجهيز نافذة الطباعة في الوقت المناسب. يرجى إعادة المحاولة.';
const EMPTY_DOCUMENT_MESSAGE = 'تعذر إنشاء المستند: لا يوجد محتوى قابل للطباعة في هذا المستند. يرجى التحقق من البيانات ثم إعادة المحاولة.';
const TOO_MANY_PAGES_MESSAGE = `هذا المستند طويل جدًا ولا يمكن تحويله إلى PDF دفعة واحدة (أكثر من ${MAX_DOCUMENT_PDF_PAGES} صفحة). يرجى تضييق نطاق الفترة أو المعايير ثم إعادة المحاولة.`;

/* ------------------------------------------------------------------ */
/* Single-flight guard — a double activation must never open two        */
/* popups or render two PDFs for the same document.                     */
/* ------------------------------------------------------------------ */

const inFlightRenders = new Map<string, Promise<unknown>>();

function withSingleFlight<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const existing = inFlightRenders.get(key);
  if (existing) return existing as Promise<T>;
  // `operation()` may throw synchronously (a caller bug, a stubbed global).
  // Wrapping it keeps the map from being poisoned by a key that never
  // clears, which would silently block every later activation.
  let promise: Promise<T>;
  try {
    promise = operation();
  } catch (error) {
    return Promise.reject(error);
  }
  const tracked = promise.finally(() => {
    inFlightRenders.delete(key);
  });
  // Attach a no-op rejection handler to the *stored* promise only: without
  // it, a rejection observed by just one of two concurrent callers can
  // surface as an unhandled rejection. The returned promise still rejects.
  tracked.catch(() => undefined);
  inFlightRenders.set(key, tracked);
  return tracked;
}

/** Test/diagnostic seam: drops any tracked in-flight render keys. */
export function resetDocumentRenderState(): void {
  inFlightRenders.clear();
}

/* ------------------------------------------------------------------ */
/* Print path                                                           */
/* ------------------------------------------------------------------ */

const openPrintWindowSafely = (): Window => {
  const popup = globalThis.open('', '_blank', 'width=1024,height=768');
  if (!popup) throw new DocumentRenderError(POPUP_BLOCKED_MESSAGE);
  return popup;
};

async function waitForPopupLoad(popup: Window): Promise<void> {
  if (popup.document.readyState === 'complete') return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new DocumentRenderError(POPUP_LOAD_FAILED_MESSAGE));
    }, POPUP_READY_TIMEOUT_MS);
    popup.addEventListener(
      'load',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

async function waitForPopupAssets(popup: Window): Promise<void> {
  await waitForImages(popup.document);
  try {
    // Tolerate browsers without the Font Loading API and slow font loads
    // (timeout ⇒ the approved Arabic fallback stack renders instead).
    await waitForFontsReady(popup.document);
  } catch (error) {
    throw new DocumentRenderError(FONT_LOAD_FAILED_MESSAGE, error);
  }
}

/** Opens the document as an RTL A4 print preview and invokes the browser
 * print dialog for that document only — never the whole app screen. This
 * is the *print* path; it never produces a downloadable file. */
async function printDocument(model: UnifiedDocumentModel): Promise<void> {
  try {
    await waitForFontsReady(document);
  } catch (error) {
    throw new DocumentRenderError(FONT_LOAD_FAILED_MESSAGE, error);
  }

  const popup = openPrintWindowSafely();
  try {
    popup.document.open();
    popup.document.write(buildPrintableDocumentHtml(model));
    popup.document.close();

    await waitForPopupLoad(popup);
    await waitForPopupAssets(popup);
    await settleLayout();

    popup.addEventListener(
      'afterprint',
      () => {
        try {
          popup.close();
        } catch {
          // Already closed by the user.
        }
      },
      { once: true },
    );
    popup.focus();
    popup.print();
  } catch (error) {
    // Never leave an orphan window behind after a failed print.
    try {
      popup.close();
    } catch {
      // Already closed.
    }
    if (error instanceof DocumentRenderError) throw error;
    throw new DocumentRenderError(POPUP_LOAD_FAILED_MESSAGE, error);
  }
}

/* ------------------------------------------------------------------ */
/* PDF path — vector, via @react-pdf/renderer                           */
/* ------------------------------------------------------------------ */

export type DocumentPdfBuildResult = Readonly<{
  blob: Blob;
  pageCount: number;
}>;

/** Page count straight from the PDF page tree (`/Type /Pages /Count N`). */
async function countPdfPages(blob: Blob): Promise<number> {
  const text = await blob.text();
  const tree = text.match(/\/Type\s*\/Pages[\s\S]{0,120}?\/Count\s+(\d+)/) ?? text.match(/\/Count\s+(\d+)\s*\/Kids/);
  return tree ? Number(tree[1]) : 0;
}

/**
 * Renders the model into a real multi-page A4 VECTOR pdf (does not save).
 * Exposed so artifact tests and the golden gate can assert on the produced
 * file (%PDF magic, page count, extractable text).
 */
/**
 * Conservative pre-render page estimate (≈25 rows/page). Rendering is the
 * expensive step, so a pathological document must be rejected BEFORE the
 * vector engine spends minutes laying it out — the cap fails closed fast.
 */
function estimatePageCount(model: UnifiedDocumentModel): number {
  const rows =
    model.tables.reduce((sum, t) => sum + t.rows.length, 0) +
    (model.professional?.groups ?? []).reduce(
      (sum, g) => sum + g.blocks.reduce((s, b) => s + (b.kind === 'table' ? b.table.rows.length : 0), 0),
      0,
    );
  return Math.ceil(rows / 25) + 2;
}

export async function buildDocumentPdf(model: UnifiedDocumentModel): Promise<DocumentPdfBuildResult> {
  if (estimatePageCount(model) > MAX_DOCUMENT_PDF_PAGES) {
    throw new DocumentRenderError(TOO_MANY_PAGES_MESSAGE);
  }
  registerDocumentPdfFonts(pdfFontBaseUrl());
  let blob: Blob;
  try {
    blob = await pdf(h(ModelPdfDocument, { model }) as ReactElement<DocumentProps>).toBlob();
  } catch (error) {
    throw new DocumentRenderError(PDF_GENERATION_FAILED_MESSAGE, error);
  }

  const pageCount = await countPdfPages(blob);
  if (pageCount > MAX_DOCUMENT_PDF_PAGES) {
    throw new DocumentRenderError(TOO_MANY_PAGES_MESSAGE);
  }
  if (pageCount === 0) {
    // A zero-page document is a data/readiness failure, not an empty file.
    // Fail closed with a user-safe Arabic message rather than saving a file
    // a user would read as "nothing is owed".
    throw new DocumentRenderError(EMPTY_DOCUMENT_MESSAGE);
  }
  return { blob, pageCount };
}

/** Browser serves the self-hosted TTFs from /fonts/; tests may override. */
let fontBaseUrl = '/fonts/';
export function setDocumentPdfFontBaseUrl(url: string): void {
  fontBaseUrl = url;
}
const pdfFontBaseUrl = () => fontBaseUrl;

/** Saves the PDF with a sanitized, registry-aligned filename. */
async function downloadDocumentPdf(model: UnifiedDocumentModel): Promise<void> {
  const { blob } = await buildDocumentPdf(model);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${sanitizeDocumentFileName(model.fileName)}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

export const DocumentRenderer = {
  /** Opens a scoped A4 print preview of this document and triggers the print dialog. Never a full-page print. */
  async printDocument(model: UnifiedDocumentModel): Promise<void> {
    await withSingleFlight(documentIdentityKey('print', model), () => printDocument(model));
  },

  /** Downloads a real vector application/pdf file for this document. Never opens window.print. */
  async downloadDocumentPdf(model: UnifiedDocumentModel): Promise<void> {
    await withSingleFlight(documentIdentityKey('pdf', model), () => downloadDocumentPdf(model));
  },

  /**
   * Builds the SAME real application/pdf file as `downloadDocumentPdf` but
   * returns it as a `File` instead of saving it. This is the honest source
   * for "share the generated PDF" flows: whatever the browser can attach,
   * it attaches exactly the file the PDF product produced — nothing is
   * fabricated for sharing. Callers fall back to download or a secure link
   * when the browser cannot share files.
   */
  async buildDocumentPdfFile(model: UnifiedDocumentModel): Promise<File> {
    return withSingleFlight(documentIdentityKey('pdf-file', model), async () => {
      const filename = `${sanitizeDocumentFileName(model.fileName)}.pdf`;
      const { blob } = await buildDocumentPdf(model);
      return new File([blob], filename, { type: 'application/pdf' });
    });
  },
};
