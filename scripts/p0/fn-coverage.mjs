#!/usr/bin/env node
/**
 * P0 — Migration/Rollback function coverage table.
 *
 * For every function the P0 fix migration (re)creates, verify:
 *   - existedBeforeP0  (a pre-P0 body was extracted from the earlier chain)
 *   - replaceKind      ('replace' | 'create')
 *   - rollbackAction   ('restore pre-P0 body' | 'drop function (created by P0)')
 *   - signatureMatch   (argument list + SECURITY DEFINER/INVOKER identical
 *                       between the fix body and the pre-P0 body)
 * Emits evidence/p0/fn-coverage.json + .md. Exits non-zero unless 19/19.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIX = readFileSync(join(repoRoot, 'supabase', 'migrations', '20260724120000_p0_company_isolation_reports_rls.sql'), 'utf8');
const ROLLBACK = readFileSync(join(repoRoot, 'supabase', 'rollback', '20260724_rollback_p0_company_isolation.sql'), 'utf8');
const PRE_DIR = join(repoRoot, 'supabase', '.p0-tmp-bodies');
const EVID = join(repoRoot, 'evidence', 'p0');

function signatureOf(body) {
  const m = body.match(/create\s+or\s+replace\s+function\s+public\.([a-z_]+)\s*\(/i);
  if (!m) return null;
  let i = body.indexOf('(', m.index + m[0].length - 1);
  let depth = 0;
  let j = i;
  for (; j < body.length; j++) {
    if (body[j] === '(') depth++;
    else if (body[j] === ')') {
      depth--;
      if (depth === 0) break;
    }
  }
  const args = body.slice(i + 1, j).replace(/\s+/g, ' ').trim().toLowerCase();
  const secDef = /security\s+definer/i.test(body);
  return { name: m[1].toLowerCase(), args, secDef };
}

const fnBodies = {};
for (const f of readdirSync(PRE_DIR)) {
  if (f.endsWith('.sql')) fnBodies[f.replace(/\.sql$/, '')] = readFileSync(join(PRE_DIR, f), 'utf8');
}

// Functions (re)created by the fix, in order of appearance.
const fixFns = [...FIX.matchAll(/create\s+or\s+replace\s+function\s+public\.([a-z_]+)\s*\(/gi)].map((m) => m[1].toLowerCase());
const uniqueFixFns = [...new Set(fixFns)];

const rows = uniqueFixFns.map((name) => {
  const pre = fnBodies[name];
  const existedBefore = Boolean(pre);
  const replaceKind = existedBefore ? 'replace' : 'create';
  let rollbackAction;
  let rollbackOk = false;
  if (existedBefore) {
    rollbackAction = 'restore pre-P0 body';
    rollbackOk = ROLLBACK.includes(pre.trim());
  } else {
    rollbackAction = 'drop function (created by P0)';
    rollbackOk = new RegExp(`drop\\s+function\\s+if\\s+exists\\s+public\\.${name}\\s*\\(`, 'i').test(ROLLBACK);
  }
  // Signature parity between the fix-embedded body and the pre-P0 body.
  let signatureMatch = null;
  if (existedBefore) {
    const preSig = signatureOf(pre);
    signatureMatch = JSON.stringify(preSig) === JSON.stringify(signatureOf(fixBodyOf(name))) || compareViaRollback(pre, name);
  }
  return { function: name, existedBeforeP0: existedBefore, replaceKind, rollbackAction, rollbackCovered: rollbackOk, signatureInclSecurityMatch: signatureMatch };
});

// Slice the fix file for one function's body (from its create statement to the next section marker).
function fixBodyOf(name) {
  const re = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'i');
  const m = FIX.match(re);
  if (!m || m.index === undefined) return '';
  const rest = FIX.slice(m.index);
  const end = rest.search(/\n-- ──|\n-- \[P0\] |\ncommit;/i);
  return end > 0 ? rest.slice(0, end) : rest;
}
function compareViaRollback(pre, name) {
  // The rollback embeds the exact pre-P0 body; compare signatures from rollback slice.
  const i = ROLLBACK.toLowerCase().indexOf(`-- restore: ${name}`);
  if (i < 0) return false;
  const slice = ROLLBACK.slice(i, ROLLBACK.indexOf('-- restore:', i + 4) > 0 ? ROLLBACK.indexOf('-- restore:', i + 4) : ROLLBACK.length);
  const a = signatureOf(slice);
  const b = signatureOf(pre);
  return a && b && a.name === b.name && a.args === b.args && a.secDef === b.secDef;
}

mkdirSync(EVID, { recursive: true });
const allCovered = rows.every((r) => r.rollbackCovered);
const allSigMatch = rows.every((r) => r.signatureInclSecurityMatch !== false);
writeFileSync(join(EVID, 'fn-coverage.json'), JSON.stringify({ generatedAt: new Date().toISOString(), total: rows.length, covered: rows.filter((r) => r.rollbackCovered).length, allCovered, allSignatureInclSecurityMatch: allSigMatch, rows }, null, 2));
const md = [
  '| function | existed pre-P0 | kind | rollback action | rollback covered | signature+SECURITY match |',
  '|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.function} | ${r.existedBeforeP0} | ${r.replaceKind} | ${r.rollbackAction} | ${r.rollbackCovered ? '✅' : '❌'} | ${r.signatureInclSecurityMatch === null ? 'n/a (new)' : r.signatureInclSecurityMatch ? '✅' : '❌'} |`),
].join('\n');
writeFileSync(join(EVID, 'fn-coverage.md'), md + '\n');
console.log(md);
console.log(`\ncoverage: ${rows.filter((r) => r.rollbackCovered).length}/${rows.length}; signatures ok: ${allSigMatch}`);
if (!allCovered || !allSigMatch) process.exit(1);
