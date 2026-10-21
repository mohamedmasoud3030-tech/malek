#!/usr/bin/env node
/**
 * MALEK — duplication ratchet over production application source.
 *
 * Why this exists: `jscpd` measures duplication, but a measurement that nobody
 * runs decays. SonarCloud reports "0.0% Coverage on New Code" and "3.0%
 * Duplication on New Code" as *failed* quality conditions on `main`, so the
 * repository already has an external signal it does not act on. This guard makes
 * the second one actionable locally, on every gate run, without a network.
 *
 * Scope: `malek-app/src`, TypeScript/TSX, EXCLUDING tests.
 *
 * Two things are deliberately out of scope, and this is not an oversight:
 *
 *  1. `supabase/migrations/**` — `DATABASE_RULES.md` says "A merged migration is
 *     immutable. Fixes are new forward migrations", and
 *     `check:migration-hygiene` enforces it (no rename, no delete, no content
 *     change). The 4,222 duplicated lines measured there are the cost of an
 *     append-only ledger. "Deduplicating" them would rewrite shipped history.
 *     A ratchet that counted them could never be satisfied honestly.
 *
 *  2. `docs/**` — prose repetition across governed documents is usually a quote
 *     of a canonical rule, and collapsing it would create the second source of
 *     truth that `AGENTS.md` forbids.
 *
 * The threshold is a RATCHET, like the debt allow-lists in
 * `malek-app/scripts/check-architecture.mjs`: it may only ever be lowered. When
 * duplication drops, lower `THRESHOLD_PERCENT` in the same commit. Raising it
 * requires a stated reason in the PR body, because raising it is exactly how
 * this kind of guard becomes decorative.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/** Locked ceiling. Lower it when duplication drops; never raise it silently. */
const THRESHOLD_PERCENT = 1.1;
const REPORT_DIR = resolve(ROOT, '.gate/duplication');
const REPORT = resolve(REPORT_DIR, 'jscpd-report.json');

const MIN_TOKENS = '50';
const MIN_LINES = '5';

function runJscpd() {
  const args = [
    'malek-app/src',
    '--min-tokens', MIN_TOKENS,
    '--min-lines', MIN_LINES,
    '--format', 'typescript,tsx',
    '--ignore', '**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/node_modules/**',
    '--reporters', 'json',
    '--output', REPORT_DIR,
    '--silent',
  ];
  // `npx --no-install` keeps the gate offline-honest: it uses the version the
  // lockfile installed and fails loudly instead of reaching the network.
  const result = spawnSync('npx', ['--no-install', 'jscpd', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 600_000,
  });
  return result;
}

function percent(value) {
  return `${Number(value).toFixed(2)}%`;
}

const existsBefore = existsSync(REPORT);
if (existsBefore) rmSync(REPORT, { force: true });

const result = runJscpd();
if (result.error && result.error.code === 'ETIMEDOUT') {
  console.error('Duplication guard could not finish within 10 minutes.');
  process.exit(2);
}

if (!existsSync(REPORT)) {
  console.error('Duplication guard produced no report.');
  if (result.stderr) console.error(result.stderr.trim().split('\n').slice(-6).join('\n'));
  console.error('');
  console.error('jscpd must be installed. Run: corepack pnpm install --frozen-lockfile');
  process.exit(2);
}

const report = JSON.parse(readFileSync(REPORT, 'utf8'));
const total = report.statistics?.total;
if (!total) {
  console.error('Duplication report has no totals; the report format changed.');
  process.exit(2);
}

const duplicatedLines = Number(total.duplicatedLines ?? 0);
const percentage = Number(total.percentage ?? 0);
const clones = Number(total.clones ?? 0);

console.log(`Duplication over production TypeScript: ${percent(percentage)}`);
console.log(`  duplicated lines : ${duplicatedLines}`);
console.log(`  clones           : ${clones}`);
console.log(`  ceiling          : ${percent(THRESHOLD_PERCENT)}`);

if (percentage > THRESHOLD_PERCENT) {
  const offenders = new Map();
  for (const clone of report.duplicates ?? []) {
    const key = clone.firstFile?.name ?? '(unknown)';
    offenders.set(key, (offenders.get(key) ?? 0) + Number(clone.lines ?? 0));
  }
  const worst = [...offenders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.error('');
  console.error(`Duplication ${percent(percentage)} exceeds the locked ceiling ${percent(THRESHOLD_PERCENT)}.`);
  console.error('Extract the shared piece, or justify raising the ceiling in the PR body:');
  for (const [file, lines] of worst) console.error(`  ${lines} lines  ${file}`);
  process.exit(1);
}

console.log('Duplication guard: OK — within the locked ceiling.');
