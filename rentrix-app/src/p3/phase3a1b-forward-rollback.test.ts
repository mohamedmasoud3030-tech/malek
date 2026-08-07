/**
 * Phase 3A-1B — forward / rollback / reapply fingerprint chain (§11).
 *
 *   baseline fingerprint (origin/main chain WITHOUT 3A-1B)
 *   → forward migration → lifecycle smoke
 *   → rollback (reverse order) → fingerprint MUST equal baseline byte-for-byte
 *     and NO financial row may be deleted or rewritten
 *   → reapply (forward order) → fingerprint equals the first forward run
 *   → lifecycle smoke again
 *
 * Output: evidence/p3/phase3a1b/forward-rollback-fingerprint.json
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase, repoRoot } from '../p1/replay-bootstrap';
import {
  ADMIN_A,
  COMPANY_A,
  INVOICE_A1,
  rpcJsonb,
  seedPhase3a1bFixture,
} from './phase3a1b-fixture';

const MIGRATION = '20260728090000_phase3a1b_canonical_accounts_invoice_payment_receipt_void.sql';
const MIGRATION_KEY = 'phase3a1b_canonical_accounts_invoice_payment_receipt_void';
const ROLLBACK = '20260728_rollback_phase3a1b_invoice_payment_receipt_void.sql';
const OUT_DIR = join(repoRoot, 'evidence', 'p3', 'phase3a1b');

const NAMES = [
  'find_payment_account_id',
  'generate_invoices_from_active_contracts',
  'record_invoice_payment_atomic',
  'post_receipt_atomic',
  'void_receipt_atomic',
  'require_company_account_id',
  'ensure_company_account',
];

const REDEFINED = [
  'public.find_payment_account_id(account_role text)',
  'public.generate_invoices_from_active_contracts()',
  'public.record_invoice_payment_atomic(payload jsonb)',
  'public.post_receipt_atomic(payload jsonb)',
  'public.void_receipt_atomic(payload jsonb)',
];
const PRESERVED = [
  'public.void_receipt_atomic(p_receipt_id uuid, p_voided_at timestamp with time zone, p_invoice_updates jsonb, p_reverse_entries jsonb)',
  'public.require_company_account_id(p_company_id uuid, p_account_no text)',
  'public.ensure_company_account(p_company_id uuid, p_account_no text, p_account_name text)',
];

let db: PGlite;

async function fingerprint() {
  const { rows } = await db.query(
    `select 'public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as signature,
            md5(p.prosrc) as body_md5,
            p.prosecdef as security_definer,
            p.proconfig::text as search_path_config,
            r.rolname as owner,
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

async function financialSnapshot() {
  const { rows } = await db.query(`
    select
      (select count(*)::int from public.invoices) as invoices,
      (select count(*)::int from public.receipts) as receipts,
      (select count(*)::int from public.receipts where status = 'VOID') as receipts_void,
      (select count(*)::int from public.payments) as payments,
      (select count(*)::int from public.payments where status = 'VOID') as payments_void,
      (select count(*)::int from public.receipt_allocations) as allocations,
      (select count(*)::int from public.journal_entries) as journals,
      (select count(*)::int from public.financial_operation_idempotency) as idempotency,
      (select count(*)::int from public.audit_log where action = 'VOID_RECEIPT_ATOMIC') as void_audits,
      (select coalesce(sum(amount),0)::numeric from public.receipts) as receipts_sum,
      (select coalesce(sum(paid_amount),0)::numeric from public.invoices) as invoices_paid_sum
  `);
  return rows[0] as Record<string, unknown>;
}

async function lifecycleSmoke(tag: string) {
  await assumeIdentity(db, ADMIN_A, COMPANY_A);
  const paid = await rpcJsonb(db, 'record_invoice_payment_atomic', {
    request_id: `p3a1b-chain-${tag}-pay`,
    invoice_id: INVOICE_A1,
    amount: 100,
    method: 'CASH',
    date: '2026-07-24',
  });
  expect(paid.success).toBe(true);
  const replayedPaid = await rpcJsonb(db, 'record_invoice_payment_atomic', {
    request_id: `p3a1b-chain-${tag}-pay`,
    invoice_id: INVOICE_A1,
    amount: 100,
    method: 'CASH',
    date: '2026-07-24',
  });
  expect(replayedPaid).toEqual(paid);
  await expect(
    rpcJsonb(db, 'record_invoice_payment_atomic', {
      request_id: `p3a1b-chain-${tag}-pay`,
      invoice_id: INVOICE_A1,
      amount: 101,
      method: 'CASH',
      date: '2026-07-24',
    }),
  ).rejects.toThrow(/IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST/);
  const receiptId = String(paid.receipt_id);
  const voided = await rpcJsonb(db, 'void_receipt_atomic', {
    receipt_id: receiptId,
    reason: `chain smoke ${tag}`,
    request_id: `p3a1b-chain-${tag}-void`,
  });
  expect(voided.success).toBe(true);
  expect(Number(voided.journal_reversal_entries)).toBe(2);
  const replayedVoid = await rpcJsonb(db, 'void_receipt_atomic', {
    receipt_id: receiptId,
    reason: `chain smoke ${tag}`,
    request_id: `p3a1b-chain-${tag}-void`,
  });
  expect(replayedVoid.idempotent).toBe(true);
  await expect(
    rpcJsonb(db, 'void_receipt_atomic', {
      receipt_id: receiptId,
      reason: `changed chain smoke ${tag}`,
      request_id: `p3a1b-chain-${tag}-void`,
    }),
  ).rejects.toThrow(/IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST/);
  return receiptId;
}

describe('Phase 3A-1B forward / rollback / reapply chain', () => {
  beforeAll(async () => {
    // Rollback equivalence is measured at the Phase 3A-1B checkpoint. The later
    // S02 migration intentionally redefines record_invoice_payment_atomic's
    // unauthenticated SQLSTATE and must not contaminate this historical baseline.
    const replay = await createFullReplayedDatabase({
      excludeMigrations: [MIGRATION_KEY, 's02_financial_rpc_auth_sqlstate'],
    });
    expect(replay.failed).toEqual([]);
    db = replay.db;
    await seedPhase3a1bFixture(db);
  }, 420_000);

  afterAll(async () => {
    await db?.close();
  });

  it('restores the byte-identical pre-state and never touches financial rows', async () => {
    const baselineFp = await fingerprint();
    const sigs = baselineFp.map((r) => String(r.signature));
    expect(sigs).toEqual(expect.arrayContaining([...REDEFINED, ...PRESERVED]));
    expect(baselineFp).toHaveLength(8); // 7 names, 8 overloads — both void overloads live

    // ── forward ──
    await db.exec(readFileSync(join(repoRoot, 'supabase', 'migrations', MIGRATION), 'utf8'));
    const fwd1Fp = await fingerprint();
    const bySigBase = new Map(baselineFp.map((r) => [String(r.signature), r]));
    const bySigFwd = new Map(fwd1Fp.map((r) => [String(r.signature), r]));
    for (const sig of REDEFINED) {
      expect(bySigFwd.get(sig)?.body_md5, `${sig} redefined by forward`).not.toBe(bySigBase.get(sig)?.body_md5);
    }
    for (const sig of PRESERVED) {
      expect(bySigFwd.get(sig)?.body_md5, `${sig} preserved by forward`).toBe(bySigBase.get(sig)?.body_md5);
    }
    // forward rewrites ACLs NEVER — posture must match baseline exactly
    for (const row of fwd1Fp) {
      const base = bySigBase.get(String(row.signature));
      expect({ pub: row.pub, anon: row.anon, auth: row.auth, svc: row.svc }, String(row.signature)).toEqual({
        pub: base?.pub, anon: base?.anon, auth: base?.auth, svc: base?.svc,
      });
      expect(row.search_path_config).toBe(base?.search_path_config);
      expect(row.security_definer).toBe(true);
    }

    const receiptAfterFwd = await lifecycleSmoke('fwd');
    const snapAfterFwd = await financialSnapshot();

    // ── rollback (reverse order — single file for this migration) ──
    await db.exec(readFileSync(join(repoRoot, 'supabase', 'rollback', ROLLBACK), 'utf8'));
    const rbFp = await fingerprint();
    expect(rbFp).toEqual(baselineFp); // byte-identical prosrc/definer/config/owner/ACL
    const snapAfterRb = await financialSnapshot();
    expect(snapAfterRb).toEqual(snapAfterFwd); // rollback deleted/rewrote NOTHING

    // ── reapply (forward order) ──
    await db.exec(readFileSync(join(repoRoot, 'supabase', 'migrations', MIGRATION), 'utf8'));
    const fwd2Fp = await fingerprint();
    expect(fwd2Fp).toEqual(fwd1Fp);
    const receiptAfterReapply = await lifecycleSmoke('reapply');

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(
      join(OUT_DIR, 'forward-rollback-fingerprint.json'),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          migration: MIGRATION,
          rollback: ROLLBACK,
          signatures: {
            redefinedByForward: REDEFINED,
            preservedAcrossChain: PRESERVED,
          },
          baselineEqualsRolledBack: true,
          forwardEqualsReapplied: true,
          aclUnchangedAcrossChain: true,
          financialRowsUntouchedByRollback: true,
          snapshotAfterForward: snapAfterFwd,
          lifecycle: {
            forwardReceipt: receiptAfterFwd,
            reappliedReceipt: receiptAfterReapply,
            immutableRequestBindingPassed: true,
            voidSingleReversalReplayPassed: true,
          },
          fingerprintBaseline: baselineFp,
        },
        null,
        2,
      )}\n`,
    );
  }, 420_000);
});
