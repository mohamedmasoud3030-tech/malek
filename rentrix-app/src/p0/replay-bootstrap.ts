/**
 * P0 — Isolated multi-tenant replay bootstrap (PGlite, Docker-free).
 *
 * Replays the real supabase/migrations chain (chronological) onto a disposable
 * PGlite instance so P0 can *behaviorally* verify company isolation instead of
 * trusting static reading. Supabase platform surface that PGlite cannot provide
 * is stubbed (auth.jwt/uid, storage buckets/objects, cron) — the stubs mirror
 * the shapes the migrations depend on, nothing more.
 *
 * Transform applied ONLY in-memory (repository files are never modified):
 *   - `CREATE EXTENSION …;` statements are commented out; the needed contrib
 *     modules (btree_gist, pgcrypto, uuid_ossp) are loaded via PGlite extensions.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';

export const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const evidenceDir = join(repoRoot, 'evidence', 'p0');

export type ReplayResult = {
  db: PGlite;
  applied: string[];
  failed: { file: string; error: string }[];
};

import { STUB_SQL_HEADER as STUB_SQL, REPLAY_TRANSFORMS as TRANSFORMS } from './replay-stubs';

export async function createReplayedDatabase(): Promise<ReplayResult> {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto, uuid_ossp } });
  await db.exec(STUB_SQL);

  const migDir = join(repoRoot, 'supabase', 'migrations');
  // The P0 fix migration is deliberately EXCLUDED from the shared replay so
  // every probe observes pre-fix main; the behavioral suite applies it
  // explicitly for its post-fix phase. P1-owned files are likewise excluded:
  // they are verified by the dedicated P1 harness (src/p1/replay-bootstrap.ts,
  // full-chain replay) so the P0 suites keep measuring the P0 delta only and
  // the P0 forward-rollback fingerprint stays byte-exact.
  const files = readdirSync(migDir)
    .filter((f) => f.endsWith('.sql') && !f.includes('p0_company_isolation') && !f.includes('p1_owner_settlement'))
    .sort((a, b) => a.localeCompare(b));
  const applied: string[] = [];
  const failed: { file: string; error: string }[] = [];

  for (const file of files) {
    const raw = readFileSync(join(migDir, file), 'utf8');
    // In-memory only: pg_cron is not a PGlite contrib module — its CREATE
    // EXTENSION is neutralized; scheduling is stubbed via cron.* above.
    // All other extensions (btree_gist, pgcrypto, uuid-ossp) run natively.
    let sql = raw.replace(/create\s+extension\s+if\s+not\s+exists\s+pg_cron[^;]*;/gi, (m) => `-- p0-harness stripped: ${m}`);
    for (const t of TRANSFORMS) {
      if (t.file === file) sql = sql.replace(t.pattern, t.replacement);
    }
    try {
      await db.exec(sql);
      applied.push(file);
    } catch (error) {
      failed.push({ file, error: String(error).slice(0, 400) });
      // Guard: never let an aborted transaction poison subsequent files.
      await db.exec('ROLLBACK;').catch(() => undefined);
      // `set_config` frames below keep the harness runnable around failed DDL.
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
        appliedFiles: applied,
        failedFiles: failed,
      },
      null,
      2,
    ),
  );

  return { db, applied, failed };
}

/** Switch the session to a given user/company JWT context (Supabase claim shape). */
export async function assumeIdentity(db: PGlite, userId: string, companyId: string | null) {
  const claims = JSON.stringify({
    sub: userId,
    role: 'authenticated',
    app_metadata: companyId ? { company_id: companyId } : {},
  });
  await db.exec(`SELECT set_config('request.jwt.claims', '${claims}', false);`);
}

/** Introspect NOT NULL columns (no default) for a table — fixture authoring aid. */
export async function requiredColumns(db: PGlite, table: string) {
  const { rows } = await db.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
        AND is_nullable = 'NO' AND column_default IS NULL
      ORDER BY ordinal_position`,
    [table],
  );
  return rows;
}
