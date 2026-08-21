#!/usr/bin/env node
// ============================================================================
// Migration Hygiene Guard (PR-D)
// ============================================================================
//
// Enforces, for NEW or MODIFIED files only (compared against a base ref):
//
//   1. No new file inside supabase/migrations/ whose filename contains
//      rollback / revert / undo / down.
//   2. No new file inside supabase/migrations/ whose content opens with an
//      explicit rollback-style header (Manual rollback, Rollback for,
//      Revert migration, Down migration).
//   3. No modification, rename, or deletion of a migration file that already
//      exists on the base ref — only net-new additions are allowed there.
//
// Historical (pre-existing on base) files that already look rollback-like
// are never treated as violations — they are reported separately as
// LEGACY warnings. Only the diff against the base ref is enforced.
//
// Usage:
//   node scripts/check-migration-rollback-hygiene.mjs [--base <ref>]
//
// Base ref resolution order:
//   1. --base <ref> CLI flag
//   2. MIGRATION_HYGIENE_BASE_REF env var
//   3. origin/main (if it resolves)
//   4. main (local fallback)
// ============================================================================

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const MIGRATIONS_DIR = 'supabase/migrations';

const FILENAME_BAN_PATTERN = /(rollback|revert|undo|down)/i;
const HEADER_BAN_PATTERNS = [
  /--\s*manual rollback/i,
  /--\s*rollback for/i,
  /--\s*revert migration/i,
  /--\s*down migration/i,
];

function fail(messages) {
  console.error('\nMigration Hygiene Guard: FAILED\n');
  for (const m of messages) {
    console.error(`  file:   ${m.file}`);
    console.error(`  reason: ${m.reason}`);
    console.error(`  rule:   ${m.rule}`);
    console.error(`  fix:    ${m.fix}`);
    console.error('');
  }
  process.exitCode = 1;
}

function resolveBaseRef(cliBase) {
  if (cliBase) return cliBase;
  if (process.env.MIGRATION_HYGIENE_BASE_REF) return process.env.MIGRATION_HYGIENE_BASE_REF;

  const candidates = ['origin/main', 'main'];
  for (const ref of candidates) {
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: REPO_ROOT, stdio: 'pipe' });
      return ref;
    } catch {
      // try next candidate
    }
  }
  throw new Error('Unable to resolve a base ref (tried origin/main, main). Pass --base <ref> explicitly.');
}

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

function gitDiffNameStatus(baseRef) {
  // Three-dot diff: compare base...HEAD via merge-base, matching the
  // project's established convention for branch analysis (avoids noise
  // from unrelated history divergence).
  const out = execFileSync(
    'git',
    ['diff', '--name-status', '--find-renames', `${baseRef}...HEAD`, '--', MIGRATIONS_DIR],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const status = parts[0];
      if (status.startsWith('R')) {
        // rename: status, old path, new path
        return { status: 'R', oldPath: parts[1], newPath: parts[2] };
      }
      return { status: status[0], path: parts[1] };
    });
}

function listBaseFiles(baseRef, dir) {
  const out = execFileSync('git', ['ls-tree', '-r', '--name-only', baseRef, '--', dir], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return new Set(out.split('\n').map((l) => l.trim()).filter(Boolean));
}

function readWorkingFile(relPath) {
  const full = join(REPO_ROOT, relPath);
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf8');
}

function headerLines(content, n = 15) {
  return content.split('\n').slice(0, n).join('\n');
}

function main() {
  const { base: cliBase } = parseArgs(process.argv.slice(2));
  const baseRef = resolveBaseRef(cliBase);

  const baseMigrationFiles = listBaseFiles(baseRef, MIGRATIONS_DIR);
  const diff = gitDiffNameStatus(baseRef);

  const violations = [];
  const legacyWarnings = [];

  // --- Rule 3: historical migration files must not be modified, renamed, or deleted ---
  for (const entry of diff) {
    if (entry.status === 'R') {
      if (
        baseMigrationFiles.has(entry.oldPath) &&
        entry.oldPath.startsWith(`${MIGRATIONS_DIR}/`)
      ) {
        violations.push({
          file: `${entry.oldPath} -> ${entry.newPath}`,
          reason: 'A historical migration file present on the base ref was renamed.',
          rule: 'Rule 3: existing migrations are immutable once merged (no rename).',
          fix: 'Revert the rename. If the migration content is wrong, add a new forward corrective migration instead.',
        });
      }
      continue;
    }

    if (!entry.path.startsWith(`${MIGRATIONS_DIR}/`)) continue;

    if (entry.status === 'D' && baseMigrationFiles.has(entry.path)) {
      violations.push({
        file: entry.path,
        reason: 'A historical migration file present on the base ref was deleted.',
        rule: 'Rule 3: existing migrations are immutable once merged (no delete).',
        fix: 'Restore the file. If the migration content is wrong, add a new forward corrective migration instead.',
      });
    }

    if (entry.status === 'M' && baseMigrationFiles.has(entry.path)) {
      violations.push({
        file: entry.path,
        reason: 'A historical migration file present on the base ref was modified.',
        rule: 'Rule 3: existing migrations are immutable once merged (no content change, including timestamp).',
        fix: 'Revert the change. Fix forward with a new migration instead of editing history.',
      });
    }
  }

  // --- Rules 1 & 2: new/added migration files must not look like rollback content ---
  for (const entry of diff) {
    const isNewMigrationFile =
      entry.status === 'A' && entry.path && entry.path.startsWith(`${MIGRATIONS_DIR}/`);
    const isRenamedIntoMigrations =
      entry.status === 'R' && entry.newPath && entry.newPath.startsWith(`${MIGRATIONS_DIR}/`) &&
      !baseMigrationFiles.has(entry.oldPath);

    if (!isNewMigrationFile && !isRenamedIntoMigrations) continue;

    const path = isNewMigrationFile ? entry.path : entry.newPath;
    const filename = path.split('/').pop();

    if (FILENAME_BAN_PATTERN.test(filename)) {
      violations.push({
        file: path,
        reason: `New migration filename contains a banned rollback-style keyword: "${filename.match(FILENAME_BAN_PATTERN)[0]}".`,
        rule: 'Rule 1: supabase/migrations/ is forward-only; rollback/revert/undo/down are not allowed in new filenames.',
        fix: 'Give the file a forward-migration name; add a new forward corrective migration instead of a rollback script.',
      });
      continue; // don't double-report the same file
    }

    const content = readWorkingFile(path);
    if (content === null) continue; // deleted in working tree between diff and read; skip

    const head = headerLines(content);
    const matchedHeader = HEADER_BAN_PATTERNS.find((re) => re.test(head));
    if (matchedHeader) {
      violations.push({
        file: path,
        reason: `New migration file opens with a rollback-style header (matches ${matchedHeader}).`,
        rule: 'Rule 2: supabase/migrations/ is forward-only; explicit rollback/revert/down headers are not allowed.',
        fix: 'Keep supabase/migrations/ forward-only; express the change as a forward corrective migration.',
      });
    }
  }

  // --- Legacy report (informational only, never fails the guard) ---
  for (const relPath of baseMigrationFiles) {
    const filename = relPath.split('/').pop();
    if (FILENAME_BAN_PATTERN.test(filename)) {
      const touchedInDiff = diff.some(
        (e) => e.path === relPath || e.oldPath === relPath || e.newPath === relPath,
      );
      if (!touchedInDiff) {
        legacyWarnings.push(relPath);
      }
    }
  }

  if (legacyWarnings.length > 0) {
    console.log('\nMigration Hygiene Guard: LEGACY WARNING (non-blocking)');
    console.log('The following historical files already existed on the base ref, look');
    console.log('rollback-like by filename, and were left untouched by this change. They');
    console.log('are NOT a hygiene violation:\n');
    for (const f of legacyWarnings) console.log(`  - ${f}`);
    console.log('');
  }

  if (violations.length > 0) {
    fail(violations);
    return;
  }

  console.log(`Migration Hygiene Guard: OK (base ref: ${baseRef})`);
}

main();
