// Guardian migration checks:
//
//   * every forward migration replays on a clean database (inherited)
//   * old migrations are immutable (no edits to files that predate the branch)
//   * no destructive statements (DROP TABLE) without preconditions
//   * migration files are well-ordered and unique

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { MIGRATIONS_DIR } from '../../db0/lib/replay.mjs';
import { finding, SEVERITY } from './findings.mjs';

const MIGRATION_NAME = /^(\d{14})_[a-z0-9_]+\.sql$/;
// Matches executable destructive DML/DDL. We deliberately exclude GRANT /
// REVOKE privilege lists, which legitimately name TRUNCATE as a privilege
// token, and string literals/comments.
function stripNonExec(sql) {
  return sql
    .replace(/--[^\n]*/g, '')          // line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')  // block comments
    .replace(/'(?:[^']|'')*'/g, "''")  // string literals
    .replace(/"(?:[^"]|"")*"/g, '""'); // quoted identifiers
}

const FORBIDDEN = [
  { re: /\bDROP\s+TABLE\b/i, label: 'DROP TABLE' },
  { re: /^\s*TRUNCATE\b/im, label: 'TRUNCATE statement (not a GRANT/REVOKE)' },
];

export async function runMigrationChecks({ baseRef } = {}) {
  const findings = [];
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && MIGRATION_NAME.test(e.name))
    .map((e) => e.name)
    .sort();

  // uniqueness of timestamp prefix
  const stamps = new Map();
  for (const f of files) {
    const ts = f.slice(0, 14);
    if (stamps.has(ts)) {
      findings.push(finding({
        id: 'DG-MIG-002', severity: SEVERITY.HIGH, category: 'migration',
        title: `Duplicate migration timestamp ${ts}`,
        evidence: `${stamps.get(ts)} and ${f}`,
        remediation: 'Use a unique later timestamp.',
      }));
    }
    stamps.set(ts, f);
  }

  // no forbidden destructive statements
  for (const f of files) {
    const sql = stripNonExec(await readFile(join(MIGRATIONS_DIR, f), 'utf8'));
    for (const { re, label } of FORBIDDEN) {
      if (re.test(sql)) {
        findings.push(finding({
          id: 'DG-MIG-003', severity: SEVERITY.HIGH, category: 'migration',
          title: `Migration ${f} contains ${label}`,
          evidence: label,
          detail: 'Destructive DDL requires a guarded precondition and is not allowed by default.',
          remediation: 'Use new forward migrations with IF EXISTS guards, or document an approved cutover.',
        }));
      }
    }
  }

  // immutability: migrations already on the base branch must not be modified
  if (baseRef) {
    const git = spawnSync('git', ['diff', '--name-only', `${baseRef}...HEAD`, '--', 'supabase/migrations'], {
      encoding: 'utf8',
    });
    if (git.status === 0) {
      const changed = git.stdout.split('\n').filter(Boolean).map((p) => p.split('/').pop());
      // Files that existed on base (merge-base) and are now modified are immutable violations.
      for (const f of changed) {
        if (!MIGRATION_NAME.test(f)) continue;
        const existed = spawnSync('git', ['cat-file', '-e', `${baseRef}:supabase/migrations/${f}`], { stdio: 'ignore' });
        if (existed.status === 0) {
          findings.push(finding({
            id: 'DG-MIG-004', severity: SEVERITY.CRITICAL, category: 'migration',
            title: `Pre-existing migration ${f} was modified`,
            evidence: f,
            remediation: 'Merged migrations are immutable. Add a new forward migration instead.',
          }));
        }
      }
    }
  }

  return { findings, migrationCount: files.length };
}
