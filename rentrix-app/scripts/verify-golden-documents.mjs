#!/usr/bin/env node
/**
 * MALEK golden-document visual verification.
 *
 * Bundles the real document pipeline (engine → HTML blocks → pagination →
 * jsPDF) into a browser harness, drives it in headless Chromium, and
 * verifies the ACTUAL rendered output of every golden scenario:
 *
 *   - PDF pipeline: page counts, zero blank pages, zero per-page overflow
 *     (nothing clipped by the A4 shell), and the real application/pdf bytes;
 *   - browser print: the standalone print HTML printed by Chromium with the
 *     same @page geometry — page counts compared against the PDF pipeline
 *     (print/PDF parity);
 *   - repeated table headers on continuation pages for long tables.
 *
 * Artifacts (PDFs, print PDFs, first-page PNGs, report) are written under
 * /tmp/malek-golden — never into the repository.
 *
 * Usage:  node scripts/verify-golden-documents.mjs [--out DIR]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const outFlagIndex = process.argv.indexOf('--out');
const outDir = outFlagIndex > -1 ? resolve(process.argv[outFlagIndex + 1]) : '/tmp/malek-golden';
mkdirSync(outDir, { recursive: true });

/* ------------------------------------------------------------------ */
/* 1. Bundle the harness with the app's own esbuild                    */
/* ------------------------------------------------------------------ */

// esbuild ships transitively with vite; under pnpm isolation it resolves
// from vite's own package context, not from this script's.
let esbuild;
try {
  esbuild = require('esbuild');
} catch {
  const viteRequire = createRequire(require.resolve('vite/package.json'));
  esbuild = viteRequire('esbuild');
}
const bundlePath = join(outDir, 'harness.bundle.js');

await esbuild.build({
  entryPoints: [join(appDir, 'src/test/documents/golden-harness-entry.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  outfile: bundlePath,
  absWorkingDir: appDir,
  alias: { '@': join(appDir, 'src') },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'silent',
});
console.log(`[bundle] harness → ${bundlePath}`);

/* ------------------------------------------------------------------ */
/* 2. Drive the harness in headless Chromium                           */
/* ------------------------------------------------------------------ */

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  // Repositories that only install @playwright/test still expose chromium.
  ({ chromium } = require('@playwright/test'));
}
const browser = await chromium.launch({ headless: true });

const countPdfPages = (buffer) => {
  const text = buffer.toString('latin1');
  // Chromium PDFs compress object streams, hiding per-object `/Type /Page`;
  // the page tree root still carries an uncompressed `/Type /Pages /Count N`.
  const pagesTree = text.match(/\/Type\s*\/Pages[\s\S]{0,120}?\/Count\s+(\d+)/);
  if (pagesTree) return Number(pagesTree[1]);
  const looseTree = text.match(/\/Count\s+(\d+)\s*\/Kids/);
  if (looseTree) return Number(looseTree[1]);
  const matches = text.match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 0;
};

const page = await browser.newPage();
page.on('pageerror', (error) => {
  throw new Error(`Harness page error: ${error.message}`);
});
await page.setContent(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;padding:0;background:#fff}</style></head><body></body></html>`);
await page.addScriptTag({ path: bundlePath });
await page.waitForFunction('globalThis.__malekDocsReady === true', null, { timeout: 15000 });
// Give the Arabic web font a real chance to load before measurement.
await page.evaluate(() => document.fonts?.ready?.catch(() => undefined));
await page.waitForTimeout(250);

const scenarios = await page.evaluate(() => globalThis.__malekDocs.list());
console.log(`[harness] ${scenarios.length} golden scenarios loaded\n`);

const report = [];
let failures = 0;

for (const scenario of scenarios) {
  const problems = [];

  /* --- PDF pipeline (real jsPDF artifact) --- */
  const pdf = await page.evaluate((id) => globalThis.__malekDocs.buildPdf(id), scenario.id);
  writeFileSync(join(outDir, `${scenario.id}.pdf`), Buffer.from(pdf.pdfBase64, 'base64'));

  /* --- geometry audit (clipping detector) --- */
  const analysis = await page.evaluate((id) => globalThis.__malekDocs.analyze(id), scenario.id);

  if (pdf.skippedBlankPages !== 0) problems.push(`blank pages skipped: ${pdf.skippedBlankPages}`);
  if (analysis.skippedBlankPages !== 0) problems.push(`analysis blank pages: ${analysis.skippedBlankPages}`);
  if (analysis.pageCount !== pdf.pageCount) problems.push(`analysis/pdf page-count mismatch: ${analysis.pageCount} vs ${pdf.pageCount}`);
  const clipped = analysis.pages.filter((p) => p.overflowPx > 0.5);
  if (clipped.length > 0) problems.push(`clipped pages (overflow>0.5px): ${clipped.map((p) => p.overflowPx).join(', ')}`);
  const blankContent = analysis.pages.filter((p) => p.blockCount === 0);
  if (blankContent.length > 0) problems.push(`blank content pages: ${blankContent.length}`);

  /* --- repeated table headers across continuation pages --- */
  if (scenario.expect.longTable) {
    const tablePages = analysis.pages.filter((p) => p.tableCount > 0);
    if (tablePages.length < 2) problems.push('long table did not span multiple pages');
    const headerless = tablePages.filter((p) => p.theadCount < p.tableCount);
    if (headerless.length > 0) problems.push(`${headerless.length} table page(s) missing repeated headers`);
  }

  /* --- browser print parity --- */
  const printableHtml = await page.evaluate((id) => globalThis.__malekDocs.printableHtml(id), scenario.id);
  const printPage = await browser.newPage();
  let printPages = 0;
  try {
    await printPage.setContent(printableHtml, { waitUntil: 'networkidle' });
    await printPage.evaluate(() => document.fonts?.ready?.catch(() => undefined));
    await printPage.waitForTimeout(200);
    const printPdf = await printPage.pdf({ preferCSSPageSize: true, printBackground: true });
    writeFileSync(join(outDir, `${scenario.id}.print.pdf`), printPdf);
    printPages = countPdfPages(printPdf);
  } finally {
    await printPage.close();
  }

  /* --- expectation checks --- */
  if (scenario.expect.onePage) {
    if (pdf.pageCount !== 1) problems.push(`expected exactly 1 PDF page, got ${pdf.pageCount}`);
    if (printPages !== 1) problems.push(`expected exactly 1 printed page, got ${printPages}`);
  }
  if (scenario.expect.multiPage && pdf.pageCount < 2) problems.push(`expected multi-page PDF, got ${pdf.pageCount}`);
  if (printPages !== pdf.pageCount) {
    problems.push(`print/PDF parity: print=${printPages} pdf=${pdf.pageCount}`);
  }

  /* --- first-page snapshot for visual inspection --- */
  const snapshot = await page.evaluate((id) => globalThis.__malekDocs.firstPageSnapshot(id), scenario.id);
  writeFileSync(join(outDir, `${scenario.id}-page1.png`), Buffer.from(snapshot.replace(/^data:image\/png;base64,/, ''), 'base64'));

  const status = problems.length === 0 ? 'PASS' : 'FAIL';
  if (problems.length > 0) failures += 1;
  report.push({ id: scenario.id, name: scenario.name, status, pdfPages: pdf.pageCount, printPages, problems });
  console.log(`${status === 'PASS' ? '✅' : '❌'} ${scenario.id.padEnd(30)} pdf=${String(pdf.pageCount).padStart(2)} print=${String(printPages).padStart(2)}  ${scenario.name}`);
  for (const problem of problems) console.log(`      ↳ ${problem}`);
}

await browser.close();

writeFileSync(join(outDir, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), report, failures }, null, 2));
console.log(`\n${failures === 0 ? '✅ ALL GOLDEN SCENARIOS PASS' : `❌ ${failures} SCENARIO(S) FAILED`} — artifacts in ${outDir}`);
process.exit(failures === 0 ? 0 : 1);
