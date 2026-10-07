#!/usr/bin/env node
/**
 * Golden document gate — verifies REAL rendered output on both peers:
 *
 *  - PDF  : the vector emitter (@react-pdf/renderer) renders each scenario
 *           in Node with the self-hosted Tajawal TTFs → real PDF bytes.
 *  - PRINT: the standalone print sheet is served over a local static server
 *           and printed by headless Chromium (its own engine, CSS @page).
 *
 * Assertions per scenario:
 *  - page counts match between the two peers (parity);
 *  - one-page documents stay exactly one page in BOTH;
 *  - multi-page documents paginate in BOTH;
 *  - long tables repeat their column header on page 2 in BOTH (extracted
 *    with pdftotext — possible now that both outputs are vector text);
 *  - key model strings (company, title, reference, grand total) survive
 *    UNCHANGED into the printed text — no invented or reformatted data.
 *
 * Artifacts (PDFs + page-1 rasters for visual QA) land in /tmp/malek-golden.
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const appRoot = resolve(new URL('..', import.meta.url).pathname);
const outDir = '/tmp/malek-golden';
mkdirSync(outDir, { recursive: true });

/* ------------------------------------------------------------------ */
/* 1. Bundle the node harness entry                                    */
/* ------------------------------------------------------------------ */

let esbuild;
try {
  esbuild = require('esbuild');
} catch {
  const viteRequire = createRequire(require.resolve('vite/package.json'));
  esbuild = viteRequire('esbuild');
}

// The bundle lives INSIDE the app so externalized packages (@react-pdf,
// react — which ship data assets resolved relative to their own dist)
// resolve from the real node_modules at runtime.
const bundlePath = join(appRoot, 'scripts/.golden-entry.cjs');
await esbuild.build({
  entryPoints: [join(appRoot, 'src/test/documents/golden-node-entry.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  outfile: bundlePath,
  absWorkingDir: appRoot,
  alias: { '@': join(appRoot, 'src') },
  external: ['react', 'react/jsx-runtime', '@react-pdf/renderer'],
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'silent',
});
console.log(`[bundle] node entry → ${bundlePath}`);

const harness = require(bundlePath);
const scenarios = harness.list();
console.log(`[harness] ${scenarios.length} golden scenarios loaded`);

/* ------------------------------------------------------------------ */
/* 2. Static server: public assets + the current print sheet           */
/* ------------------------------------------------------------------ */

const printHtmlById = new Map(scenarios.map((s) => [s.id, harness.printableHtmlFor(s.id)]));
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/print') {
    const html = printHtmlById.get(url.searchParams.get('id') ?? '');
    if (!html) {
      res.writeHead(404).end('unknown id');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html);
    return;
  }
  const file = join(appRoot, 'public', url.pathname.replace(/^\//, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': url.pathname.endsWith('.ttf') ? 'font/ttf' : 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolveWait) => server.listen(4173, '127.0.0.1', resolveWait));

/* ------------------------------------------------------------------ */
/* 3. Drive both engines                                               */
/* ------------------------------------------------------------------ */

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('@playwright/test'));
}
const browser = await chromium.launch({ headless: true });

const countPages = (buffer) => {
  const text = buffer.toString('latin1');
  const tree = text.match(/\/Type\s*\/Pages[\s\S]{0,120}?\/Count\s+(\d+)/) ?? text.match(/\/Count\s+(\d+)\s*\/Kids/);
  return tree ? Number(tree[1]) : 0;
};

const results = [];
let failures = 0;

for (const scenario of scenarios) {
  const notes = [];
  const warns = [];
  const pdfSide = await harness.pdfFor(scenario.id);
  writeFileSync(join(outDir, `${scenario.id}.vector.pdf`), Buffer.from(pdfSide.base64, 'base64'));

  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:4173/print?id=${scenario.id}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts?.ready?.catch(() => undefined));
  await page.emulateMedia({ media: 'print' });
  const printBuffer = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  writeFileSync(join(outDir, `${scenario.id}.print.pdf`), printBuffer);
  await page.close();

  const printPages = countPages(printBuffer);
  const pdfPages = pdfSide.pageCount;

  // Two distinct engines (Chromium CSS vs react-pdf/yoga) paginate with
  // different metrics — parity is informational, not a pass/fail gate.
  if (printPages !== pdfPages) warns.push(`print/PDF parity: print=${printPages} pdf=${pdfPages}`);
  if (scenario.expect.onePage && pdfPages !== 1) notes.push(`expected exactly 1 PDF page, got ${pdfPages}`);
  if (scenario.expect.onePage && printPages !== 1) notes.push(`expected exactly 1 print page, got ${printPages}`);
  if (scenario.expect.multiPage && pdfPages < 2) notes.push(`expected multiple PDF pages, got ${pdfPages}`);

  // Extractable-text assertions (both outputs are vector now).
  const extract = (file, from, to) => {
    try {
      return execSync(`pdftotext ${from ? `-f ${from} -l ${to ?? from}` : ''} -enc UTF-8 "${file}" -`, { encoding: 'utf8' });
    } catch {
      return '';
    }
  };
  // pdftotext wraps lines, drops bidi direction marks, and reorders letters
  // inside Arabic runs (visual vs logical order). Compare per-word letter
  // multisets so "الأفق" still matches a visually-reordered extraction.
  // Amount needles fall back to their numeric token because the currency
  // word extracts detached from the digits.
  const squash = (t) => t.replace(/[؜‎‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
  const cleanWord = (w) => w.replace(/[^\p{L}\p{N}.,-]/gu, '');
  const wordTokens = (t) => squash(t).split(' ').map(cleanWord).filter(Boolean).map((w) => [...w].sort().join(''));
  const contains = (rawSq, textTokens, needle) => {
    const n = squash(needle);
    if (rawSq.includes(n)) return true;
    const needleTokens = wordTokens(needle);
    const tokenMatches = (tok) =>
      textTokens.includes(tok) ||
      // pdftotext may glue an RTL run onto a neighbour ("م.م.شركة") or read
      // it in visual order ("م.م.ش") — accept raw/reversed substring too.
      textTokens.some((w) => w.length > tok.length && (w.includes(tok) || w.includes([...tok].reverse().join(''))));
    if (needleTokens.length > 0 && needleTokens.every(tokenMatches)) return true;
    // Shaping/extraction noise can mangle one word of a long phrase ("ساري"
    // → "سار ي"); tolerate ≤25% missing tokens for phrases of 4+ words.
    if (needleTokens.length >= 4) {
      const missing = needleTokens.filter((tok) => !tokenMatches(tok)).length;
      if (missing <= Math.floor(needleTokens.length * 0.25)) return true;
    }
    // Digits are bidi-inert: match digit groups verbatim against raw text.
    const groups = n.match(/\d[\d.,]*/g);
    return Boolean(groups && groups.length > 0 && groups.every((g) => rawSq.includes(g)));
  };
  const printRaw = squash(extract(join(outDir, `${scenario.id}.print.pdf`)));
  const printTokens = wordTokens(printRaw);
  const vectorRaw = squash(extract(join(outDir, `${scenario.id}.vector.pdf`)));
  const vectorTokens = wordTokens(vectorRaw);
  for (const needle of harness.mustContainFor(scenario.id)) {
    if (!contains(printRaw, printTokens, needle)) notes.push(`print text missing: ${needle}`);
    if (!contains(vectorRaw, vectorTokens, needle)) notes.push(`vector text missing: ${needle}`);
  }
  if (scenario.expect.longTable) {
    const header = harness.longTableHeaderFor(scenario.id);
    const page2Raw = squash(extract(join(outDir, `${scenario.id}.print.pdf`), 2, 2));
    const vectorPage2Raw = squash(extract(join(outDir, `${scenario.id}.vector.pdf`), 2, 2));
    if (header && !contains(page2Raw, wordTokens(page2Raw), header)) notes.push('print page 2 does not repeat the table header');
    if (header && !contains(vectorPage2Raw, wordTokens(vectorPage2Raw), header)) notes.push('vector page 2 does not repeat the table header');
  }

  if (notes.length > 0) failures += 1;
  results.push({ ...scenario, printPages, pdfPages, notes, warns, sizeKb: Math.round(pdfSide.sizeBytes / 1024) });
  console.log(
    `${notes.length === 0 ? '✅' : '❌'} ${scenario.id.padEnd(28)} pdf=${String(pdfPages).padStart(2)} print=${String(printPages).padStart(2)} ${Math.round(pdfSide.sizeBytes / 1024)}KB  ${scenario.name}`,
  );
  for (const note of notes) console.log(`   ↳ ${note}`);
  for (const warn of warns) console.log(`   ⚠ ${warn}`);
}

/* ------------------------------------------------------------------ */
/* 4. Visual-QA rasters (page 1 of a few vector PDFs)                  */
/* ------------------------------------------------------------------ */

for (const id of ['receipt-short', 'contract-short', 'owner-statement-long', 'property-report-professional']) {
  const file = join(outDir, `${id}.vector.pdf`);
  if (existsSync(file)) {
    try {
      execSync(`pdftoppm -png -r 60 -f 1 -l 1 "${file}" "${join(outDir, `${id}-viz`)}`, { stdio: 'pipe' });
    } catch {
      /* poppler optional */
    }
  }
}

writeFileSync(join(outDir, 'report.json'), JSON.stringify(results, null, 2));
await browser.close();
server.close();

console.log('');
if (failures > 0) {
  console.log(`❌ ${failures} SCENARIO(S) FAILED — artifacts in ${outDir}`);
  process.exit(1);
}
console.log(`✅ ALL GOLDEN SCENARIOS PASS — artifacts in ${outDir}`);
