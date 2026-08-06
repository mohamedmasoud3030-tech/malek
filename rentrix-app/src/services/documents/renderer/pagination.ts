/**
 * A4 pagination for the offscreen PDF path.
 *
 * The paginator receives the flat block structure produced by
 * `buildDocumentBodyHtml` and distributes whole blocks across fixed-height
 * A4 page shells. It NEVER splits a block (rows and the signature block
 * are atomic by construction), so rows/totals/signatures cannot be clipped
 * mid-way. Long tables reach here already chunked by `chunkTableBlocks`,
 * which is what makes multi-page statements render completely instead of
 * overflowing a single page.
 *
 * Every produced page shell is exactly A4-proportioned (210×297mm at the
 * container's pixel density) with the print margins baked in as padding,
 * so each captured canvas maps 1:1 onto a PDF page — including its Arabic
 * page-number label captured by html2canvas (jsPDF's built-in fonts cannot
 * shape Arabic, so page numbers must be pixels, not text).
 */

export type PageMargins = Readonly<{ topMm: number; rightMm: number; bottomMm: number; leftMm: number }>;

export const A4_PAGE_MARGINS: PageMargins = { topMm: 12, rightMm: 10, bottomMm: 15, leftMm: 10 };

export type A4PageShell = {
  /** The A4-proportioned wrapper to capture (includes margins + page label). */
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

export function measureA4Metrics(container: HTMLElement, margins: PageMargins = A4_PAGE_MARGINS): A4Metrics {
  const widthPx = container.clientWidth > 0 ? container.clientWidth : 794;
  const pxPerMm = widthPx / 210; // A4 width = 210mm
  const pageHeightPx = Math.round(297 * pxPerMm);
  const contentHeightPx = Math.round((297 - margins.topMm - margins.bottomMm) * pxPerMm);
  return { pageHeightPx, contentHeightPx, pxPerMm };
}

const blockHeight = (element: HTMLElement): number => {
  const rect = element.getBoundingClientRect();
  if (rect.height > 0) return rect.height;
  // Fallbacks for minimal environments; real browsers always use rect.
  return element.offsetHeight || 0;
};

/**
 * Distributes `container`'s direct-child blocks into A4 page shells.
 * Returns at least one page; pages are only ever filled with whole blocks.
 */
export function paginateBlocks(
  container: HTMLElement,
  metrics: A4Metrics,
  options: { margins?: PageMargins } = {},
): A4PageShell[] {
  const margins = options.margins ?? A4_PAGE_MARGINS;

  const makeShell = (): { shell: HTMLElement; content: HTMLElement } => {
    const shell = document.createElement('div');
    shell.setAttribute('data-document-page', '');
    shell.style.width = '210mm';
    shell.style.height = '297mm';
    shell.style.position = 'relative';
    shell.style.overflow = 'hidden';
    shell.style.background = '#FFFFFF';
    const content = document.createElement('div');
    content.style.padding = `${margins.topMm}mm ${margins.rightMm}mm ${margins.bottomMm}mm ${margins.leftMm}mm`;
    content.style.boxSizing = 'border-box';
    shell.appendChild(content);
    return { shell, content };
  };

  const pages: A4PageShell[] = [];
  let { shell, content } = makeShell();
  let usedHeight = 0;
  let blockCount = 0;

  const blocks = Array.from(container.children) as HTMLElement[];
  for (const block of blocks) {
    const height = Math.ceil(blockHeight(block));
    if (blockCount > 0 && usedHeight + height > metrics.contentHeightPx) {
      pages.push({ shell, blockCount });
      ({ shell, content } = makeShell());
      usedHeight = 0;
      blockCount = 0;
    }
    content.appendChild(block.cloneNode(true));
    usedHeight += height;
    blockCount += 1;
  }
  if (blockCount > 0) pages.push({ shell, blockCount });

  if (pages.length === 0) {
    const empty = makeShell();
    empty.content.appendChild(container.cloneNode(true));
    return [{ shell: empty.shell, blockCount: 1 }];
  }

  return pages;
}

/** Arabic page-number label rendered as pixels (Arabic-safe) at the page bottom. */
export function createPageNumberLabel(pageIndex: number, totalPages: number): HTMLElement {
  const label = document.createElement('div');
  label.setAttribute('data-document-page-number', '');
  label.style.position = 'absolute';
  label.style.bottom = '6mm';
  label.style.left = '0';
  label.style.right = '0';
  label.style.textAlign = 'center';
  label.style.fontSize = '9px';
  label.style.color = '#64748B';
  label.textContent = `صفحة ${pageIndex} من ${totalPages}`;
  return label;
}
