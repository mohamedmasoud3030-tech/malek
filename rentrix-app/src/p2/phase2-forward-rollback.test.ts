/**
 * Phase 2 — Forward → verify → rollback → fingerprint-equivalence gate.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { STUB_SQL_HEADER as STUB_SQL, REPLAY_TRANSFORMS as TRANSFORMS } from '../p0/replay-stubs';
import { createFullReplayedDatabase, repoRoot } from '../p1/replay-bootstrap';

const migDir = join(repoRoot, 'supabase', 'migrations');
const rollbackPath = join(repoRoot, 'supabase', 'rollback', '20260726_rollback_phase2_reports_recovery.sql');
const fixFile = '20260726000000_phase2_financial_integrity_and_reports_recovery.sql';

function withHarnessTransforms(raw: string, file: string) {
  let sql = raw.replace(/create\s+extension\s+if\s+not\s+exists\s+pg_cron[^;]*;/gi, (m) => `-- p2-harness stripped: ${m}`);
  for (const t of TRANSFORMS) {
    if (t.file === file) sql = sql.replace(t.pattern, t.replacement);
  }
  return sql;
}

let db: PGlite;
let fpA: unknown;
let fpB: unknown;

async function q(sql: string, params: unknown[] = []) {
  return (await db.query(sql, params)).rows as any[];
}

async function fingerprint() {
  const functions = await q(
    `SELECT p.proname AS name,
            pg_get_function_identity_arguments(p.oid) AS args,
            p.prosecdef AS security_definer,
            p.proconfig::text AS config,
            p.proacl::text AS acl,
            r.rolname AS owner,
            pg_get_functiondef(p.oid) AS def
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       JOIN pg_roles r ON r.oid = p.proowner
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'rpt_trial_balance', 'rpt_balance_sheet', 'rpt_aged_receivables',
          'rpt_overdue_invoices', 'rpt_rent_roll', 'rpt_tenant_statement'
        )
      ORDER BY 1, 2`,
  );
  return { functions };
}

beforeAll(async () => {
  const replay = new PGlite({ extensions: { btree_gist, pgcrypto, uuid_ossp } });
  db = replay as unknown as PGlite;
  await db.exec(STUB_SQL);
  const files = readdirSync(migDir)
    .filter((f) => f.endsWith('.sql') && f !== fixFile)
    .sort((a, b) => a.localeCompare(b));
  const failed: { file: string; error: string }[] = [];
  for (const file of files) {
    try {
      await db.exec(withHarnessTransforms(readFileSync(join(migDir, file), 'utf8'), file));
    } catch (error) {
      failed.push({ file, error: String(error).slice(0, 300) });
      await db.exec('ROLLBACK;').catch(() => undefined);
    }
  }
  expect(failed, JSON.stringify(failed).slice(0, 500)).toEqual([]);
}, 420_000);

describe('Phase 2 — Forward -> Rollback Fingerprint', () => {
  it('measures baseline fingerprint, applies Phase 2, rolls back, and verifies byte-for-byte matches', async () => {
    fpA = await fingerprint();
    console.log('FINGERPRINT BASELINE:', JSON.stringify(fpA, null, 2));
    expect((fpA as any).functions.length).toBe(6);

    // Apply Phase 2 migration
    await db.exec(withHarnessTransforms(readFileSync(join(migDir, fixFile), 'utf8'), fixFile));

    const fpMiddle = await fingerprint();
    expect((fpMiddle as any).functions.length).toBe(6);
    // Verify that Phase 2 applied changes (e.g. search_path should be public, pg_temp, security definer exists)
    for (const fn of (fpMiddle as any).functions) {
      expect(fn.security_definer).toBe(true);
      expect(fn.config).toContain('search_path=public, pg_temp');
    }

    // Apply Phase 2 rollback
    await db.exec(readFileSync(rollbackPath, 'utf8'));

    fpB = await fingerprint();
    expect((fpB as any).functions.length).toBe(6);

    // Assert Fingerprint B ≡ Fingerprint A EXACTLY
    expect(JSON.stringify(fpB)).toBe(JSON.stringify(fpA));

    // Reapply Phase 2 to verify repeatable success
    await db.exec(withHarnessTransforms(readFileSync(join(migDir, fixFile), 'utf8'), fixFile));
    const fpFinal = await fingerprint();
    expect((fpFinal as any).functions.length).toBe(6);

    const evidenceDirLocal = join(repoRoot, 'evidence', 'p2');
    mkdirSync(evidenceDirLocal, { recursive: true });
    writeFileSync(
      join(evidenceDirLocal, 'p2-forward-rollback-fingerprint.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          migrationFile: fixFile,
          rollbackFile: rollbackPath,
          fingerprintEqual: true,
        },
        null,
        2
      )
    );
  }, 120_000);
});
