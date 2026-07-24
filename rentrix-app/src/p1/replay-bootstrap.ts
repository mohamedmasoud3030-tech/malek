/**
 * P1 — Owner-settlement integrity replay bootstrap (PGlite, Docker-free).
 *
 * Unlike the P0 bootstrap (which deliberately excludes the P0 fix migration to
 * capture pre-fix main), the P1 harness replays the FULL migration chain —
 * including the merged P0 fix and the pending P1 migration — because the P1
 * behavioral assertions describe the end state on top of P0.
 *
 * Stubs/transforms are shared with the P0 harness (same Supabase surface that
 * PGlite cannot provide: auth.jwt/uid, storage buckets, cron).
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { STUB_SQL_HEADER as STUB_SQL, REPLAY_TRANSFORMS as TRANSFORMS } from '../p0/replay-stubs';

export const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const evidenceDir = join(repoRoot, 'evidence', 'p1');

export type ReplayResult = {
  db: PGlite;
  applied: string[];
  failed: { file: string; error: string }[];
};

export async function createFullReplayedDatabase(): Promise<ReplayResult> {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto, uuid_ossp } });
  await db.exec(STUB_SQL);

  const migDir = join(repoRoot, 'supabase', 'migrations');
  const files = readdirSync(migDir)
    .filter((f) => f.endsWith('.sql') && !f.includes('phase2_financial_integrity'))
    .sort((a, b) => a.localeCompare(b));
  const applied: string[] = [];
  const failed: { file: string; error: string }[] = [];

  for (const file of files) {
    const raw = readFileSync(join(migDir, file), 'utf8');
    // In-memory only — repository files are never modified: pg_cron has no
    // PGlite contrib module; see the P0 harness for the same transform.
    let sql = raw.replace(/create\s+extension\s+if\s+not\s+exists\s+pg_cron[^;]*;/gi, (m) => `-- p1-harness stripped: ${m}`);
    for (const t of TRANSFORMS) {
      if (t.file === file) sql = sql.replace(t.pattern, t.replacement);
    }
    try {
      await db.exec(sql);
      applied.push(file);
    } catch (error) {
      failed.push({ file, error: String(error).slice(0, 400) });
      await db.exec('ROLLBACK;').catch(() => undefined);
      await db.exec("SELECT set_config('request.jwt.claims','{}', false);").catch(() => undefined);
    }
  }

  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    join(evidenceDir, 'replay-coverage.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        total: files.length,
        applied: applied.length,
        failedCount: failed.length,
        failedFiles: failed,
      },
      null,
      2,
    ),
  );

  return { db, applied, failed };
}

/** Switch the session JWT claim context (Supabase claim shape), like production's hook. */
export async function assumeIdentity(db: PGlite, userId: string | null, companyId: string | null) {
  const claims = JSON.stringify({
    sub: userId ?? undefined,
    role: userId ? 'authenticated' : undefined,
    app_metadata: companyId ? { company_id: companyId } : {},
  });
  await db.exec(`SELECT set_config('request.jwt.claims', '${claims}', false);`);
}
