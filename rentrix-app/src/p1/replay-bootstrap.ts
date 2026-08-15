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
import {
  STUB_SQL_HEADER as STUB_SQL,
  REPLAY_TRANSFORMS as TRANSFORMS,
  S02_ACL_MIGRATION_MARKER,
  provideS02AclPrerequisites,
  removeS02AclPrerequisites,
} from '../p0/replay-stubs';

export const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const evidenceDir = join(repoRoot, 'evidence', 'p1');

export type ReplayResult = {
  db: PGlite;
  applied: string[];
  failed: { file: string; error: string }[];
};

const LATER_GOVERNED_STAGE_MARKERS = [
  '_s03_',
  '_s04_',
  '_s06_',
  '_s08_',
  // WP-05 depends on the current accounting-period and governed S08 schema.
  // Historical checkpoint suites must not replay it into older baselines.
  '_wp05_',
  // GAP-007 has a strict foreign-key dependency on the S04 frozen agreement
  // version table. Historical checkpoint suites intentionally omit S04, so
  // they must omit this downstream migration as well.
  'wp02_fixed_monthly_daily_accrual',
  // GAP-009 structurally depends on the S03 GL engine, the S08 frozen views
  // and the S04 deposit kernels that historical checkpoint baselines
  // intentionally omit (same rule as GAP-007 above).
  'wp02_gap009_deposit_precision',
  'wp02_gap009_deposit_lifecycle',
  // GAP-008 references public.journal_batches and posts through the S03
  // canonical posting engine plus the S04 gl_pm_* kernels; historical
  // checkpoint baselines that omit S03/S04 must omit it too (same narrow
  // rationale as GAP-007/GAP-009 above).
  'wp02_gap008_due_from_owner_lifecycle',
  // GAP-010 depends on the governed S03/S04 GL posting stack (journal_batches,
  // gl_pm_round_omr, post_journal_event). Historical checkpoint suites that
  // intentionally omit S03/S04 must therefore omit this downstream migration.
  'wp02_gap010_tax_authority',
] as const;

export async function createFullReplayedDatabase(options?: {
  throughMigration?: string;
  excludeMigrations?: string[];
  writeEvidence?: boolean;
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

  // Callers that provide explicit exclusions are checkpoint/isolation suites.
  // Keep later governed S03/S04/S06/S08 migrations out of those historical
  // baselines. Current stage suites call with writeEvidence:false and no
  // explicit exclusions, so they still receive the complete migration chain.
  const checkpointExcludes = options?.excludeMigrations ? [...LATER_GOVERNED_STAGE_MARKERS] : [];
  const excludes = [...checkpointExcludes, ...(options?.excludeMigrations ?? [])];
  if (excludes.length > 0) {
    files = files.filter((f) => !excludes.some((ex) => f.includes(ex)));
  }

  const applied: string[] = [];
  const failed: { file: string; error: string }[] = [];

  for (const file of files) {
    const raw = readFileSync(join(migDir, file), 'utf8');
    let sql = raw.replace(/create\s+extension\s+if\s+not\s+exists\s+pg_cron[^;]*;/gi, (m) => `-- p1-harness stripped: ${m}`);
    for (const t of TRANSFORMS) {
      if (t.file === file) sql = sql.replace(t.pattern, t.replacement);
    }
    const isS02Acl = file.includes(S02_ACL_MIGRATION_MARKER);
    const provided = isS02Acl ? await provideS02AclPrerequisites(db) : false;
    try {
      await db.exec(sql);
      applied.push(file);
    } catch (error) {
      failed.push({ file, error: String(error).slice(0, 400) });
      await db.exec('ROLLBACK;').catch(() => undefined);
      await db.exec("SELECT set_config('request.jwt.claims','{}', false);").catch(() => undefined);
    } finally {
      if (provided) await removeS02AclPrerequisites(db).catch(() => undefined);
    }
  }

  if (options?.writeEvidence === true) {
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
