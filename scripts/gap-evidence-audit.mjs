#!/usr/bin/env node
/**
 * MALEK — gap evidence audit.
 *
 * Document 7 cites files and database objects as evidence for each gap. That evidence was authored
 * against incremental migrations, but the repository was later consolidated into a single canonical
 * baseline (`20260901000000_canonical_baseline.sql`) and the per-PR migration files no longer exist
 * under their historical names. A filename check therefore produces large numbers of false
 * "missing evidence" results.
 *
 * This audit resolves every cited token three ways:
 *   1. FILE    — a repository path with that basename exists;
 *   2. OBJECT  — the identifier appears in migrations, application source, scripts or tests;
 *   3. MISSING — neither, so the citation is genuinely unresolvable at this SHA.
 *
 * Report-only by default. It never edits Document 7 and never changes a gap status; it tells a human
 * or agent which citations can be trusted and which need re-sourcing.
 *
 * Usage:
 *   node scripts/gap-evidence-audit.mjs [--strict] [--json <path>]
 *
 * Exit codes: 0 = report written, 1 = --strict and unresolved citations exist, 2 = usage error.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const DOC7 = 'docs/source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md';
const ROOT = process.cwd();

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const jsonIndex = args.indexOf('--json');
const jsonPath = jsonIndex !== -1 ? args[jsonIndex + 1] : '.gate/gap-audit.json';
const unknown = args.filter((arg, i) => !arg.startsWith('--') && i !== jsonIndex + 1);
if (unknown.length > 0) {
  console.error(`Unknown argument(s): ${unknown.join(' ')}`);
  process.exit(2);
}

if (!existsSync(resolve(ROOT, DOC7))) {
  console.error(`${DOC7} not found. Run this from the repository root.`);
  process.exit(2);
}

function trackedFiles() {
  const result = spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error('git ls-files failed; this audit needs a git checkout.');
    process.exit(2);
  }
  return result.stdout.split('\n').filter(Boolean);
}

const files = trackedFiles();
const filesByBasename = new Map();
for (const file of files) {
  const name = basename(file);
  if (!filesByBasename.has(name)) filesByBasename.set(name, []);
  filesByBasename.get(name).push(file);
}

/**
 * Identifier index, built once. Only files that can carry evidence are scanned: SQL, application
 * source, tests and scripts. Documentation is excluded deliberately — a name that appears only in a
 * document is not evidence that the object exists.
 */
const EVIDENCE_SOURCES = files.filter(
  (file) =>
    /\.(sql|ts|tsx|mjs|cjs|js|jsx)$/.test(file) &&
    (file.startsWith('supabase/') || file.startsWith('malek-app/') || file.startsWith('scripts/')),
);

const identifiers = new Set();
const IDENTIFIER = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+){1,}\b/g;
for (const file of EVIDENCE_SOURCES) {
  let content;
  try {
    content = readFileSync(resolve(ROOT, file), 'utf8');
  } catch {
    continue;
  }
  for (const match of content.matchAll(IDENTIFIER)) identifiers.add(match[0]);
  // Function names are often quoted with mixed case in SQL; index those too.
  for (const match of content.matchAll(/\b[a-zA-Z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)+\b/g)) {
    identifiers.add(match[0].toLowerCase());
  }
}

function resolveToken(token) {
  const cleaned = token.replace(/`/g, '').trim();
  if (!cleaned || cleaned.includes('*') || cleaned.includes('…')) return { kind: 'skipped' };

  if (/^[A-Za-z0-9_./-]+\.(sql|ts|tsx|mjs|cjs|js|jsx)$/.test(cleaned)) {
    const name = basename(cleaned);
    if (filesByBasename.has(name)) return { kind: 'file', at: filesByBasename.get(name)[0] };
    const stem = name.replace(/\.[a-z]+$/, '');
    if (identifiers.has(stem.toLowerCase())) return { kind: 'object', via: stem };
    return { kind: 'missing' };
  }

  if (/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(cleaned)) {
    if (identifiers.has(cleaned) || identifiers.has(cleaned.toLowerCase())) {
      return { kind: 'object', via: cleaned };
    }
    return { kind: 'missing' };
  }

  return { kind: 'skipped' };
}

const markdown = readFileSync(resolve(ROOT, DOC7), 'utf8');
const lines = markdown.split('\n');

const gaps = [];
let current = null;
for (const line of lines) {
  if (line.trim().startsWith('| GAP-')) {
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    current = {
      id: cells[0],
      severity: cells[1],
      workPackage: cells[cells.length - 2],
      releaseBlocking: cells[cells.length - 1],
      symptom: cells[3],
      evidence: cells[5] ?? '',
      required: cells[6] ?? '',
    };
    gaps.push(current);
  }
}

if (gaps.length === 0) {
  console.error('No gap rows found in Document 7; the table format may have changed.');
  process.exit(2);
}

const results = gaps.map((gap) => {
  const tokens = new Set();
  const text = `${gap.evidence} ${gap.required} ${gap.symptom}`;
  for (const match of text.matchAll(/`([^`]+)`/g)) tokens.add(match[1]);
  for (const match of text.matchAll(/\b(20\d{10}_[a-z0-9_]+\.sql|wp\d{2}[_-][a-z0-9_]+\.sql)\b/g)) {
    tokens.add(match[1]);
  }

  const resolved = [];
  const missing = [];
  let skipped = 0;
  for (const token of tokens) {
    const outcome = resolveToken(token);
    if (outcome.kind === 'skipped') skipped += 1;
    else if (outcome.kind === 'missing') missing.push(token);
    else resolved.push({ token, ...outcome });
  }

  const declaredResolved = /resolved|Engineering COMPLETE|^none$/i.test(`${gap.symptom} ${gap.required}`);
  const externalBlock = /hosted|live |legal|pilot|accounting sign-off|sign-?off|deployed|QA/i.test(
    `${gap.evidence} ${gap.required}`,
  );

  return {
    id: gap.id,
    severity: gap.severity,
    workPackage: gap.workPackage,
    releaseBlocking: gap.releaseBlocking,
    symptom: gap.symptom,
    citations: { total: tokens.size, resolved: resolved.length, missing: missing.length, skipped },
    missing,
    disposition: missing.length > 0 ? 'UNRESOLVED_CITATIONS' : declaredResolved ? 'EVIDENCED' : 'EVIDENCED_PARTIAL',
    externalBlock,
    requiredOutcome: gap.required,
  };
});

const byDisposition = results.reduce((acc, result) => {
  acc[result.disposition] = (acc[result.disposition] ?? 0) + 1;
  return acc;
}, {});

const blocking = results.filter((result) => result.releaseBlocking === 'Yes');
const artifact = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  document: DOC7,
  headSha: (spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout ?? '').trim(),
  note:
    'Object-level resolution only. EVIDENCED means every citation resolves to a file or an object in migrations/source/scripts/tests; it does not prove behaviour, hosted state or gap closure.',
  summary: {
    gaps: results.length,
    releaseBlocking: blocking.length,
    byDisposition,
    unresolvedCitations: results.reduce((sum, result) => sum + result.missing.length, 0),
    externallyBlocked: results.filter((result) => result.externalBlock).length,
  },
  gaps: results,
};

mkdirSync(resolve(ROOT, dirname(jsonPath)), { recursive: true });
writeFileSync(resolve(ROOT, jsonPath), `${JSON.stringify(artifact, null, 2)}\n`);

console.log('MALEK gap evidence audit');
console.log(`  document : ${DOC7}`);
console.log(`  revision : ${artifact.headSha.slice(0, 12)}`);
console.log(`  evidence : ${EVIDENCE_SOURCES.length} SQL/source/test/script files`);
console.log('');
console.log(`  ${'GAP'.padEnd(9)}${'WP'.padEnd(7)}${'CITATIONS'.padEnd(12)}${'DISP'.padEnd(22)}EXTERNAL`);
for (const result of results) {
  const citations = `${result.citations.resolved}/${result.citations.total}`;
  console.log(
    `  ${result.id.padEnd(9)}${String(result.workPackage).padEnd(7)}${citations.padEnd(12)}${result.disposition.padEnd(22)}${result.externalBlock ? 'yes' : ''}`,
  );
  if (result.missing.length > 0) {
    console.log(`      unresolved: ${result.missing.join(', ')}`);
  }
}

console.log('');
console.log(`  ${results.length} gaps (${blocking.length} release-blocking)`);
for (const [disposition, count] of Object.entries(byDisposition)) {
  console.log(`    ${disposition}: ${count}`);
}
console.log(`  unresolved citations: ${artifact.summary.unresolvedCitations}`);
console.log('');
console.log(`Evidence written to ${jsonPath}`);
console.log(
  'Reminder: EVIDENCED is not CLOSED. Doc 7 owns status; hosted/legal/pilot proof is separate.',
);

if (strict && artifact.summary.unresolvedCitations > 0) process.exit(1);
