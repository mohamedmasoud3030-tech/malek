/**
 * Phase 3A-1C forward → lifecycle → rollback → exact catalog baseline →
 * reapply → lifecycle proof. Runs only against ephemeral PGlite.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase, repoRoot } from '../p1/replay-bootstrap';
import {
  ADMIN_A,
  COMPANY_A,
  OWNER_A,
  PROPERTY_A,
  rpcJsonb,
  seedPhase3a1cFixture,
} from './phase3a1c-fixture';

const MIGRATION = '20260729090000_phase3a1c_owner_settlement_account_resolution.sql';
const MIGRATION_KEY = 'phase3a1c_owner_settlement_account_resolution';
const ROLLBACK = '20260729_rollback_phase3a1c_owner_settlement_account_resolution.sql';
const OUT_DIR = join(repoRoot, 'evidence', 'p3', 'phase3a1c');
const NAMES = [
  'create_owner_settlement_draft_atomic',
  'approve_owner_settlement_atomic',
  'pay_owner_settlement_atomic',
  'cancel_owner_settlement_atomic',
  'calculate_owner_net_payout',
  'require_company_account_id',
];
const REDEFINED = NAMES.slice(0, 4);
const PRESERVED = NAMES.slice(4);
let db: PGlite;

async function fingerprint() {
  const { rows } = await db.query(
    `select 'public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as signature,
            md5(p.prosrc) as body_md5,
            p.prosecdef as security_definer,
            p.proconfig::text as search_path_config,
            r.rolname as owner,
            p.proacl::text as acl,
            obj_description(p.oid, 'pg_proc') as comment,
            has_function_privilege('public', p.oid, 'EXECUTE') as pub,
            has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
            has_function_privilege('service_role', p.oid, 'EXECUTE') as svc
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       join pg_roles r on r.oid = p.proowner
      where n.nspname = 'public' and p.proname = any($1::text[])
      order by 1`,
    [NAMES],
  );
  return rows as Record<string, unknown>[];
}

async function snapshot() {
  const { rows } = await db.query(`
    select
      (select count(*)::int from public.owner_settlements) as settlements,
      (select count(*)::int from public.owner_settlements where status = 'PAID') as paid,
      (select count(*)::int from public.journal_entries where entity_type = 'owner_settlement_payment') as payout_journals,
      (select count(*)::int from public.financial_operation_idempotency) as idempotency,
      (select count(*)::int from public.audit_log where entity = 'owner_settlements') as settlement_audits
  `);
  return rows[0] as Record<string, unknown>;
}

async function lifecycle(tag: 'forward' | 'reapply', month: string, n: number) {
  await assumeIdentity(db, ADMIN_A, COMPANY_A);
  const base = `31cf0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const created = await rpcJsonb(db, 'create_owner_settlement_draft_atomic', {
    request_id: base,
    owner_id: OWNER_A,
    property_id: PROPERTY_A,
    period_start: `${month}-01`,
    period_end: `${month}-30`,
    notes: tag,
  });
  const sid = String(created.settlement_id);
  await rpcJsonb(db, 'approve_owner_settlement_atomic', {
    settlement_id: sid,
    request_id: base.replace(/.$/, '1'),
  });
  const paid = await rpcJsonb(db, 'pay_owner_settlement_atomic', {
    settlement_id: sid,
    request_id: base.replace(/.$/, '2'),
    method: 'bank_transfer',
    payment_reference: `P3A1C-${tag}`,
  });
  const replay = await rpcJsonb(db, 'pay_owner_settlement_atomic', {
    settlement_id: sid,
    request_id: base.replace(/.$/, '2'),
    method: 'bank_transfer',
    payment_reference: `P3A1C-${tag}`,
  });
  expect(replay.idempotent).toBe(true);
  await expect(
    rpcJsonb(db, 'pay_owner_settlement_atomic', {
      settlement_id: sid,
      request_id: base.replace(/.$/, '2'),
      method: 'cash',
      payment_reference: `P3A1C-${tag}-changed`,
    }),
  ).rejects.toThrow(/IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST/);
  const trace = await db.query(
    `select count(*)::int as rows,
            count(distinct batch_id)::int as batches,
            coalesce(sum(amount) filter (where type = 'DEBIT'), 0)::numeric as debit,
            coalesce(sum(amount) filter (where type = 'CREDIT'), 0)::numeric as credit
       from public.journal_entries
      where entity_type = 'owner_settlement_payment' and entity_id = $1`,
    [sid],
  );
  expect(trace.rows[0]).toMatchObject({ rows: 2, batches: 1 });
  expect(Number((trace.rows[0] as any).debit)).toBe(Number((trace.rows[0] as any).credit));
  return { settlementId: sid, journalBatchId: paid.journal_batch_id, trace: trace.rows[0] };
}

describe('Phase 3A-1C forward / rollback / reapply', () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ excludeMigrations: [MIGRATION_KEY], writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;
    await seedPhase3a1cFixture(db);
  }, 420_000);

  afterAll(async () => {
    await db?.close();
  });

  it('restores exact catalog definitions and leaves every financial row intact', async () => {
    const migrationSql = readFileSync(join(repoRoot, 'supabase', 'migrations', MIGRATION), 'utf8');
    const rollbackSql = readFileSync(join(repoRoot, 'supabase', 'rollback', ROLLBACK), 'utf8');
    const baseline = await fingerprint();
    const baselineByName = new Map(baseline.map((row) => [String(row.signature).split('(')[0].split('.').at(-1), row]));

    await db.exec(migrationSql);
    const forward = await fingerprint();
    const forwardByName = new Map(forward.map((row) => [String(row.signature).split('(')[0].split('.').at(-1), row]));
    for (const name of REDEFINED) {
      expect(forwardByName.get(name)?.body_md5).not.toBe(baselineByName.get(name)?.body_md5);
    }
    for (const name of PRESERVED) {
      expect(forwardByName.get(name)).toEqual(baselineByName.get(name));
    }
    for (const row of forward) {
      const name = String(row.signature).split('(')[0].split('.').at(-1)!;
      const base = baselineByName.get(name);
      expect(row.acl, `${name} ACL`).toBe(base?.acl);
      expect(row.owner, `${name} owner`).toBe(base?.owner);
      expect(row.search_path_config, `${name} search_path`).toBe(base?.search_path_config);
    }

    const firstLifecycle = await lifecycle('forward', '2026-07', 100);
    const afterForward = await snapshot();

    await db.exec(rollbackSql);
    const rolledBack = await fingerprint();
    expect(rolledBack).toEqual(baseline);
    const afterRollback = await snapshot();
    expect(afterRollback).toEqual(afterForward);

    await db.exec(migrationSql);
    const reapplied = await fingerprint();
    expect(reapplied).toEqual(forward);
    const secondLifecycle = await lifecycle('reapply', '2026-06', 200);

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(
      join(OUT_DIR, 'forward-rollback-fingerprint.json'),
      `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        migration: MIGRATION,
        rollback: ROLLBACK,
        redefined: REDEFINED,
        preserved: PRESERVED,
        baselineEqualsRolledBack: true,
        forwardEqualsReapplied: true,
        aclOwnerAndSearchPathUnchanged: true,
        commentsRestoredExactly: true,
        financialRowsUntouchedByRollback: true,
        snapshotAfterForward: afterForward,
        snapshotAfterRollback: afterRollback,
        lifecycle: { forward: firstLifecycle, reapply: secondLifecycle },
        baselineFingerprint: baseline,
      }, null, 2)}\n`,
    );
  }, 420_000);
});
