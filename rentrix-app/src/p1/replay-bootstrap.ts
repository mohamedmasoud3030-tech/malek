/**
 * P1 — Owner-settlement integrity replay bootstrap (PGlite, Docker-free).
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

export async function createFullReplayedDatabase(options?: {
  throughMigration?: string;
  excludeMigrations?: string[];
}): Promise<ReplayResult> {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto, uuid_ossp } });
  await db.exec(STUB_SQL);

  const migDir = join(repoRoot, 'supabase', 'migrations');
  let files = readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  if (options?.throughMigration) {
    const targetIdx = files.findIndex((f) => f.includes(options.throughMigration!));
    if (targetIdx !== -1) {
      files = files.slice(0, targetIdx + 1);
    }
  }

  if (options?.excludeMigrations) {
    files = files.filter((f) => {
      return !options.excludeMigrations!.some((ex) => f.includes(ex));
    });
  }

  const applied: string[] = [];
  const failed: { file: string; error: string }[] = [];

  for (const file of files) {
    const raw = readFileSync(join(migDir, file), 'utf8');
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

  // Only write replay-coverage inside evidence/p1/ if options are empty (representing default P1 behavior),
  // or we can skip writing to avoid modifying historical directories.
  // The user explicitly requested: "Phase 2 does not rewrite historical evidence directories; only write P2 evidence in evidence/p2/".
  // So we skip writing replay-coverage to evidence/p1/ if we are running in P2 or full suite contexts.
  if (!options) {
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
  }

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
