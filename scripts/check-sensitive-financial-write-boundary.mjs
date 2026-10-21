#!/usr/bin/env node
/**
 * MALEK — sensitive financial write boundary (SEC-009).
 *
 * Canonical rule: sensitive financial mutations are server/RPC owned; browser code cannot author
 * free-form accounting entries or bypass immutable-posted controls. Document 5 states it directly:
 * "New browser .from(...).insert/update/delete against sensitive tables is an explicit architecture
 * violation/review target."
 *
 * Why this file exists
 * --------------------
 * Document 7 (GAP-018, WP-01 closeout) cites `check-sensitive-financial-write-boundary.mjs` as the
 * regression guard that keeps that boundary honest. At `129b538` that file did not exist anywhere in
 * the repository, so the boundary had no automated protection. This is the guard, restored.
 *
 * What it enforces
 * ----------------
 * Production application code (`malek-app/src`, excluding tests, fixtures and mocks) must not call a
 * mutating chain on any table in SENSITIVE_TABLES. `.select()` and reads are allowed; `supabase.rpc()`
 * is the sanctioned write path.
 *
 * The table list is the twelve tables that carry the posting, obligation, collection, owner-fund and
 * deposit lifecycle. It is intentionally a *core* list: extending it is a one-line change plus review,
 * and omitting a table would silently weaken the guarantee.
 *
 * Reviewed exceptions
 * -------------------
 * `scripts/sensitive-write-allowlist.json` must stay empty unless an exception is genuinely reviewed.
 * Each entry needs file, table, operation and reason. This is not an escape hatch for convenience:
 * any entry is an acknowledged SEC-009 deviation and must be justified in review.
 *
 * Usage
 * -----
 *   node scripts/check-sensitive-financial-write-boundary.mjs            # scan the repository
 *   node scripts/check-sensitive-financial-write-boundary.mjs --json .gate/sensitive-writes.json
 *   node scripts/check-sensitive-financial-write-boundary.mjs --root <dir>
 *
 * Exit codes: 0 = clean, 1 = violation(s), 2 = usage/config error.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';

/**
 * The twelve sensitive financial tables (SEC-009 / FIN-* lifecycle).
 * Ledger → obligations → collections → owner funds → deposits → expenses.
 */
export const SENSITIVE_TABLES = [
  'journal_batches', // GL posting batches: immutable once posted
  'journal_lines', // GL lines: append-only posting surface
  'invoices', // tenant receivable obligation
  'invoice_credits', // credit notes reversing an issued invoice
  'payments', // collection event
  'receipts', // official receipt document
  'receipt_allocations', // allocation of a receipt to invoices
  'tenant_deposits', // deposit liability (2200)
  'deposit_transactions', // deposit application/refund events
  'owner_funds_events', // owner funds register (2000)
  'owner_settlements', // owner payout lifecycle
  'expenses', // cost capture feeding 1300/5100..6110
];

const MUTATION_METHODS = ['insert', 'update', 'delete', 'upsert'];
const EXCLUDED_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.vite', 'test-results', 'playwright-report']);
const EXCLUDED_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx|mjs)$|(^|[\\/])(fixtures?|mocks?|__mocks__|__tests__|e2e)([\\/]|$)/;

function parseArgs(argv) {
  const options = { root: 'malek-app/src', json: null, allowlist: 'scripts/sensitive-write-allowlist.json' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') options.root = argv[++i];
    else if (arg === '--json') options.json = argv[++i];
    else if (arg === '--allowlist') options.allowlist = argv[++i];
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return options;
}

function collectSourceFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRECTORIES.has(entry.name)) collectSourceFiles(join(dir, entry.name), files);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
    const relativePath = relative(process.cwd(), join(dir, entry.name)).split(sep).join('/');
    if (EXCLUDED_FILE_PATTERN.test(relativePath)) continue;
    files.push(join(dir, entry.name));
  }
  return files;
}

/**
 * Finds `.from('<table>')` chains that are followed by a mutating method before the next `.from(`.
 * String scanning (rather than an AST) is deliberate: it also catches code the TypeScript checker
 * never sees (dynamic helpers, template literals with a fixed table name) and cannot be fooled by
 * type assertions. It errs toward reporting, which is the safe direction for a security guard.
 */
export function findViolations(source, filePath) {
  const violations = [];
  const fromPattern = /\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)/g;
  const matches = [...source.matchAll(fromPattern)];

  matches.forEach((match, index) => {
    const table = match[1];
    if (!SENSITIVE_TABLES.includes(table)) return;

    const start = match.index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? source.length) : source.length;
    const segment = source.slice(start, end);
    const mutation = MUTATION_METHODS.find((method) => new RegExp(`\\.${method}\\(`).test(segment));
    if (!mutation) return;

    const line = source.slice(0, start).split('\n').length;
    violations.push({ file: filePath, line, table, operation: mutation });
  });

  return violations;
}

function loadAllowlist(path) {
  if (!existsSync(resolve(process.cwd(), path))) return { version: null, entries: [] };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
  } catch (error) {
    console.error(`Allowlist ${path} is not valid JSON: ${error instanceof Error ? error.message : error}`);
    process.exit(2);
  }
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  for (const entry of entries) {
    if (!entry.file || !entry.table || !entry.operation || !entry.reason) {
      console.error(`Allowlist entry is missing file/table/operation/reason: ${JSON.stringify(entry)}`);
      process.exit(2);
    }
  }
  return { version: parsed.version ?? 1, entries };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = resolve(process.cwd(), options.root);
  if (!existsSync(rootDir)) {
    console.error(`Scan root does not exist: ${options.root}`);
    process.exit(2);
  }

  const allowlist = loadAllowlist(options.allowlist);
  const files = collectSourceFiles(rootDir);
  const violations = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const relativePath = relative(process.cwd(), file).split(sep).join('/');
    violations.push(...findViolations(source, relativePath));
  }

  const allowed = [];
  const unallowed = [];
  for (const violation of violations) {
    const exception = allowlist.entries.find(
      (entry) =>
        entry.file === violation.file &&
        entry.table === violation.table &&
        entry.operation === violation.operation,
    );
    (exception ? allowed : unallowed).push({ ...violation, reason: exception?.reason });
  }

  const unusedExceptions = allowlist.entries.filter(
    (entry) =>
      !violations.some(
        (violation) =>
          violation.file === entry.file &&
          violation.table === entry.table &&
          violation.operation === entry.operation,
      ),
  );

  const artifact = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    rule: 'SEC-009',
    scanRoot: options.root,
    filesScanned: files.length,
    sensitiveTables: SENSITIVE_TABLES,
    violations: unallowed,
    reviewedExceptions: allowed,
    unusedExceptions,
  };

  if (options.json) {
    mkdirSync(resolve(process.cwd(), dirname(options.json)), { recursive: true });
    writeFileSync(resolve(process.cwd(), options.json), `${JSON.stringify(artifact, null, 2)}\n`);
  }

  console.log('Sensitive financial write boundary (SEC-009)');
  console.log(`  scan root        : ${options.root}`);
  console.log(`  files scanned    : ${files.length}`);
  console.log(`  sensitive tables : ${SENSITIVE_TABLES.length}`);
  console.log(`  exceptions       : ${allowlist.entries.length} (used: ${allowed.length}, unused: ${unusedExceptions.length})`);

  if (unallowed.length > 0) {
    console.error('');
    console.error(`FAIL — ${unallowed.length} direct browser mutation(s) against sensitive financial tables:`);
    for (const violation of unallowed) {
      console.error(`  ${violation.file}:${violation.line}  .from('${violation.table}').${violation.operation}()`);
    }
    console.error('');
    console.error('Sensitive financial writes must go through an RPC (SEC-009). Replace the client chain with');
    console.error('the authoritative RPC; do not add an allowlist entry to make this pass.');
    process.exit(1);
  }

  if (unusedExceptions.length > 0) {
    console.error('');
    console.error(`FAIL — ${unusedExceptions.length} allowlist entr(ies) no longer match any code:`);
    for (const entry of unusedExceptions) {
      console.error(`  ${entry.file}  ${entry.table}.${entry.operation}`);
    }
    console.error('Remove stale exceptions; an unused exception hides that the code moved.');
    process.exit(1);
  }

  if (allowed.length > 0) {
    console.log('');
    console.log(`REVIEWED_EXCEPTIONS — ${allowed.length} acknowledged SEC-009 deviation(s):`);
    for (const violation of allowed) {
      console.log(`  ${violation.file}:${violation.line}  ${violation.table}.${violation.operation} — ${violation.reason}`);
    }
  }

  console.log('');
  console.log('PASS — no unapproved direct browser writes to sensitive financial tables.');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
