#!/usr/bin/env node
// ============================================================================
// WP-01 / SEC-009 — Sensitive Financial Write Boundary Guard
// ============================================================================
//
// Purpose:
//   Prevent NEW browser/client code from writing directly to sensitive
//   financial tables. Existing historical writers on the base ref are
//   grandfathered. This guard is regression-only.
//
// Sensitive tables covered:
//   - payments, expenses, receipts, receipt_allocations
//   - owner_settlements, owner_settlement_payment_links, owner_settlement_expense_links
//   - journal_entries, journal_batches
//   - invoices (financial mutations)
//   - deposits, deposit_transactions
//
// Enforced paths:
//   - rentrix-app/src/**/*.{ts,tsx,js,jsx}
//
// Excluded:
//   - tests / fixtures / mocks
//   - supabase/** (migrations use SQL directly, guarded separately)
//   - docs / evidence
//
// What fails:
//   - a branch increases the number of Supabase client mutation chains
//     (.from('<table>').insert/update/delete/upsert) targeting a sensitive table.
//
// Usage:
//   node scripts/check-sensitive-financial-write-boundary.mjs [--base <ref>]
//
// ============================================================================

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

const TARGET_ROOTS = ['rentrix-app/src/'];
const PRODUCTION_EXT = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/i;
const TEST_OR_FIXTURE = /(?:^|\/)(?:__tests__|tests?|fixtures?|mocks?)(?:\/|$)|\.(?:test|spec)\.[^.]+$/i;

const SENSITIVE_TABLES = [
  'payments',
  'expenses',
  'receipts',
  'receipt_allocations',
  'owner_settlements',
  'owner_settlement_payment_links',
  'owner_settlement_expense_links',
  'journal_entries',
  'journal_batches',
  'invoices',
  'deposits',
  'deposit_transactions',
];

const CLIENT_WRITE_RE = new RegExp(
  `\\.from\\s*\\(\\s*([\"'])(${SENSITIVE_TABLES.join('|')})\\1\\s*\\)\\s*\\.\\s*(insert|update|delete|upsert)\\s*\\(`,
  'gi',
);

function parseArgs(argv) {
  let base = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base' && argv[i + 1]) {
      base = argv[i + 1];
      i += 1;
    }
  }
  return { base };
}

function refExists(ref) {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

function resolveBaseRef(cliBase) {
  if (cliBase) return cliBase;
  if (process.env.SENSITIVE_WRITE_BOUNDARY_BASE_REF) return process.env.SENSITIVE_WRITE_BOUNDARY_BASE_REF;
  for (const ref of ['origin/main', 'main']) {
    if (refExists(ref)) return ref;
  }
  throw new Error('Unable to resolve base ref. Pass --base <ref>.');
}

function isProductionTarget(path) {
  if (!path || !TARGET_ROOTS.some((root) => path.startsWith(root))) return false;
  if (!PRODUCTION_EXT.test(path)) return false;
  if (TEST_OR_FIXTURE.test(path)) return false;
  return true;
}

function changedPaths(baseRef) {
  const out = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  return out.split('\n').map((line) => line.trim()).filter(Boolean).filter(isProductionTarget);
}

function readHead(path) {
  const full = join(REPO_ROOT, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

function readAtRef(ref, path) {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

function countMatches(content) {
  CLIENT_WRITE_RE.lastIndex = 0;
  let count = 0;
  while (CLIENT_WRITE_RE.exec(content) !== null) count += 1;
  CLIENT_WRITE_RE.lastIndex = 0;
  return count;
}

function main() {
  const { base: cliBase } = parseArgs(process.argv.slice(2));
  const baseRef = resolveBaseRef(cliBase);
  if (!refExists(baseRef)) throw new Error(`Base ref does not resolve: ${baseRef}`);

  const violations = [];
  const checked = changedPaths(baseRef);

  for (const path of checked) {
    const beforeCount = countMatches(readAtRef(baseRef, path));
    const afterCount = countMatches(readHead(path));

    if (afterCount > beforeCount) {
      violations.push({
        path,
        before: beforeCount,
        after: afterCount,
      });
    }
  }

  if (violations.length > 0) {
    console.error('\nSensitive Financial Write Boundary Guard: FAILED\n');
    for (const violation of violations) {
      console.error(`  file:   ${violation.path}`);
      console.error(`  reason: New browser .from('<sensitive_table>').insert/update/delete/upsert detected.`);
      console.error(`  count:  base=${violation.before}, head=${violation.after}`);
      console.error(`  fix:    Route financial mutations through SECURITY DEFINER RPCs.`);
      console.error(`          Sensitive tables: ${SENSITIVE_TABLES.join(', ')}`);
      console.error('');
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Sensitive Financial Write Boundary Guard: OK (base ref: ${baseRef}; production files checked: ${checked.length})`);
}

main();
