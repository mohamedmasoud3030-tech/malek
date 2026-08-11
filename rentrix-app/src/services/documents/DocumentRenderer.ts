/**
 * DocumentRenderer — the ONLY place print and PDF output happens.
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
 *  - Arabic page numbers are captured as pixels (jsPDF core fonts cannot
 *    shape Arabic);
 *  - long documents are chunked/paginated between whole blocks — rows,
 *    totals and signature blocks are never clipped mid-way, table headers
 *    repeat on following pages, and blank pages are skipped;
 *  - a page-count cap prevents browser freezes on pathological documents;
 *  - every offscreen container is removed on success AND failure;
 *  - filenames pass through the registry sanitizer.
 */
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import type { UnifiedDocumentModel } from './types';
import { MAX_DOCUMENT_PDF_PAGES, sanitizeDocumentFileName } from './documentRegistry';
import { buildDocumentBodyHtml, buildPrintableDocumentHtml, collectDocumentTextChunks, escapeDocumentHtml, modelHasArabicText } from './renderer/documentHtml';
import { buildLatinPdf } from './renderer/latinPdf';
import { createPageNumberLabel, measureA4Metrics, paginateBlocks, type A4PageShell } from './renderer/pagination';
import { createOffscreenContainer, removeAllRenderContainers, settleLayout, waitForFontsReady, waitForImages, yieldToEventLoop, POPUP_READY_TIMEOUT_MS } from './renderer/offscreen';
import { documentIdentityKey } from './renderer/documentIdentity';

export { collectDocumentTextChunks, escapeDocumentHtml, modelHasArabicText };

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
const FONT_LOAD_FAILED_MESSAGE = 'تعذر تحميل الخط العربي المطلوب للطباعة. يرجى إعادة المحاولة أو التحقق من الاتصال بالإنترنت.';
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
async function printRtlDocument(model: UnifiedDocumentModel): Promise<void> {
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

export type ArabicPdfBuildResult = Readonly<{
  doc: jsPDF;
  pageCount: number;
  skippedBlankPages: number;
}>;

/**
 * Renders an Arabic-containing model into a real multi-page A4 jsPDF
 * document (does not save it). Exposed so artifact tests can assert on the
 * produced file (`%PDF-` magic, page count, blank-page behavior).
 */
export async function buildArabicDocumentPdf(model: UnifiedDocumentModel): Promise<ArabicPdfBuildResult> {
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
    const pages = paginateBlocks(container, metrics);

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
      page.shell.appendChild(createPageNumberLabel(renderedPages, visiblePages.length));

      // Each A4 page shell is captured inside its own sized render root.
      const host = createOffscreenContainer('');
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

/** Saves the Arabic PDF with a sanitized, registry-aligned filename. */
async function downloadRtlDocumentPdf(model: UnifiedDocumentModel): Promise<void> {
  const { doc } = await buildArabicDocumentPdf(model);
  doc.save(`${sanitizeDocumentFileName(model.fileName)}.pdf`);
}

/* ------------------------------------------------------------------ */
/* Latin (non-Arabic) fallback                                          */
/* ------------------------------------------------------------------ */

async function printLatinDocument(model: UnifiedDocumentModel): Promise<void> {
  let blobUrl: string | null = null;
  let popup: Window | null = null;
  // Belt-and-braces: even if `afterprint` never fires, the object URL is
  // revoked after a bounded delay so it cannot leak for the session.
  let revokeTimer: ReturnType<typeof setTimeout> | null = null;
  const revoke = () => {
    if (revokeTimer) clearTimeout(revokeTimer);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = null;
  };
  try {
    const doc = buildLatinPdf(model);
    doc.autoPrint();
    popup = openPrintWindowSafely();
    blobUrl = String(doc.output('bloburl'));
    const openedPopup = popup;
    openedPopup.addEventListener(
      'afterprint',
      () => {
        try {
          openedPopup.close();
        } catch {
          // Already closed by the user.
        }
        // `revoke()` clears the watchdog timer as well, so the successful
        // path leaves neither an object URL nor a pending timer behind.
        revoke();
      },
      { once: true },
    );
    openedPopup.location.href = blobUrl;
    revokeTimer = setTimeout(revoke, 120_000);
  } catch (error) {
    try {
      popup?.close();
    } catch {
      // Already closed.
    }
    revoke();
    if (error instanceof DocumentRenderError) throw error;
    throw new DocumentRenderError(PDF_GENERATION_FAILED_MESSAGE, error);
  }
}

async function downloadLatinDocumentPdf(model: UnifiedDocumentModel): Promise<void> {
  try {
    buildLatinPdf(model).save(`${sanitizeDocumentFileName(model.fileName)}.pdf`);
  } catch (error) {
    throw new DocumentRenderError(PDF_GENERATION_FAILED_MESSAGE, error);
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

export const DocumentRenderer = {
  /** Opens a scoped A4 print preview of this document and triggers the print dialog. Never a full-page print. */
  async printDocument(model: UnifiedDocumentModel): Promise<void> {
    await withSingleFlight(documentIdentityKey('print', model), async () => {
      if (modelHasArabicText(model)) {
        await printRtlDocument(model);
        return;
      }
      await printLatinDocument(model);
    });
  },

  /** Downloads a real application/pdf file for this document. Never opens window.print. */
  async downloadDocumentPdf(model: UnifiedDocumentModel): Promise<void> {
    await withSingleFlight(documentIdentityKey('pdf', model), async () => {
      if (modelHasArabicText(model)) {
        await downloadRtlDocumentPdf(model);
        return;
      }
      await downloadLatinDocumentPdf(model);
    });
  },
};

export type { A4PageShell };
