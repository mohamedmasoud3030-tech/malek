/**
 * A4 pagination for the offscreen PDF path.
 *
 * The paginator receives the flat block structure produced by
 * `buildDocumentBodyHtml` and distributes blocks across fixed-height A4
 * page shells. Rules:
 *
 *  - blocks never split EXCEPT tables: a table taller than the remaining
 *    (or total) page budget is split by MEASURED row heights, repeating
 *    its column header on every continuation page and printing its totals
 *    only on the final part — so a long statement can never overflow a
 *    page or be clipped by the shell's `overflow: hidden`;
 *  - rows, totals and signature blocks stay atomic;
 *  - a block's OUTER height (height + vertical margins) is what consumes
 *    the page budget — measuring only content height silently overfilled
 *    pages and clipped bottom content, which this module must never do;
 *  - every page shell carries the shared page footer band (company /
 *    reference / `صفحة X من Y`), captured as pixels because jsPDF core
 *    fonts cannot shape Arabic.
 *
 * Every produced page shell is exactly A4-proportioned (210×297mm at the
 * container's pixel density) with the print margins baked in as padding,
 * so each captured canvas maps 1:1 onto a PDF page.
 */
import { DOCUMENT_COLORS, DOCUMENT_PAGE, DOCUMENT_TYPE } from '../documentDesignTokens';

export type PageMargins = Readonly<{ topMm: number; rightMm: number; bottomMm: number; leftMm: number }>;

/** Registry/renderer share ONE margin definition (`documentDesignTokens`). */
export const A4_PAGE_MARGINS: PageMargins = {
  topMm: DOCUMENT_PAGE.marginsMm.top,
  rightMm: DOCUMENT_PAGE.marginsMm.right,
  bottomMm: DOCUMENT_PAGE.marginsMm.bottom,
  leftMm: DOCUMENT_PAGE.marginsMm.left,
};

export type A4PageShell = {
  /** The A4-proportioned wrapper to capture (includes margins + footer band). */
  shell: HTMLElement;
  /** Number of content blocks on this page (0 ⇒ blank, must be skipped). */
  blockCount: number;
};

export type A4Metrics = Readonly<{
  /** Full A4 page height in px at the container's density (297mm). */
  pageHeightPx: number;
  /** Content budget per page after vertical margins. */
  contentHeightPx: number;
  pxPerMm: number;
}>;

/** Identity printed on every page footer band (never invented). */
export type DocumentPageFooterInfo = Readonly<{
  companyName?: string | null;
  /** Real business reference (`رقم المستند`) when the document has one. */
  documentRef?: string | null;
}>;

export function measureA4Metrics(container: HTMLElement, margins: PageMargins = A4_PAGE_MARGINS): A4Metrics {
  const widthPx = container.clientWidth > 0 ? container.clientWidth : 794;
  const pxPerMm = widthPx / DOCUMENT_PAGE.widthMm;
  const pageHeightPx = Math.round(DOCUMENT_PAGE.heightMm * pxPerMm);
  const contentHeightPx = Math.round((DOCUMENT_PAGE.heightMm - margins.topMm - margins.bottomMm) * pxPerMm);
  return { pageHeightPx, contentHeightPx, pxPerMm };
}

const blockHeight = (element: HTMLElement): number => {
  const rect = element.getBoundingClientRect();
  if (rect.height > 0) return rect.height;
  // Fallbacks for minimal environments; real browsers always use rect.
  return element.offsetHeight || 0;
};

const parsePx = (value: string | undefined | null): number => {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
};

type VerticalMargins = Readonly<{ marginTop: number; marginBottom: number }>;

const verticalMargins = (element: HTMLElement): VerticalMargins => {
  const style = typeof getComputedStyle === 'function' ? getComputedStyle(element) : null;
  return { marginTop: parsePx(style?.marginTop), marginBottom: parsePx(style?.marginBottom) };
};

/**
 * The space a block actually occupies vertically: content height PLUS its
 * vertical margins. Blocks carry section gaps as margins, and the browser
 * applies them between siblings — omitting them from the budget overfills
 * pages and clips the last block.
 */
export function outerHeight(element: HTMLElement): number {
  const { marginTop, marginBottom } = verticalMargins(element);
  return Math.ceil(blockHeight(element) + marginTop + marginBottom);
}

/**
 * The budget a block consumes when appended AFTER a previous block,
 * emulating CSS adjacent-margin collapsing exactly the way the browser
 * print engine lays the same blocks out: the gap between two consecutive
 * blocks is `max(prevBottom, thisTop)`, never their sum. Counting the sum
 * over-reserves the page and pushes content that genuinely fits onto
 * extra pages — the "one document becomes 2–3 pages" defect.
 */
function appendedBudget(element: HTMLElement, height: number, previousMarginBottom: number | null): number {
  const { marginTop, marginBottom } = verticalMargins(element);
  // The previous block's bottom margin was ALREADY consumed with that
  // block; only the part of the collapsed gap that exceeds it is new.
  const gap = previousMarginBottom == null ? marginTop : Math.max(previousMarginBottom, marginTop) - previousMarginBottom;
  return Math.ceil(height + gap + marginBottom);
}

/* ------------------------------------------------------------------ */
/* Table splitting                                                     */
/* ------------------------------------------------------------------ */

const findSplittableTable = (block: HTMLElement): HTMLTableElement | null => {
  const table = block.querySelector('table');
  if (!table) return null;
  return table.querySelector('tbody tr') ? table : null;
};

type TablePartPlan = { element: HTMLElement; height: number };

/**
 * Splits one block containing a table into page-sized parts.
 *
 * `firstBudget` is the space left on the current page; every following
 * part gets the full `pageBudget`. Row heights are measured on the
 * ORIGINAL rows (laid out in the measurement container), then rows are
 * packed greedily. Every part repeats `<thead>`; `<tfoot>` stays on the
 * final part; the table title stays on the first part.
 *
 * Returns `[]` when `firstBudget` cannot even hold the table header plus
 * one row — the caller then moves the whole block to a fresh page. Every
 * returned part's measured height respects its budget, and all rows are
 * consumed across the returned parts.
 */
export function splitTableBlock(
  block: HTMLElement,
  options: { firstBudget: number; pageBudget: number },
): TablePartPlan[] {
  const table = findSplittableTable(block);
  if (!table) return [];

  const rows = Array.from(table.querySelectorAll('tbody tr')) as HTMLElement[];
  if (rows.length === 0) return [];

  const rowHeights = rows.map((row) => Math.ceil(blockHeight(row)));
  const thead = table.querySelector('thead') as HTMLElement | null;
  const tfoot = table.querySelector('tfoot') as HTMLElement | null;
  const theadHeight = thead ? Math.ceil(blockHeight(thead)) : 0;
  const tfootHeight = tfoot ? Math.ceil(blockHeight(tfoot)) : 0;
  const tableContentHeight = theadHeight + tfootHeight + rowHeights.reduce((sum, height) => sum + height, 0);
  // Non-table vertical overhead of the block (e.g. a section title).
  const titleOverhead = Math.max(0, Math.ceil(blockHeight(block)) - tableContentHeight);
  const margins = outerHeight(block) - Math.ceil(blockHeight(block));

  const parts: TablePartPlan[] = [];
  let cursor = 0;
  let isFirstPart = true;
  let budget = Math.min(options.firstBudget, options.pageBudget);

  // First page cannot even take header + one row ⇒ let the caller move on.
  if (budget < theadHeight + titleOverhead + margins + rowHeights[0]) return [];

  while (cursor < rows.length) {
    const fixed = theadHeight + (isFirstPart ? titleOverhead : 0) + margins;
    let used = fixed;
    let count = 0;
    while (cursor + count < rows.length) {
      const completesTable = cursor + count + 1 === rows.length;
      const next = used + rowHeights[cursor + count] + (completesTable && tfoot ? tfootHeight : 0);
      if (next > budget && count > 0) break;
      used = next;
      count += 1;
    }
    // A part always advances — the entry guard above ensures the first
    // budget fits at least one row, and full-page budgets always do too.
    if (count === 0) count = 1;

    const partRows = rows.slice(cursor, cursor + count);
    const isFinalPart = cursor + count >= rows.length;
    parts.push({
      element: buildTablePart(block, partRows, { keepTitle: isFirstPart, keepTfoot: Boolean(tfoot) && isFinalPart }),
      height: used,
    });
    cursor += count;
    isFirstPart = false;
    budget = options.pageBudget;
  }

  return parts;
}

/** Clones the block and keeps only the given table rows in it. */
function buildTablePart(
  block: HTMLElement,
  partRows: HTMLElement[],
  options: { keepTitle: boolean; keepTfoot: boolean },
): HTMLElement {
  const part = block.cloneNode(true) as HTMLElement;
  const partTable = part.querySelector('table');
  if (!partTable) return part;

  // Non-table content (titles) belongs to the first part only.
  if (!options.keepTitle) {
    Array.from(part.children).forEach((child) => {
      if (!child.matches('table') && !child.querySelector('table')) child.remove();
    });
  }

  const tbody = partTable.querySelector('tbody');
  if (tbody) {
    tbody.innerHTML = '';
    partRows.forEach((row) => tbody.appendChild(row.cloneNode(true)));
  }
  const partTfoot = partTable.querySelector('tfoot');
  if (partTfoot && !options.keepTfoot) partTfoot.remove();
  return part;
}

/* ------------------------------------------------------------------ */
/* Page shells                                                         */
/* ------------------------------------------------------------------ */

const makeShell = (margins: PageMargins): { shell: HTMLElement; content: HTMLElement } => {
  const shell = document.createElement('div');
  shell.setAttribute('data-document-page', '');
  shell.style.width = `${DOCUMENT_PAGE.widthMm}mm`;
  shell.style.height = `${DOCUMENT_PAGE.heightMm}mm`;
  shell.style.position = 'relative';
  shell.style.overflow = 'hidden';
  shell.style.background = DOCUMENT_COLORS.page;
  const content = document.createElement('div');
  content.style.padding = `${margins.topMm}mm ${margins.rightMm}mm ${margins.bottomMm}mm ${margins.leftMm}mm`;
  content.style.boxSizing = 'border-box';
  // The shell content carries the SAME base typography as the measurement
  // container and the print stylesheet — shells capture in a foreign host
  // page whose default fonts/line-height would otherwise shrink wrapped
  // text and desynchronize PDF pagination from measurement and print.
  content.style.direction = 'rtl';
  content.style.fontFamily = DOCUMENT_TYPE.fontFamily;
  content.style.fontSize = DOCUMENT_TYPE.body.replace('font-size: ', '');
  content.style.lineHeight = DOCUMENT_TYPE.lineHeight;
  content.style.color = DOCUMENT_COLORS.ink;
  shell.appendChild(content);
  return { shell, content };
};

/**
 * The per-page footer band rendered inside the bottom margin: company
 * identity on the leading (right, RTL) edge, the real document reference
 * in the middle when one exists, and the page number last. Page numbering
 * lives HERE — documents never hand-roll their own.
 */
export function createPageFooterBand(pageIndex: number, totalPages: number, info: DocumentPageFooterInfo = {}): HTMLElement {
  const band = document.createElement('div');
  band.setAttribute('data-document-page-footer', '');
  band.style.position = 'absolute';
  band.style.bottom = '4mm';
  band.style.left = `${A4_PAGE_MARGINS.leftMm}mm`;
  band.style.right = `${A4_PAGE_MARGINS.rightMm}mm`;
  band.style.display = 'flex';
  band.style.justifyContent = 'space-between';
  band.style.alignItems = 'baseline';
  band.style.gap = '8px';
  band.style.borderTop = `1px solid ${DOCUMENT_COLORS.border}`;
  band.style.paddingTop = '1.5mm';
  band.style.fontSize = DOCUMENT_TYPE.pageFooter.replace('font-size: ', '');
  band.style.color = DOCUMENT_COLORS.muted;

  if (info.companyName?.trim()) {
    const company = document.createElement('span');
    company.textContent = info.companyName.trim();
    band.appendChild(company);
  }
  if (info.documentRef?.trim()) {
    const ref = document.createElement('span');
    ref.textContent = info.documentRef.trim();
    band.appendChild(ref);
  }
  const pageNumber = document.createElement('span');
  pageNumber.setAttribute('data-document-page-number', '');
  pageNumber.textContent = `صفحة ${pageIndex} من ${totalPages}`;
  band.appendChild(pageNumber);
  return band;
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

/**
 * Distributes `container`'s direct-child blocks into A4 page shells.
 * Returns at least one page; pages are filled with whole blocks or
 * measured table parts. An oversized table is split across as many pages
 * as needed with its header repeated on each; every other oversized block
 * (atomic by contract — signatures, charts, keep-together groups) gets a
 * page to itself rather than being clipped mid-block.
 */
export function paginateBlocks(
  container: HTMLElement,
  metrics: A4Metrics,
  options: { margins?: PageMargins; footer?: DocumentPageFooterInfo } = {},
): A4PageShell[] {
  const margins = options.margins ?? A4_PAGE_MARGINS;

  const pages: A4PageShell[] = [];
  let { shell, content } = makeShell(margins);
  let usedHeight = 0;
  let blockCount = 0;
  let previousMarginBottom: number | null = null;

  const pushPage = (): void => {
    pages.push({ shell, blockCount });
    ({ shell, content } = makeShell(margins));
    usedHeight = 0;
    blockCount = 0;
    previousMarginBottom = null;
  };

  const place = (element: HTMLElement, consumed: number, marginBottom: number): void => {
    content.appendChild(element);
    usedHeight += consumed;
    blockCount += 1;
    previousMarginBottom = marginBottom;
  };

  const blocks = Array.from(container.children) as HTMLElement[];
  for (const block of blocks) {
    const height = Math.ceil(blockHeight(block));
    const { marginBottom } = verticalMargins(block);
    const consumed = appendedBudget(block, height, previousMarginBottom);
    const remainingBudget = metrics.contentHeightPx - usedHeight;

    // Fits in the remaining space (or is a first block within budget).
    if (consumed <= remainingBudget) {
      place(block.cloneNode(true) as HTMLElement, consumed, marginBottom);
      continue;
    }

    // Doesn't fit. Tables split: fill whatever space is left with as many
    // measured rows as fit, then continue on fresh pages. This also covers
    // a table taller than a WHOLE page placed first — it is split instead
    // of being clipped by the shell's overflow.
    if (findSplittableTable(block)) {
      let parts = splitTableBlock(block, {
        firstBudget: remainingBudget,
        pageBudget: metrics.contentHeightPx,
      });
      if (parts.length === 0 && blockCount > 0) {
        // No room for even one row on this page — split from a fresh one.
        pushPage();
        parts = splitTableBlock(block, {
          firstBudget: metrics.contentHeightPx,
          pageBudget: metrics.contentHeightPx,
        });
      }
      if (parts.length > 0) {
        // Part heights already carry their own margins; section margins
        // are bottom-only, so no collapsed gap is double-counted.
        const [firstPart, ...restParts] = parts;
        place(firstPart.element, firstPart.height, marginBottom);
        for (const part of restParts) {
          pushPage();
          place(part.element, part.height, marginBottom);
        }
        continue;
      }
      // A single row taller than a whole page: falls through to the
      // atomic handling below (nothing sensible can split it).
    }

    // Atomic block: never split. It gets a page of its own; an oversized
    // atomic block is a payload sizing violation, but clipping it
    // silently would be worse.
    if (blockCount > 0) pushPage();
    place(block.cloneNode(true) as HTMLElement, appendedBudget(block, height, null), marginBottom);
  }
  if (blockCount > 0) pushPage();

  if (pages.length === 0) {
    const empty = makeShell(margins);
    empty.content.appendChild(container.cloneNode(true));
    return [{ shell: empty.shell, blockCount: 1 }];
  }

  return pages;
}
