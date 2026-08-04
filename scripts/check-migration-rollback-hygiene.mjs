#!/usr/bin/env node
// ============================================================================
// Migration & Rollback Hygiene Guard (PR-D)
// ============================================================================
//
// Enforces, for NEW or MODIFIED files only (compared against a base ref):
//
//   1. No new file inside supabase/migrations/ whose filename contains
//      rollback / revert / undo / down.
//   2. No new file inside supabase/migrations/ whose content opens with an
//      explicit rollback-style header (Manual rollback, Rollback for,
//      Revert migration, Down migration).
//   3. Every .sql file inside supabase/rollback/ must contain an explicit
//      "Manual" rollback warning.
//   4. Every .sql file inside supabase/rollback/ must reference its
//      corresponding forward migration and follow the naming contract
//      (<timestamp>_rollback_<slug>.sql).
//   5. No modification, rename, or deletion of a historical file that
//      already exists on the base ref inside supabase/migrations/ — only
//      net-new additions are allowed there.
//   6. No file from supabase/rollback/ may be referenced by the migration
//      replay path (supabase/migrations/ + scripts/ci/*database-gate*).
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
const ROLLBACK_DIR = 'supabase/rollback';

const FILENAME_BAN_PATTERN = /(rollback|revert|undo|down)/i;
const HEADER_BAN_PATTERNS = [
  /--\s*manual rollback/i,
  /--\s*rollback for/i,
  /--\s*revert migration/i,
  /--\s*down migration/i,
];

const MANUAL_WARNING_PATTERN = /manual|emergency|not\s+auto-applied|not\s+applied\s+automatically/i;
const ROLLBACK_FILENAME_CONTRACT = /^\d{8,14}_rollback_[a-z0-9_]+\.sql$/;
// Accept either "Rollback for <file>.sql" or an explicit reference to a
// 8-14 digit migration timestamp somewhere in the first 15 lines.
const MIGRATION_REFERENCE_PATTERN = /\b\d{8,14}[a-z0-9_]*\.sql\b|\b\d{14}\b/i;

function fail(messages) {
  console.error('\nMigration & Rollback Hygiene Guard: FAILED\n');
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
    ['diff', '--name-status', '--find-renames', `${baseRef}...HEAD`, '--', MIGRATIONS_DIR, ROLLBACK_DIR],
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

  // --- Rule 5: historical migration files must not be modified, renamed, or deleted ---
  for (const entry of diff) {
    if (entry.status === 'R') {
      if (baseMigrationFiles.has(entry.oldPath) && entry.oldPath.startsWith(`${MIGRATIONS_DIR}/`)) {
        violations.push({
          file: `${entry.oldPath} -> ${entry.newPath}`,
          reason: 'A historical migration file present on the base ref was renamed.',
          rule: 'Rule 5: existing migrations are immutable once merged (no rename).',
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
        rule: 'Rule 5: existing migrations are immutable once merged (no delete).',
        fix: 'Restore the file. If the migration content is wrong, add a new forward corrective migration instead.',
      });
    }

    if (entry.status === 'M' && baseMigrationFiles.has(entry.path)) {
      violations.push({
        file: entry.path,
        reason: 'A historical migration file present on the base ref was modified.',
        rule: 'Rule 5: existing migrations are immutable once merged (no content change, including timestamp).',
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
        fix: `Move this file to ${ROLLBACK_DIR}/ if it is genuinely a manual rollback script, and give it a forward-migration name here instead if it is meant to run automatically.`,
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
        fix: `Move this file to ${ROLLBACK_DIR}/ with a "Manual rollback for <migration>.sql" header, and keep supabase/migrations/ forward-only.`,
      });
    }
  }

  // --- Rules 3 & 4: rollback directory files must carry a manual warning and reference ---
  for (const entry of diff) {
    const isNewOrModifiedRollback =
      (entry.status === 'A' || entry.status === 'M') &&
      entry.path &&
      entry.path.startsWith(`${ROLLBACK_DIR}/`) &&
      entry.path.endsWith('.sql');
    const isRenamedIntoRollback =
      entry.status === 'R' && entry.newPath && entry.newPath.startsWith(`${ROLLBACK_DIR}/`) && entry.newPath.endsWith('.sql');

    if (!isNewOrModifiedRollback && !isRenamedIntoRollback) continue;

    const path = isNewOrModifiedRollback ? entry.path : entry.newPath;
    const filename = path.split('/').pop();
    const content = readWorkingFile(path);
    if (content === null) continue;

    const head = headerLines(content, 20);

    if (!MANUAL_WARNING_PATTERN.test(head)) {
      violations.push({
        file: path,
        reason: 'Rollback script does not carry an explicit manual/emergency warning in its header.',
        rule: 'Rule 3: every file in supabase/rollback/ must clearly state it is manual and not auto-applied.',
        fix: 'Add a header comment such as "-- Manual rollback for <forward migration file>.sql — not auto-applied, run by hand only."',
      });
    }

    if (!ROLLBACK_FILENAME_CONTRACT.test(filename)) {
      violations.push({
        file: path,
        reason: `Filename "${filename}" does not follow the naming contract <timestamp>_rollback_<slug>.sql.`,
        rule: 'Rule 4: rollback filenames must follow the naming contract.',
        fix: 'Rename to <timestamp>_rollback_<slug>.sql, matching the forward migration it reverts.',
      });
    }

    if (!MIGRATION_REFERENCE_PATTERN.test(head)) {
      violations.push({
        file: path,
        reason: 'Rollback script does not reference its corresponding forward migration in the header.',
        rule: 'Rule 4: every rollback file must point at the migration it reverts.',
        fix: 'Add a header line such as "-- Rollback for: <exact forward migration filename>.sql".',
      });
    }
  }

  // --- Rule 6: nothing under supabase/rollback/ may be pulled into the replay path ---
  const gateScriptPath = 'scripts/ci/run-supabase-database-gate.sh';
  const gateScript = readWorkingFile(gateScriptPath);
  if (gateScript && gateScript.includes(`${ROLLBACK_DIR}/`)) {
    violations.push({
      file: gateScriptPath,
      reason: 'The migration replay gate script references supabase/rollback/.',
      rule: 'Rule 6: supabase/rollback/ must never be part of Clean Replay / CI migration replay.',
      fix: `Remove any reference to ${ROLLBACK_DIR}/ from the replay gate script. Only supabase/migrations/ may be replayed.`,
    });
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
    console.log('\nMigration & Rollback Hygiene Guard: LEGACY WARNING (non-blocking)');
    console.log('The following historical files already existed on the base ref, look');
    console.log('rollback-like by filename, and were left untouched by this change. They');
    console.log('are documented in docs/audits/MIGRATION_ROLLBACK_HYGIENE_AUDIT_AR.md and');
    console.log('are NOT a hygiene violation:\n');
    for (const f of legacyWarnings) console.log(`  - ${f}`);
    console.log('');
  }

  if (violations.length > 0) {
    fail(violations);
    return;
  }

  console.log(`Migration & Rollback Hygiene Guard: OK (base ref: ${baseRef})`);
}

main();
