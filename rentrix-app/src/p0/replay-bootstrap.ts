/**
 * P0 — Isolated multi-tenant replay bootstrap (PGlite, Docker-free).
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

export const P0_CHECKPOINT_EXCLUDED_MIGRATIONS = [
  'p0_company_isolation',
  'p1_owner_settlement',
  'phase2_financial_integrity',
  'phase3a1b_canonical_accounts',
  'phase3a1c_owner_settlement',
  'property_owner_workflow',
  'unit_archive_history',
  'contract_workflow',
  '20260804', // FA-003 owner-settlement input reservation (redefines settlement RPCs)
  // S02 is a later security stage. Replaying it inside the P0 checkpoint would
  // mask the exact pre-P0 row visibility and alter RPC fingerprints that P0
  // forward/rollback tests intentionally compare.
  's02_financial_direct_write_hardening_payments_expenses',
  's02_remove_residual_financial_write_policies',
  's02_financial_rpc_auth_sqlstate',
  // Stage 3 business document references: independent of the P0 isolation fix
  // and measured at its own checkpoint (see src/p3/stage3-business-references.test.ts).
  'business_document_references',
] as const;

export async function createReplayedDatabase(options?: {
  throughMigration?: string;
  excludeMigrations?: string[];
}): Promise<ReplayResult> {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto, uuid_ossp } });
  await db.exec(STUB_SQL);

  const migDir = join(repoRoot, 'supabase', 'migrations');
  let files = readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  // P0 causality and rollback equivalence are measured at the P0 checkpoint,
  // before later stages redefine the same policies and functions.
  const excludes = options?.excludeMigrations ?? P0_CHECKPOINT_EXCLUDED_MIGRATIONS;
  files = files.filter((f) => !excludes.some((ex) => f.includes(ex)));

  if (options?.throughMigration) {
    const targetIdx = files.findIndex((f) => f.includes(options.throughMigration!));
    if (targetIdx !== -1) {
      files = files.slice(0, targetIdx + 1);
    }
  }

  const applied: string[] = [];
  const failed: { file: string; error: string }[] = [];

  for (const file of files) {
    const raw = readFileSync(join(migDir, file), 'utf8');
    let sql = raw.replace(/create\s+extension\s+if\s+not\s+exists\s+pg_cron[^;]*;/gi, (m) => `-- p0-harness stripped: ${m}`);
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

  // Only write replay-coverage.json inside evidence/p0/ if options are empty (representing default P0 behavior),
  // preventing rewriting historical evidence directories.
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
          appliedFiles: applied,
          failedFiles: failed,
        },
        null,
        2,
      ),
    );
  }

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
