/**
 * Phase 3A-1C — owner-settlement canonical-account and immutable-request
 * execution proof. All writes run only in an ephemeral PGlite database.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase, repoRoot } from '../p1/replay-bootstrap';
import {
  ADMIN_A,
  ADMIN_B,
  COMPANY_A,
  COMPANY_B,
  OWNER_A,
  OWNER_B,
  PROPERTY_A,
  PROPERTY_B,
  queryOne,
  rpcJsonb,
  seedPhase3a1cFixture,
} from './phase3a1c-fixture';

const OUT_DIR = join(repoRoot, 'evidence', 'p3', 'phase3a1c');
const evidence: Record<string, unknown> = {};
let db: PGlite;

const request = (n: number) => `31c00000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function counts(settlementId: string) {
  return queryOne(
    db,
    `select
       (select count(*)::int from public.owner_settlements where id::text = $1) as settlements,
       (select count(*)::int from public.journal_entries where entity_type = 'owner_settlement_payment' and entity_id = $1) as journals,
       (select count(*)::int from public.audit_log where entity = 'owner_settlements' and entity_id = $1) as audits`,
    [settlementId],
  );
}

async function createSettlement(
  company: 'A' | 'B',
  period: string,
  requestId: string,
  notes?: string,
) {
  const a = company === 'A';
  await assumeIdentity(db, a ? ADMIN_A : ADMIN_B, a ? COMPANY_A : COMPANY_B);
  return rpcJsonb(db, 'create_owner_settlement_draft_atomic', {
    request_id: requestId,
    owner_id: a ? OWNER_A : OWNER_B,
    property_id: a ? PROPERTY_A : PROPERTY_B,
    period_start: `${period}-01`,
    period_end: `${period}-${period === '2026-02' ? '28' : '30'}`,
    ...(notes ? { notes } : {}),
  });
}

describe('Phase 3A-1C owner-settlement execution', () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;
    await seedPhase3a1cFixture(db);
  }, 420_000);

  afterAll(async () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const generatedAt = new Date().toISOString();
    for (const [name, value] of Object.entries(evidence)) {
      writeFileSync(join(OUT_DIR, `${name}.json`), `${JSON.stringify({ generatedAt, ...value as object }, null, 2)}\n`);
    }
    await db?.close();
  });

  it('binds create/approve/pay/cancel request IDs and replays without side effects', async () => {
    const created = await createSettlement('A', '2026-07', request(1), '  immutable  ');
    const sid = String(created.settlement_id);
    const replay = await createSettlement('A', '2026-07', request(1), 'immutable');
    expect(replay.settlement_id).toBe(sid);
    expect(replay.idempotent).toBe(true);
    expect((await counts(sid))!.settlements).toBe(1);
    const normalized = await queryOne(
      db,
      `select notes from public.owner_settlements where id::text = $1`,
      [sid],
    );
    expect(normalized!.notes).toBe('immutable');

    await expect(createSettlement('A', '2026-06', request(1), 'immutable')).rejects.toThrow(
      /IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST/,
    );
    await expect(createSettlement('A', '2026-07', request(1), 'changed')).rejects.toThrow(
      /IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST/,
    );

    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const approved = await rpcJsonb(db, 'approve_owner_settlement_atomic', {
      settlement_id: sid, request_id: request(2),
    });
    const approvedReplay = await rpcJsonb(db, 'approve_owner_settlement_atomic', {
      settlement_id: sid, request_id: request(2),
    });
    expect(approved.status).toBe('APPROVED');
    expect(approvedReplay.idempotent).toBe(true);

    const other = await createSettlement('A', '2026-06', request(3));
    await expect(
      rpcJsonb(db, 'approve_owner_settlement_atomic', {
        settlement_id: other.settlement_id, request_id: request(2),
      }),
    ).rejects.toThrow(/IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST/);

    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const paid = await rpcJsonb(db, 'pay_owner_settlement_atomic', {
      settlement_id: sid,
      request_id: request(4),
      method: 'bank_transfer',
      payment_reference: 'P3A1C-001',
    });
    const paidReplay = await rpcJsonb(db, 'pay_owner_settlement_atomic', {
      settlement_id: sid,
      request_id: request(4),
      method: 'bank_transfer',
      payment_reference: 'P3A1C-001',
    });
    expect(paid.status).toBe('PAID');
    expect(paidReplay.journal_batch_id).toBe(paid.journal_batch_id);
    expect(paidReplay.idempotent).toBe(true);
    await expect(
      rpcJsonb(db, 'pay_owner_settlement_atomic', {
        settlement_id: sid,
        request_id: request(4),
        method: 'cash',
        payment_reference: 'P3A1C-CHANGED',
      }),
    ).rejects.toThrow(/IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST/);

    const paidCounts = await counts(sid);
    expect(paidCounts!.journals).toBe(2);
    expect(paidCounts!.audits).toBe(3);
    const journal = await db.query(
      `select je.type, je.amount::numeric as amount, a.no, a.company_id::text as account_company
         from public.journal_entries je
         join public.accounts a on a.id = je.account_id
        where je.entity_type = 'owner_settlement_payment' and je.entity_id = $1
        order by je.type`,
      [sid],
    );
    expect(journal.rows.map((row: any) => row.no).sort()).toEqual(['1111', '2000']);
    expect(journal.rows.every((row: any) => row.account_company === COMPANY_A)).toBe(true);
    expect(Number((journal.rows[0] as any).amount)).toBe(Number((journal.rows[1] as any).amount));

    const cancelled = await rpcJsonb(db, 'cancel_owner_settlement_atomic', {
      settlement_id: other.settlement_id, request_id: request(5), reason: 'duplicate period correction',
    });
    const cancelledReplay = await rpcJsonb(db, 'cancel_owner_settlement_atomic', {
      settlement_id: other.settlement_id, request_id: request(5), reason: 'duplicate period correction',
    });
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelledReplay.idempotent).toBe(true);
    await expect(
      rpcJsonb(db, 'cancel_owner_settlement_atomic', {
        settlement_id: other.settlement_id, request_id: request(5), reason: 'changed reason',
      }),
    ).rejects.toThrow(/IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST/);

    evidence['idempotency-isolation'] = {
      rule: 'request_id identifies one immutable logical financial request inside one company',
      createReplay: true,
      differentTargetRejected: true,
      changedPayloadRejected: true,
      approveReplay: true,
      payReplay: true,
      cancelReplay: true,
      journalRowsAfterReplay: paidCounts!.journals,
      auditRowsAfterReplay: paidCounts!.audits,
    };
    evidence['owner-settlement-lifecycle'] = {
      settlementId: sid,
      status: paid.status,
      netPayable: paid.net_payable,
      journalBatchId: paid.journal_batch_id,
      journalLines: journal.rows,
      balanced: true,
      exactJournalRows: paidCounts!.journals,
    };
  }, 120_000);

  it('rejects cross-company targets and missing accounts without partial writes', async () => {
    // request(1) already belongs to company A. The idempotency lookup never
    // replays A's response, but the legacy globally-unique settlement request
    // column fails loudly until its schema is made company-relative.
    await expect(createSettlement('B', '2026-07', request(1))).rejects.toThrow(
      /owner_settlements_request_id_uidx|duplicate key/,
    );
    const noCrossReplay = await queryOne(
      db,
      `select count(*)::int as n from public.owner_settlements
        where company_id = $1::uuid and request_id = $2::uuid`,
      [COMPANY_B, request(1)],
    );
    expect(noCrossReplay!.n).toBe(0);

    const bDraft = await createSettlement('B', '2026-07', request(10));
    const bSid = String(bDraft.settlement_id);
    await assumeIdentity(db, ADMIN_B, COMPANY_B);
    await rpcJsonb(db, 'approve_owner_settlement_atomic', {
      settlement_id: bSid, request_id: request(11),
    });

    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    await expect(
      rpcJsonb(db, 'pay_owner_settlement_atomic', {
        settlement_id: bSid, request_id: request(12), method: 'cash',
      }),
    ).rejects.toThrow(/not found/i);

    await assumeIdentity(db, ADMIN_B, COMPANY_B);
    await expect(
      rpcJsonb(db, 'pay_owner_settlement_atomic', {
        settlement_id: bSid, request_id: request(12), method: 'cash',
      }),
    ).rejects.toThrow(/2000 is not configured for company/);
    const state = await queryOne(
      db,
      `select status,
              (select count(*)::int from public.journal_entries where entity_type = 'owner_settlement_payment' and entity_id = $1) as journals,
              (select count(*)::int from public.financial_operation_idempotency
                where operation_name = 'pay_owner_settlement_atomic:' || $2::text and request_id = $3) as cache_rows
         from public.owner_settlements where id::text = $1`,
      [bSid, COMPANY_B, request(12)],
    );
    expect(state).toMatchObject({ status: 'APPROVED', journals: 0, cache_rows: 0 });

    evidence['two-company-isolation'] = {
      sameRawRequestIdCrossCompanyReplay: false,
      legacyGlobalSettlementRequestUniqueCollision: 'fails loudly',
      crossCompanyTarget: 'not found',
      missingCanonicalAccount: '2000 is not configured for company',
      settlementStatusAfterFailures: state!.status,
      journalRowsAfterFailures: state!.journals,
      idempotencyRowsAfterFailures: state!.cache_rows,
    };
  }, 90_000);

  it('uses each company canonical 2000/1111 rows even when account numbers repeat', async () => {
    await db.exec(`
      alter table public.accounts drop constraint accounts_no_key;
      insert into public.accounts (id, no, name, company_id) values
        ('p3a1c-b-2000', '2000', 'Owner Payables B', '${COMPANY_B}'),
        ('p3a1c-b-1111', '1111', 'Cash B', '${COMPANY_B}');
    `);
    await assumeIdentity(db, ADMIN_B, COMPANY_B);
    const b = await queryOne(
      db,
      `select id::text from public.owner_settlements
        where company_id = $1::uuid and status = 'APPROVED' order by created_at limit 1`,
      [COMPANY_B],
    );
    const paid = await rpcJsonb(db, 'pay_owner_settlement_atomic', {
      settlement_id: b!.id, request_id: request(13), method: 'cash',
    });
    const rows = await db.query(
      `select a.no, a.id, a.company_id::text as company_id
         from public.journal_entries je join public.accounts a on a.id = je.account_id
        where je.entity_type = 'owner_settlement_payment' and je.entity_id = $1 order by a.no`,
      [b!.id],
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.every((row: any) => row.company_id === COMPANY_B)).toBe(true);
    expect(rows.rows.map((row: any) => row.no)).toEqual(['1111', '2000']);
    evidence['canonical-account-resolution'] = {
      settlementId: b!.id,
      status: paid.status,
      duplicateAccountNumbersAcrossCompanies: true,
      selectedAccounts: rows.rows,
      selectedOnlyCurrentCompany: true,
    };
  }, 60_000);

  it('fails closed for unverified cache and rolls back journals when UPDATE row count is zero', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    await db.query(
      `insert into public.financial_operation_idempotency(operation_name, request_id, response_payload)
       values ($1, $2, '{"success":true}'::jsonb)`,
      [`create_owner_settlement_draft_atomic:${COMPANY_A}`, request(20)],
    );
    await expect(createSettlement('A', '2026-05', request(20))).rejects.toThrow(
      /IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED/,
    );

    const rowCountDraft = await createSettlement('A', '2026-04', request(21));
    const rowCountSid = String(rowCountDraft.settlement_id);
    await rpcJsonb(db, 'approve_owner_settlement_atomic', {
      settlement_id: rowCountSid, request_id: request(22),
    });
    await db.exec(`
      create function pg_temp.suppress_p3a1c_update() returns trigger
      language plpgsql as $$ begin return null; end $$;
      create trigger p3a1c_suppress_update
      before update on public.owner_settlements
      for each row when (old.id::text = '${rowCountSid}')
      execute function pg_temp.suppress_p3a1c_update();
    `);
    await expect(
      rpcJsonb(db, 'pay_owner_settlement_atomic', {
        settlement_id: rowCountSid, request_id: request(23), method: 'cash',
      }),
    ).rejects.toThrow(/OWNER_SETTLEMENT_UPDATE_COUNT_MISMATCH/);
    await db.exec('drop trigger p3a1c_suppress_update on public.owner_settlements;');
    const after = await queryOne(
      db,
      `select status,
          (select count(*)::int from public.journal_entries where entity_type = 'owner_settlement_payment' and entity_id = $1) as journals,
          (select count(*)::int from public.audit_log where entity = 'owner_settlements' and entity_id = $1 and action = 'PAY') as pay_audits,
          (select count(*)::int from public.financial_operation_idempotency
            where operation_name = 'pay_owner_settlement_atomic:' || $2::text and request_id = $3) as cache_rows
       from public.owner_settlements where id::text = $1`,
      [rowCountSid, COMPANY_A, request(23)],
    );
    expect(after).toMatchObject({ status: 'APPROVED', journals: 0, pay_audits: 0, cache_rows: 0 });
    evidence['atomic-row-count'] = {
      assertion: 'OWNER_SETTLEMENT_UPDATE_COUNT_MISMATCH',
      statusAfterFailure: after!.status,
      journalRowsAfterFailure: after!.journals,
      payAuditRowsAfterFailure: after!.pay_audits,
      cacheRowsAfterFailure: after!.cache_rows,
      transactionRolledBack: true,
    };
  }, 90_000);
});
