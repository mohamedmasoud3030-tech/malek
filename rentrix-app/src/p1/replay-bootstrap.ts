/**
 * P1 — Owner-settlement integrity replay bootstrap (PGlite, Docker-free).
 *
 * The repository now starts from a canonical database dump. Keep this legacy
 * replay helper compatible with that source of truth instead of teaching tests
 * to resurrect deleted historical migrations.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { citext } from '@electric-sql/pglite/contrib/citext';
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

export type ReplayResult = {
  db: PGlite;
  applied: string[];
  failed: { file: string; error: string }[];
};

const RC1_ACCOUNTING_MARKERS = [
  'rc1_owner_agency_invoice_accounting_model',
  'rc1_invoice_credit_original_economics',
  'rc1_payment_tax_and_write_boundary',
  'rc1_cutover_fee_tax_and_legacy_fail_closed',
  'rc1_accounting_closeout_hardening',
  'rc1_inline_owner_funds_solvency_type_closeout',
  'rc1_release_integration_fk_indexes',
  'rc1_owner_offset_2000_control',
] as const;

const LATER_GOVERNED_STAGE_MARKERS = [
  '_s03_', '_s04_', '_s06_', '_s08_', '_wp05_',
  'wp02_fixed_monthly_daily_accrual', 'wp02_gap009_deposit_precision',
  'wp02_gap009_deposit_lifecycle', 'wp02_gap008_due_from_owner_lifecycle',
  'wp02_gap010_tax_authority', 'wp02_gap010_effective_history_resolution',
  'phase1_omr_precision_convergence', 'phase2_invoice_truth',
  'phase3_credit_and_ar_integrity', ...RC1_ACCOUNTING_MARKERS,
  'sole_admin_exception', 'wp01_receipt_void_audit_contract_restore',
  'hot_path_fk_covering_indexes',
] as const;

export async function createFullReplayedDatabase(options?: {
  throughMigration?: string;
  excludeMigrations?: string[];
  includeLaterGoverned?: boolean;
  writeEvidence?: boolean;
}): Promise<ReplayResult> {
  const db = new PGlite({ extensions: { btree_gist, citext, pgcrypto, uuid_ossp } });
  await db.exec('create schema if not exists extensions;');
  for (const ext of ['pgcrypto', 'btree_gist', 'citext']) {
    await db.exec(`create extension if not exists ${ext} with schema extensions;`);
  }
  await db.exec('set search_path to public, extensions;');
  await db.exec(STUB_SQL);

  const migDir = join(repoRoot, 'supabase', 'migrations');
  let files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort((a, b) => a.localeCompare(b));

  if (options?.throughMigration) {
    const targetIdx = files.findIndex((f) => f.includes(options.throughMigration!));
    if (targetIdx !== -1) files = files.slice(0, targetIdx + 1);
  }

  // The canonical baseline already contains all pre-squash history. Historical
  // marker exclusions are meaningful only when those old files still exist.
  // On the canonical chain, replay the chain as committed and let explicit
  // callers exclude only files that actually exist.
  const canonicalChain = files.some((f) => f.includes('canonical_baseline'));
  const defaultHistoricalExcludes = !canonicalChain && !options ? [...RC1_ACCOUNTING_MARKERS] : [];
  const checkpointExcludes = !canonicalChain && options?.excludeMigrations && !options.includeLaterGoverned
    ? [...LATER_GOVERNED_STAGE_MARKERS]
    : [];
  const excludes = [...defaultHistoricalExcludes, ...checkpointExcludes, ...(options?.excludeMigrations ?? [])];
  if (excludes.length > 0) files = files.filter((f) => !excludes.some((ex) => f.includes(ex)));

  const applied: string[] = [];
  const failed: { file: string; error: string }[] = [];

  for (const file of files) {
    const raw = readFileSync(join(migDir, file), 'utf8');
    let sql = raw
      .replace(/create\s+extension\s+if\s+not\s+exists\s+pg_cron[^;]*;/gi, (m) => `-- p1-harness stripped: ${m}`)
      .replace(/create\s+extension\s+if\s+not\s+exists\s+(pgcrypto|btree_gist|citext)\s+with\s+schema\s+extensions\s*;/gi, 'select 1;');
    for (const t of TRANSFORMS) if (t.file === file) sql = sql.replace(t.pattern, t.replacement);
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

  // `supabase db reset` applies the canonical reference seed after the migration
  // chain. Mirror that contract for full canonical PGlite replays so tests see
  // global/system reference rows (for example tax_code_catalog) without
  // resurrecting company/demo data. Checkpoint/exclusion replays intentionally
  // remain migration-only because they model partial historical states.
  const isFullCanonicalReplay = canonicalChain
    && !options?.throughMigration
    && (options?.excludeMigrations?.length ?? 0) === 0;
  if (isFullCanonicalReplay && failed.length === 0) {
    try {
      await db.exec(readFileSync(join(repoRoot, 'supabase', 'seed.sql'), 'utf8'));
    } catch (error) {
      failed.push({ file: 'seed.sql', error: String(error).slice(0, 400) });
      await db.exec('ROLLBACK;').catch(() => undefined);
      await db.exec("SELECT set_config('request.jwt.claims','{}', false);").catch(() => undefined);
    }
  }

  return { db, applied, failed };
}

export async function assumeIdentity(db: PGlite, userId: string | null, companyId: string | null) {
  const claims = JSON.stringify({ sub: userId ?? undefined, role: userId ? 'authenticated' : undefined, app_metadata: companyId ? { company_id: companyId } : {} });
  await db.exec(`SELECT set_config('request.jwt.claims', '${claims}', false);`);
}