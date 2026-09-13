// @vitest-environment happy-dom
/**
 * Pagination contract tests — the page-efficiency rules of the PDF path.
 *
 * These lock the fixes for the two historical pagination defects:
 *  1. block vertical MARGINS were not counted against the page budget, so
 *     pages were silently overfilled and bottom content clipped;
 *  2. a table taller than one page (tall wrapping rows, chunk taller than
 *     its budget) was placed whole and clipped by the shell — tables must
 *     instead split by measured row heights, repeating their header and
 *     keeping totals on the final part.
 *
 * Also locks: atomic non-table blocks never split, short documents stay on
 * one page, and every page shell stays exactly A4-proportioned.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createOffscreenContainer, removeAllRenderContainers } from './offscreen';
import { measureA4Metrics, outerHeight, paginateBlocks, splitTableBlock } from './pagination';

const METRICS = { pageHeightPx: 1122, contentHeightPx: 1000, pxPerMm: 794 / 210 };

const stubHeight = (element: HTMLElement, height: number) => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => ({ height, width: 794, top: 0, left: 0, right: 794, bottom: height }),
    configurable: true,
  });
};

/** Builds a block whose box is `height` tall plus a bottom margin. */
const blockWithMargin = (height: number, marginBottomPx: number): HTMLElement => {
  const block = document.createElement('section');
  block.className = 'document-block';
  block.style.marginBottom = `${marginBottomPx}px`;
  block.textContent = `h${height}`;
  stubHeight(block, height);
  return block;
};

/** Builds a table block: title + table with `rowCount` stubbed rows. */
const tableBlock = (rowCount: number, rowHeightPx: number, options: { title?: string; totals?: boolean } = {}): HTMLElement => {
  const block = document.createElement('section');
  block.className = 'document-block';
  block.innerHTML = `
    ${options.title ? '<h3>عنوان الجدول</h3>' : ''}
    <table>
      <thead><tr><th>عمود</th></tr></thead>
      <tbody>${Array.from({ length: rowCount }, (_, i) => `<tr><td>صف ${i + 1}</td></tr>`).join('')}</tbody>
      ${options.totals ? '<tfoot><tr><th>الإجمالي</th></tr></tfoot>' : ''}
    </table>`;
  stubHeight(block.querySelector('thead') as HTMLElement, 40);
  if (options.totals) stubHeight(block.querySelector('tfoot') as HTMLElement, 40);
  block.querySelectorAll('tbody tr').forEach((row) => stubHeight(row as HTMLElement, rowHeightPx));
  const title = block.querySelector('h3');
  if (title) stubHeight(title as HTMLElement, 30);
  // Block box = title + thead + tfoot + rows (+40 table chrome).
  const total = (title ? 30 : 0) + 40 + (options.totals ? 40 : 0) + rowCount * rowHeightPx + 40;
  stubHeight(block, total);
  return block;
};

afterEach(() => {
  removeAllRenderContainers();
});

describe('margin-aware page budget', () => {
  it('counts block margins against the page budget (no silent overfill)', () => {
    const container = createOffscreenContainer('');
    container.innerHTML = '';
    // 600 + 600 content would fit (1200 > 1000 anyway); the point is the
    // MARGIN: 500 + 500 + margins(2×60) = 1120 > 1000 ⇒ second block must
    // start a new page even though content alone (1000) would fit.
    container.appendChild(blockWithMargin(500, 60));
    container.appendChild(blockWithMargin(500, 60));

    const pages = paginateBlocks(container, METRICS);
    expect(pages.map((page) => page.blockCount)).toEqual([1, 1]);
    container.remove();
  });

  it('outerHeight includes vertical margins', () => {
    const block = blockWithMargin(200, 22);
    document.body.appendChild(block);
    expect(outerHeight(block)).toBeGreaterThanOrEqual(222);
    block.remove();
  });

  it('collapses adjacent margins like the browser (no double-counted gap)', () => {
    const container = createOffscreenContainer('');
    container.innerHTML = '';
    // Without collapsing: (470+40) + (470+40) = 1020 > 1000 ⇒ 2 pages.
    // With collapsing:    (470+40) + (470+max(40,40)-40) = 980 ⇒ 1 page.
    const first = blockWithMargin(470, 40);
    const second = blockWithMargin(470, 0);
    second.style.marginTop = '40px';
    container.appendChild(first);
    container.appendChild(second);

    const pages = paginateBlocks(container, METRICS);
    expect(pages.map((page) => page.blockCount)).toEqual([2]);
    container.remove();
  });

  it('packs blocks that fit with their margins onto one page', () => {
    const container = createOffscreenContainer('');
    container.innerHTML = '';
    container.appendChild(blockWithMargin(400, 22));
    container.appendChild(blockWithMargin(400, 22)); // 400+22+400+22 = 844 ≤ 1000
    const pages = paginateBlocks(container, METRICS);
    expect(pages.map((page) => page.blockCount)).toEqual([2]);
    container.remove();
  });
});

describe('oversized table splitting', () => {
  it('splits a table taller than one page across pages without clipping', () => {
    const container = createOffscreenContainer('');
    container.innerHTML = '';
    // 30 rows × 60px = 1800 + title/thead/tfoot/chrome ≈ 1950px. A page
    // holds ~14–15 rows once the repeated header (and final totals) are
    // reserved, so the table must span three pages — with zero clipping.
    container.appendChild(tableBlock(30, 60, { title: 'جدول', totals: true }));

    const pages = paginateBlocks(container, METRICS);
    expect(pages.length).toBe(3);

    // Every page carries the repeated header.
    for (const page of pages) {
      expect(page.shell.querySelectorAll('thead').length).toBe(1);
    }
    // All rows survive the split; totals only on the final page.
    const allRows = pages.flatMap((page) => [...page.shell.querySelectorAll('tbody tr')].map((row) => row.textContent));
    expect(allRows).toHaveLength(30);
    expect(pages[0].shell.querySelector('tfoot')).toBeNull();
    expect(pages[1].shell.querySelector('tfoot')).toBeNull();
    expect(pages[2].shell.querySelector('tfoot')).not.toBeNull();
    // The title stays with the first part only.
    expect(pages[0].shell.textContent).toContain('عنوان الجدول');
    expect(pages[1].shell.textContent).not.toContain('عنوان الجدول');
    expect(pages[2].shell.textContent).not.toContain('عنوان الجدول');
    container.remove();
  });

  it('fills the remainder of the current page before starting a new one', () => {
    const container = createOffscreenContainer('');
    container.innerHTML = '';
    container.appendChild(blockWithMargin(700, 0));
    // 20 rows × 60px = 1200 + chrome 80 = 1280 total. Remaining budget is
    // 300 ⇒ a few rows must join page 1, the rest continue on page 2.
    container.appendChild(tableBlock(20, 60, {}));

    const pages = paginateBlocks(container, METRICS);
    expect(pages.length).toBe(3);
    const firstPageRows = pages[0].shell.querySelectorAll('tbody tr').length;
    const laterRows = pages.slice(1).reduce((sum, page) => sum + page.shell.querySelectorAll('tbody tr').length, 0);
    expect(firstPageRows).toBeGreaterThan(0); // remainder of page 1 used
    expect(firstPageRows + laterRows).toBe(20); // nothing clipped
    container.remove();
  });

  it('moves the table to a fresh page when no single row fits the remainder', () => {
    const container = createOffscreenContainer('');
    container.innerHTML = '';
    container.appendChild(blockWithMargin(990, 0)); // leaves 10px — nothing fits
    container.appendChild(tableBlock(5, 60, {}));

    const pages = paginateBlocks(container, METRICS);
    expect(pages.map((page) => page.blockCount)).toEqual([1, 1]);
    expect(pages[1].shell.querySelectorAll('tbody tr').length).toBe(5);
    container.remove();
  });

  it('splitTableBlock consumes every row across the returned parts', () => {
    const container = createOffscreenContainer('');
    container.innerHTML = '';
    const block = tableBlock(47, 60, { title: 'جدول', totals: true });
    container.appendChild(block);

    const parts = splitTableBlock(block, { firstBudget: 500, pageBudget: METRICS.contentHeightPx });
    const placedRows = parts.reduce((sum, part) => sum + part.element.querySelectorAll('tbody tr').length, 0);
    expect(placedRows).toBe(47);
    // Header repeats on every part; totals only on the last.
    expect(parts.every((part) => part.element.querySelector('thead'))).toBe(true);
    expect(parts[parts.length - 1].element.querySelector('tfoot')).not.toBeNull();
    container.remove();
  });

  it('returns no parts when the budget cannot hold header plus one row', () => {
    const container = createOffscreenContainer('');
    container.innerHTML = '';
    const block = tableBlock(5, 60, {});
    container.appendChild(block);
    expect(splitTableBlock(block, { firstBudget: 50, pageBudget: METRICS.contentHeightPx })).toEqual([]);
    container.remove();
  });
});

describe('atomic blocks and page shells', () => {
  it('never splits a non-table oversized block — it gets its own page', () => {
    const container = createOffscreenContainer('');
    container.innerHTML = '';
    container.appendChild(blockWithMargin(300, 0));
    container.appendChild(blockWithMargin(1100, 0)); // taller than the budget
    container.appendChild(blockWithMargin(200, 0));

    const pages = paginateBlocks(container, METRICS);
    expect(pages.map((page) => page.blockCount)).toEqual([1, 1, 1]);
    container.remove();
  });

  it('every shell stays exactly A4-proportioned', () => {
    const container = createOffscreenContainer('');
    container.innerHTML = '';
    container.appendChild(blockWithMargin(400, 0));
    const pages = paginateBlocks(container, METRICS);
    const shell = pages[0].shell;
    expect(shell.getAttribute('data-document-page')).not.toBeNull();
    expect(shell.style.width).toBe('210mm');
    expect(shell.style.height).toBe('297mm');
    container.remove();
  });

  it('measures the A4 content budget from the shared margins', () => {
    const container = createOffscreenContainer('');
    Object.defineProperty(container, 'clientWidth', { value: 794, configurable: true });
    const metrics = measureA4Metrics(container);
    // 297 − 12 − 15 = 270mm of content.
    expect(metrics.contentHeightPx).toBe(Math.round(270 * (794 / 210)));
    container.remove();
  });
});
