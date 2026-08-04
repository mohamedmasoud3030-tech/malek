/**
 * Stage 3 — General Ledger Core shared replay/seed harness (PGlite).
 *
 * Provides a fully replayed database plus the two-company accounting fixture
 * used by every Stage 3 test file. All writes stay in the ephemeral database.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase, assumeIdentity, repoRoot } from '../p1/replay-bootstrap';

export const COMPANY_A = 'c3000000-0000-4000-8000-000000000001';
export const COMPANY_B = 'c3000000-0000-4000-8000-000000000002';
export const ADMIN_A = 'a3000000-0000-4000-8000-000000000001';
export const ADMIN_B = 'a3000000-0000-4000-8000-000000000002';
export const USER_A = 'a3000000-0000-4000-8000-000000000003';

export const MIGRATIONS = {
  accounts: '20260804030000_stage3_gl_core_chart_of_accounts_and_periods.sql',
  ledger: '20260804030100_stage3_gl_core_journal_batches_and_lines.sql',
  engine: '20260804030200_stage3_gl_core_posting_engine_and_rpcs.sql',
};

export type Stage3Db = {
  db: PGlite;
};

/** Full replay through the whole migration chain (all Stage 3 files included). */
export async function createStage3Database(options?: { throughMigration?: string }): Promise<Stage3Db> {
  const replay = await createFullReplayedDatabase({
    writeEvidence: false,
    ...(options?.throughMigration ? { throughMigration: options.throughMigration } : {}),
  });
  if (replay.failed.length > 0) {
    throw new Error(`Stage 3 replay failed: ${JSON.stringify(replay.failed.slice(0, 3))}`);
  }
  return { db: replay.db };
}

/**
 * Replays only up to (and including) the accounts migration, seeds legacy
 * journal_entries rows exactly as they existed pre-Stage-3, then applies the
 * ledger + engine migrations on top — proving the real backfill path.
 */
export async function createStage3DatabaseWithLegacyBackfill(): Promise<Stage3Db> {
  const replay = await createFullReplayedDatabase({
    writeEvidence: false,
    throughMigration: '20260804030000',
  });
  if (replay.failed.length > 0) {
    throw new Error(`pre-backfill replay failed: ${JSON.stringify(replay.failed.slice(0, 3))}`);
  }
  const { db } = replay;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY_A}', 'Stage3 A', 'stage3-a'),
      ('${COMPANY_B}', 'Stage3 B', 'stage3-b');

    -- One balanced legacy pair with an explicit legacy batch_id (the pattern
    -- pay_owner_settlement_atomic used), one pair grouped by source identity
    -- (the pattern create_expense_with_journal_atomic used), one DRAFT row,
    -- and one row with no business event at all.
    -- The 1111/6100 rows already exist from the migration seeds; move them to
    -- the fixture company (legacy lines must reference company-owned accounts).
    update public.accounts set company_id = '${COMPANY_A}'
     where id in ('1111', '6100') and company_id is distinct from '${COMPANY_A}'::uuid;

    insert into public.journal_entries
      (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at, company_id, batch_id, status)
    values
      ('lg-0001', 'L-1-D', '2026-06-15', '1111', 100.00, 'DEBIT',  'src-1', 'expense', 'exp-1', now(), '${COMPANY_A}', 'bbbbbbbb-bbbb-4000-8000-000000000001', 'posted'),
      ('lg-0002', 'L-1-C', '2026-06-15', '6100', 100.00, 'CREDIT', 'src-1', 'expense', 'exp-1', now(), '${COMPANY_A}', 'bbbbbbbb-bbbb-4000-8000-000000000001', 'posted'),
      ('lg-0003', 'L-2-D', '2026-07-01', '1111', 250.50, 'DEBIT',  'src-2', 'deposit', 'dep-2', now(), '${COMPANY_A}', null, 'posted'),
      ('lg-0004', 'L-2-C', '2026-07-01', '6100', 250.50, 'CREDIT', 'src-2', 'deposit', 'dep-2', now(), '${COMPANY_A}', null, 'posted'),
      ('lg-0005', 'L-3-D', '2026-07-02', '1111', 10.00, 'DEBIT',  'src-3', 'expense', 'exp-3', now(), '${COMPANY_A}', null, 'draft'),
      ('lg-0006', 'L-4-D', '2026-07-03', '1111', 5.00,  'DEBIT',  null,     null,      null,     now(), '${COMPANY_A}', null, 'posted');
  `);

  // Apply the ledger + engine migrations manually on top of the seeded state.
  const migDir = join(repoRoot, 'supabase', 'migrations');
  for (const file of [MIGRATIONS.ledger, MIGRATIONS.engine]) {
    const sql = readFileSync(join(migDir, file), 'utf8');
    await db.exec(sql);
  }

  return { db };
}

export async function rpc(db: PGlite, name: string, payload: Record<string, unknown>) {
  const { rows } = await db.query(`select public.${name}($1::jsonb) as result`, [JSON.stringify(payload)]);
  return (rows[0] as { result: Record<string, unknown> }).result;
}

export async function rpc0(db: PGlite, name: string) {
  const { rows } = await db.query(`select public.${name}() as result`);
  return (rows[0] as { result: Record<string, unknown> }).result;
}

export async function rpcUuid(db: PGlite, name: string, id: string) {
  const { rows } = await db.query(`select public.${name}($1::uuid) as result`, [id]);
  return (rows[0] as { result: Record<string, unknown> }).result;
}

export async function seedCompaniesAndUsers(db: PGlite) {
  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY_A}', 'Stage3 Company A', 'stage3-a'),
      ('${COMPANY_B}', 'Stage3 Company B', 'stage3-b');

    insert into auth.users (id, email) values
      ('${ADMIN_A}', 'admin-a@stage3.test'),
      ('${ADMIN_B}', 'admin-b@stage3.test'),
      ('${USER_A}', 'user-a@stage3.test');

    insert into public.users (id, email, name, role, status) values
      ('${ADMIN_A}', 'admin-a@stage3.test', 'Admin A', 'ADMIN', 'ACTIVE'),
      ('${ADMIN_B}', 'admin-b@stage3.test', 'Admin B', 'ADMIN', 'ACTIVE'),
      ('${USER_A}', 'user-a@stage3.test', 'User A', 'USER', 'ACTIVE');

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN'),
      ('${COMPANY_B}', '${ADMIN_B}', 'ADMIN');
  `);
}

/** Switch the session JWT to an authenticated app user of the given company. */
export async function actAs(db: PGlite, userId: string, companyId: string) {
  await assumeIdentity(db, userId, companyId);
}

export const REQUIRED_ACCOUNT_NUMBERS = [
  '1111', '1120', '1201', '1300', '1600', '2000', '2100', '2200', '2300', '2500',
  '4000', '4100', '4200', '4300', '6100', '6110', '6200', '6300',
];
