#!/usr/bin/env node
// ============================================================================
// Stage S03 — No New Legacy Journal Writes Guard
// ============================================================================
//
// Purpose:
//   Prevent NEW production code from writing directly to the transitional
//   public.journal_entries compatibility surface. Historical writers already
//   present on the base ref are grandfathered until their owning business
//   stage migrates them with approved accounting semantics.
//
// Enforced paths:
//   - supabase/migrations/**/*.sql
//   - supabase/functions/**/*.{sql,ts,js,mjs,cjs}
//   - rentrix-app/src/**/*.{sql,ts,tsx,js,jsx,mjs,cjs}
//
// Excluded:
//   - tests / fixtures / mocks
//   - docs / evidence
//
// What fails:
//   - a branch increases the number of direct SQL INSERT/UPDATE/DELETE writes
//     targeting journal_entries in an enforced production file;
//   - a branch increases the number of Supabase client mutation chains that
//     target .from('journal_entries').
//
// Reads remain allowed. Existing historical occurrences on the base ref remain
// allowed without an allowlist. This makes the guard regression-only and lets
// S04/S05/S06 remove legacy writers incrementally instead of rewriting history.
//
// Usage:
//   node scripts/check-no-new-legacy-journal-writes.mjs [--base <ref>]
//
// Base ref resolution:
//   1. --base <ref>
//   2. GL_WRITE_BOUNDARY_BASE_REF
//   3. origin/main
//   4. main
// ============================================================================

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

const TARGET_ROOTS = ['supabase/migrations/', 'supabase/functions/', 'rentrix-app/src/'];
const PRODUCTION_EXT = /\.(?:sql|ts|tsx|js|jsx|mjs|cjs)$/i;
const TEST_OR_FIXTURE = /(?:^|\/)(?:__tests__|tests?|fixtures?|mocks?)(?:\/|$)|\.(?:test|spec)\.[^.]+$/i;

const SQL_WRITE = /\b(?:insert\s+into|update|delete\s+from)\s+(?:public\s*\.\s*)?["']?journal_entries["']?\b/gi;
const CLIENT_WRITE = /\.from\s*\(\s*(["'])journal_entries\1\s*\)\s*\.\s*(?:insert|update|delete|upsert)\s*\(/gi;

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
  if (process.env.GL_WRITE_BOUNDARY_BASE_REF) return process.env.GL_WRITE_BOUNDARY_BASE_REF;
  for (const ref of ['origin/main', 'main']) {
    if (refExists(ref)) return ref;
  }
  throw new Error('Unable to resolve base ref. Pass --base <ref>.');
}

function isProductionTarget(path) {
  if (!path || !TARGET_ROOTS.some((root) => path.startsWith(root))) return false;
  if (!PRODUCTION_EXT.test(path)) return false;
  if (path.endsWith('/20260901000000_canonical_baseline.sql')) return false;
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

function countMatches(content, regex) {
  regex.lastIndex = 0;
  let count = 0;
  while (regex.exec(content) !== null) count += 1;
  regex.lastIndex = 0;
  return count;
}

function counts(content) {
  return {
    sql: countMatches(content, SQL_WRITE),
    client: countMatches(content, CLIENT_WRITE),
  };
}

function main() {
  const { base: cliBase } = parseArgs(process.argv.slice(2));
  const baseRef = resolveBaseRef(cliBase);
  if (!refExists(baseRef)) throw new Error(`Base ref does not resolve: ${baseRef}`);

  const violations = [];
  const checked = changedPaths(baseRef);

  for (const path of checked) {
    const before = counts(readAtRef(baseRef, path));
    const after = counts(readHead(path));

    if (after.sql > before.sql) {
      violations.push({
        path,
        kind: 'direct SQL write',
        before: before.sql,
        after: after.sql,
      });
    }
    if (after.client > before.client) {
      violations.push({
        path,
        kind: "Supabase .from('journal_entries') mutation",
        before: before.client,
        after: after.client,
      });
    }
  }

  if (violations.length > 0) {
    console.error('\nS03 GL Write Boundary Guard: FAILED\n');
    for (const violation of violations) {
      console.error(`  file:   ${violation.path}`);
      console.error(`  reason: New ${violation.kind} targets the journal_entries compatibility surface.`);
      console.error(`  count:  base=${violation.before}, head=${violation.after}`);
      console.error('  fix:    Derive the business posting server-side and use post_journal_event()/reverse_journal_batch().');
      console.error('          If accounting semantics are not approved yet, leave the historical writer untouched until its owning stage.\n');
    }
    process.exitCode = 1;
    return;
  }

  console.log(`S03 GL Write Boundary Guard: OK (base ref: ${baseRef}; production files checked: ${checked.length})`);
}

main();
