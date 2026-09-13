/**
 * DocumentRenderer — the ONLY place print and PDF output happens.
 *
 * One pipeline, every document, every language:
 *  - the engine model becomes inline-styled HTML blocks (documentHtml);
 *  - PRINT renders those blocks in a scoped A4 RTL popup and lets the
 *    browser paginate (repeated table headers via `thead` groups);
 *  - PDF paginates the same blocks into A4 shells and captures them with
 *    html2canvas into a real application/pdf — never a print dialog.
 *
 * Historically there was a second, Latin-only jsPDF text pipeline. It
 * produced documents that shared no visual system with the HTML layout
 * (no logo, no tables, no charts, no professional report bodies), so it
 * was removed: a Malek document must look identical on screen, on paper,
 * and in the exported PDF, regardless of the languages inside it.
 *
 * Print contract:
 *  - prints the document alone in a scoped A4 RTL popup, never the app screen;
 *  - waits for the POPUP's fonts and images before invoking print() (with a
 *    bounded watchdog so a stuck popup fails cleanly instead of hanging);
 *  - popup-closed cleanup on every failure path; closes after `afterprint`
 *    where the browser supports it;
 *  - popup-blocked produces a clear Arabic error.
 *
 * PDF contract:
 *  - produces a real application/pdf (multi-page A4), never a print dialog;
 *  - page footer bands (company / reference / page number) are captured as
 *    pixels (jsPDF core fonts cannot shape Arabic);
 *  - long documents are paginated between whole blocks — rows, totals and
 *    signature blocks are never clipped mid-way; oversized tables are
 *    split by measured row heights with headers repeated on every page,
 *    and blank pages are skipped;
 *  - a page-count cap prevents browser freezes on pathological documents;
 *  - every offscreen container is removed on success AND failure;
 *  - filenames pass through the registry sanitizer.
 */
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import type { UnifiedDocumentModel } from './types';
import { MAX_DOCUMENT_PDF_PAGES, sanitizeDocumentFileName } from './documentRegistry';
import { buildDocumentBodyHtml, buildPrintableDocumentHtml, collectDocumentTextChunks, escapeDocumentHtml } from './renderer/documentHtml';
import { createPageFooterBand, measureA4Metrics, paginateBlocks, type A4PageShell } from './renderer/pagination';
import { createOffscreenContainer, removeAllRenderContainers, settleLayout, waitForFontsReady, waitForImages, yieldToEventLoop, POPUP_READY_TIMEOUT_MS } from './renderer/offscreen';
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
  // Wrapping it keeps the map from being poisoned with a key that never
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

/**
 * Opens the document as an RTL A4 print preview and invokes the browser
 * print dialog for that document only — never the whole app screen. This
 * is the *print* path; it never produces a downloadable file.
 */
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
/* PDF path                                                             */
/* ------------------------------------------------------------------ */

export type DocumentPdfBuildResult = Readonly<{
  doc: jsPDF;
  pageCount: number;
  skippedBlankPages: number;
}>;

/**
 * Renders the model into a real multi-page A4 jsPDF document (does not
 * save it). Exposed so artifact tests can assert on the produced file
 * (`%PDF-` magic, page count, blank-page behavior).
 */
export async function buildDocumentPdf(model: UnifiedDocumentModel): Promise<DocumentPdfBuildResult> {
  try {
    await waitForFontsReady(document);
  } catch (error) {
    throw new DocumentRenderError(FONT_LOAD_FAILED_MESSAGE, error);
  }

  const container = createOffscreenContainer(buildDocumentBodyHtml(model, { withAuditFooter: true }));
  try {
    await waitForImages(container);
    await settleLayout();

    const metrics = measureA4Metrics(container);
    const pages = paginateBlocks(container, metrics, {
      footer: { companyName: model.header.companyName, documentRef: model.header.documentNo },
    });

    if (pages.length > MAX_DOCUMENT_PDF_PAGES) {
      throw new DocumentRenderError(TOO_MANY_PAGES_MESSAGE);
    }

    const visiblePages = pages.filter((page) => page.blockCount > 0);
    if (visiblePages.length === 0) {
      // Defensive: an entirely blank document is a data/readiness failure,
      // not a zero-page PDF. Fail closed with a user-safe Arabic message
      // rather than saving a file a user would read as "nothing is owed".
      throw new DocumentRenderError(EMPTY_DOCUMENT_MESSAGE);
    }

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    let renderedPages = 0;

    for (const page of visiblePages) {
      renderedPages += 1;
      page.shell.appendChild(
        createPageFooterBand(renderedPages, visiblePages.length, {
          companyName: model.header.companyName,
          documentRef: model.header.documentNo,
        }),
      );

      // Each A4 page shell is captured inside its own sized render root.
      const host = createOffscreenContainer('', { padded: false });
      host.appendChild(page.shell);

      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(page.shell, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#FFFFFF',
          logging: false,
        });
      } finally {
        // Detach the shell too: `host.remove()` alone leaves the shell
        // reachable from the (still referenced) page list, so a long
        // statement would hold every rendered page's DOM until GC.
        page.shell.remove();
        host.remove();
      }

      const imgData = canvas.toDataURL('image/png');
      if (renderedPages > 1) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);

      // Keep the browser responsive on long statements.
      await yieldToEventLoop();
    }

    return { doc: pdf, pageCount: renderedPages, skippedBlankPages: pages.length - visiblePages.length };
  } catch (error) {
    if (error instanceof DocumentRenderError) throw error;
    throw new DocumentRenderError(PDF_GENERATION_FAILED_MESSAGE, error);
  } finally {
    container.remove();
    // Belt-and-braces: a throw between `createOffscreenContainer` and the
    // inner `finally` above must not leave any tagged root in the live DOM.
    removeAllRenderContainers();
  }
}

/** Saves the PDF with a sanitized, registry-aligned filename. */
async function downloadDocumentPdf(model: UnifiedDocumentModel): Promise<void> {
  const { doc } = await buildDocumentPdf(model);
  doc.save(`${sanitizeDocumentFileName(model.fileName)}.pdf`);
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

export const DocumentRenderer = {
  /** Opens a scoped A4 print preview of this document and triggers the print dialog. Never a full-page print. */
  async printDocument(model: UnifiedDocumentModel): Promise<void> {
    await withSingleFlight(documentIdentityKey('print', model), () => printDocument(model));
  },

  /** Downloads a real application/pdf file for this document. Never opens window.print. */
  async downloadDocumentPdf(model: UnifiedDocumentModel): Promise<void> {
    await withSingleFlight(documentIdentityKey('pdf', model), () => downloadDocumentPdf(model));
  },

  /**
   * Builds the SAME real application/pdf file as `downloadDocumentPdf` but
   * returns it as a `File` instead of saving it. This is the honest source
   * for "share the generated PDF" flows: whatever the browser can attach,
   * it attaches exactly the file the print product would have produced —
   * nothing is fabricated for sharing. Callers fall back to download or a
   * secure link when the browser cannot share files.
   */
  async buildDocumentPdfFile(model: UnifiedDocumentModel): Promise<File> {
    return withSingleFlight(documentIdentityKey('pdf-file', model), async () => {
      const filename = `${sanitizeDocumentFileName(model.fileName)}.pdf`;
      const { doc } = await buildDocumentPdf(model);
      return new File([doc.output('blob')], filename, { type: 'application/pdf' });
    });
  },
};

export type { A4PageShell };
