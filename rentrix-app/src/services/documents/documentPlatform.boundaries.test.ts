/**
 * Document-platform boundary guards (source-scan tests).
 *
 * Keeps the canonical architecture honest as the codebase evolves:
 *  - `UnifiedDocumentModel` is assembled ONLY by DocumentEngine;
 *  - print/PDF HTML assembly lives ONLY in the renderer internals;
 *  - jsPDF / html2canvas are imported ONLY by the renderer internals
 *    (never by pages, adapters, or the service boundary);
 *  - feature code never constructs document models or imports the PDF
 *    toolchain directly.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const documentsDir = resolve(import.meta.dirname);
const featuresDir = resolve(import.meta.dirname, '../../features');

function collectSourceFiles(root: string, predicate: (name: string) => boolean): string[] {
  const entries: string[] = [];
  for (const name of readdirSync(root)) {
    if (name === 'node_modules') continue;
    const full = join(root, name);
    if (statSync(full).isDirectory()) {
      entries.push(...collectSourceFiles(full, predicate));
    } else if (predicate(name)) {
      entries.push(full);
    }
  }
  return entries;
}

const productionFiles = collectSourceFiles(documentsDir, (name) => /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name));

const rendererInternals = new Set([
  'DocumentRenderer.ts',
  'documentHtml.ts',
  'pagination.ts',
  'offscreen.ts',
  'latinPdf.ts',
]);

describe('single canonical builder boundary', () => {
  it('only DocumentEngine assembles UnifiedDocumentModel objects', () => {
    for (const file of productionFiles) {
      const source = readFileSync(file, 'utf8');
      const name = relative(documentsDir, file);
      if (name === 'DocumentEngine.ts') continue;
      expect(source, `${name} must not construct document headers`).not.toMatch(/header:\s*\{\s*companyName/);
      expect(source, `${name} must not import the table builder`).not.toContain("from './TableGenerator'");
    }
  });

  it('DocumentTemplates contains no document-model builders anymore (thin adapters only)', () => {
    const source = readFileSync(resolve(documentsDir, 'DocumentTemplates.tsx'), 'utf8');
    expect(source).not.toMatch(/function build\w*Model/);
    expect(source).not.toContain('UnifiedDocumentModel');
    expect(source).toContain('documentService.');
  });

  it('print/PDF HTML assembly is confined to renderer internals', () => {
    for (const file of productionFiles) {
      const name = relative(documentsDir, file);
      if (rendererInternals.has(name)) continue;
      const source = readFileSync(file, 'utf8');
      expect(source, `${name} must not build print HTML`).not.toMatch(/buildRtlPrintHtml|buildHtmlTable|page-break-inside/);
    }
  });
});

describe('PDF toolchain isolation', () => {
  it('imports jsPDF and html2canvas only inside renderer internals', () => {
    for (const file of productionFiles) {
      const name = relative(documentsDir, file);
      const source = readFileSync(file, 'utf8');
      const importsPdfToolchain = /from ['"](?:jspdf|html2canvas(?:-pro)?)['"]/.test(source);
      if (rendererInternals.has(name)) continue;
      expect(importsPdfToolchain, `${name} must not import the PDF toolchain`).toBe(false);
    }
  });

  it('feature code never imports the PDF toolchain directly', () => {
    const featureFiles = collectSourceFiles(featuresDir, (name) => /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name));
    for (const file of featureFiles) {
      const source = readFileSync(file, 'utf8');
      expect(source, `${relative(featuresDir, file)} must not import jspdf/html2canvas`).not.toMatch(
        /from ['"](?:jspdf|html2canvas(?:-pro)?)['"]/,
      );
    }
  });

  it('feature code never assembles UnifiedDocumentModel literals', () => {
    const featureFiles = collectSourceFiles(featuresDir, (name) => /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name));
    for (const file of featureFiles) {
      const source = readFileSync(file, 'utf8');
      expect(source, `${relative(featuresDir, file)} must not build document models`).not.toMatch(/header:\s*\{\s*companyName/);
    }
  });
});
