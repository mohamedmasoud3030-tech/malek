/**
 * Golden-document browser harness entry (bundled by
 * `scripts/verify-golden-documents.mjs` and driven in real Chromium).
 *
 * Exposes the REAL document pipeline (engine models → HTML blocks →
 * pagination → jsPDF artifact) so the verification script can assert on
 * actual rendered geometry: page counts, per-page overflow (clipping),
 * blank pages, and the generated PDF bytes.
 */
import { goldenScenarios } from './golden-document-scenarios';
import { buildDocumentBodyHtml, buildPrintableDocumentHtml } from '@/services/documents/renderer/documentHtml';
import { buildDocumentPdf } from '@/services/documents/DocumentRenderer';
import { createOffscreenContainer, removeAllRenderContainers, settleLayout, waitForFontsReady, waitForImages } from '@/services/documents/renderer/offscreen';
import { createPageFooterBand, measureA4Metrics, paginateBlocks } from '@/services/documents/renderer/pagination';
import { DOCUMENT_PAGE } from '@/services/documents/documentDesignTokens';

type ScenarioExpectation = { onePage?: boolean; multiPage?: boolean; longTable?: boolean };

type PageInfo = {
  blockCount: number;
  /** Content height beyond the A4 shell — anything >0 would be clipped. */
  overflowPx: number;
  shellHeightPx: number;
  tableCount: number;
  theadCount: number;
};

type Analysis = {
  id: string;
  pageCount: number;
  skippedBlankPages: number;
  pages: PageInfo[];
};

async function waitForReady(): Promise<void> {
  try {
    await waitForFontsReady(document);
  } catch {
    // The harness page keeps its fallback stack — measurement stays valid.
  }
  await settleLayout();
}

const api = {
  list(): Array<{ id: string; name: string; expect: ScenarioExpectation }> {
    return goldenScenarios.map((scenario) => ({ id: scenario.id, name: scenario.name, expect: { ...scenario.expect } }));
  },

  printableHtml(id: string): string {
    const scenario = goldenScenarios.find((s) => s.id === id);
    if (!scenario) throw new Error(`Unknown scenario: ${id}`);
    return buildPrintableDocumentHtml(scenario.model);
  },

  /** Runs the real PDF pipeline and reports the jsPDF artifact facts. */
  async buildPdf(id: string): Promise<{ pageCount: number; skippedBlankPages: number; pdfSize: number; pdfBase64: string }> {
    const scenario = goldenScenarios.find((s) => s.id === id);
    if (!scenario) throw new Error(`Unknown scenario: ${id}`);
    await waitForReady();
    const { pageCount, skippedBlankPages, doc } = await buildDocumentPdf(scenario.model);
    const base64 = doc.output('datauristring').replace(/^data:application\/pdf;base64,/, '');
    return { pageCount, skippedBlankPages, pdfSize: Math.floor(base64.length * 0.75), pdfBase64: base64 };
  },

  /**
   * Geometry audit WITHOUT capture: paginates the same blocks the PDF
   * builder uses and measures every page shell's content against the
   * shell box — the direct clipping detector.
   */
  async analyze(id: string): Promise<Analysis> {
    const scenario = goldenScenarios.find((s) => s.id === id);
    if (!scenario) throw new Error(`Unknown scenario: ${id}`);
    await waitForReady();

    const container = createOffscreenContainer(buildDocumentBodyHtml(scenario.model, { withAuditFooter: true }));
    try {
      await waitForImages(container);
      await settleLayout();

      const metrics = measureA4Metrics(container);
      const pages = paginateBlocks(container, metrics, {
        footer: { companyName: scenario.model.header.companyName, documentRef: scenario.model.header.documentNo },
      });

      // Measure each shell in the real layout engine.
      const host = createOffscreenContainer('', { padded: false });
      const infos: PageInfo[] = [];
      try {
        for (const page of pages) {
          host.appendChild(page.shell);
          const shellRect = page.shell.getBoundingClientRect();
          const content = page.shell.firstElementChild as HTMLElement;
          const contentRect = content.getBoundingClientRect();
          infos.push({
            blockCount: page.blockCount,
            overflowPx: Math.round((contentRect.height - shellRect.height) * 100) / 100,
            shellHeightPx: Math.round(shellRect.height * 100) / 100,
            tableCount: page.shell.querySelectorAll('table').length,
            theadCount: page.shell.querySelectorAll('thead').length,
          });
          page.shell.remove();
        }
      } finally {
        host.remove();
      }

      const visible = pages.filter((page) => page.blockCount > 0);
      return {
        id,
        pageCount: visible.length,
        skippedBlankPages: pages.length - visible.length,
        pages: infos.filter((_, index) => pages[index].blockCount > 0),
      };
    } finally {
      container.remove();
      removeAllRenderContainers();
    }
  },

  /** Per-block outer heights of the unpaginated document (density audits). */
  async measureBlocks(id: string): Promise<{ contentBudgetPx: number; totalOuterPx: number; blocks: Array<{ label: string; outerPx: number }> }> {
    const scenario = goldenScenarios.find((s) => s.id === id);
    if (!scenario) throw new Error(`Unknown scenario: ${id}`);
    await waitForReady();

    const container = createOffscreenContainer(buildDocumentBodyHtml(scenario.model, { withAuditFooter: true }));
    try {
      await waitForImages(container);
      await settleLayout();
      const metrics = measureA4Metrics(container);
      const blocks = Array.from(container.children).map((block) => {
        const element = block as HTMLElement;
        const style = getComputedStyle(element);
        const margins = (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
        const rect = element.getBoundingClientRect();
        const label = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
        return { label, outerPx: Math.round(rect.height + margins) };
      });
      return {
        contentBudgetPx: metrics.contentHeightPx,
        totalOuterPx: blocks.reduce((sum, block) => sum + block.outerPx, 0),
        blocks,
      };
    } finally {
      container.remove();
      removeAllRenderContainers();
    }
  },

  /** First page as PNG (data URL) for visual inspection. */
  async firstPageSnapshot(id: string, pageIndex = 0): Promise<string> {
    const scenario = goldenScenarios.find((s) => s.id === id);
    if (!scenario) throw new Error(`Unknown scenario: ${id}`);
    await waitForReady();

    const container = createOffscreenContainer(buildDocumentBodyHtml(scenario.model, { withAuditFooter: true }));
    try {
      await waitForImages(container);
      await settleLayout();
      const metrics = measureA4Metrics(container);
      const pages = paginateBlocks(container, metrics, {});
      const shell = (pages[pageIndex] ?? pages[pages.length - 1]).shell;
      // Mirror DocumentRenderer: every captured page carries the footer band.
      shell.appendChild(
        createPageFooterBand(pageIndex + 1, pages.length, {
          companyName: scenario.model.header.companyName,
          documentRef: scenario.model.header.documentNo,
        }),
      );
      shell.style.width = `${DOCUMENT_PAGE.widthMm}mm`;
      const host = createOffscreenContainer('', { padded: false });
      host.appendChild(shell);
      try {
        const { default: html2canvas } = await import('html2canvas-pro');
        const canvas = await html2canvas(shell, { scale: 1.5, backgroundColor: '#FFFFFF', logging: false });
        return canvas.toDataURL('image/png');
      } finally {
        shell.remove();
        host.remove();
      }
    } finally {
      container.remove();
      removeAllRenderContainers();
    }
  },
};

(globalThis as Record<string, unknown>).__malekDocs = api;
(globalThis as Record<string, unknown>).__malekDocsReady = true;
