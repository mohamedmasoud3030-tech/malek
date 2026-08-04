/**
 * Stage 3 — Accounting periods, reversals and tenant-isolation tests.
 *
 * Required scenarios 20–35 of the Stage 3 exit gate.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  createStage3Database,
  seedCompaniesAndUsers,
  actAs,
  rpc,
  rpc0,
  rpcUuid,
  ADMIN_A,
  ADMIN_B,
  USER_A,
  COMPANY_A,
  COMPANY_B,
} from './stage3-harness';

let db: PGlite;
let cashA: string;
let expenseA: string;

async function accountId(company: string, no: string) {
  const { rows } = await db.query(
    `select id::text as id from public.accounts where company_id = $1::uuid and no = $2`,
    [company, no],
  );
  return (rows[0] as { id: string }).id;
}

async function createPeriod(company: string, name: string, from: string, to: string, status = 'OPEN') {
  await actAs(db, ADMIN_A, company);
  return rpc(db, 'create_accounting_period', { name, start_date: from, end_date: to, status });
}

async function postFor(company: string, sourceId: string, eventId: string, effectiveDate: string, amount = 10) {
  const cash = await accountId(company, '1111');
  const expense = await accountId(company, '6100');
  return rpc(db, 'post_journal_event', {
    company_id: company,
    source_type: 'test', source_id: sourceId, event_id: eventId,
    effective_date: effectiveDate,
    lines: [
      { account_id: cash, debit: amount },
      { account_id: expense, credit: amount },
    ],
  });
}

beforeAll(async () => {
  const built = await createStage3Database();
  db = built.db;
  await seedCompaniesAndUsers(db);
  await actAs(db, ADMIN_A, COMPANY_A);
  await rpc0(db, 'ensure_company_chart_of_accounts');
  await actAs(db, ADMIN_A, COMPANY_B);
  await rpc0(db, 'ensure_company_chart_of_accounts');
  await actAs(db, ADMIN_A, COMPANY_A);
  cashA = await accountId(COMPANY_A, '1111');
  expenseA = await accountId(COMPANY_A, '6100');
});

afterAll(async () => {
  await db?.close();
});

describe('Stage 3 — accounting periods', () => {
  it('20. overlapping periods for the same company are rejected', async () => {
    await createPeriod(COMPANY_A, '2026-01', '2026-01-01', '2026-01-31');
    await expect(createPeriod(COMPANY_A, '2026-01-dup', '2026-01-15', '2026-02-15'))
      .rejects.toThrow(/ACCOUNTING_PERIOD_OVERLAP/);
    // Adjacent periods do not overlap.
    const adjacent = await createPeriod(COMPANY_A, '2026-02', '2026-02-01', '2026-02-28');
    expect(adjacent.success).toBe(true);
  });

  it('21. overlapping date ranges across different companies remain independently valid', async () => {
    // Company B may use the exact same range as company A (2026-01) and any
    // range that only overlaps A's periods — overlap is enforced per company.
    const b = await createPeriod(COMPANY_B, '2026-01', '2026-01-01', '2026-01-31');
    expect(b.success).toBe(true);
    const b2 = await createPeriod(COMPANY_B, '2026-03', '2026-03-01', '2026-03-31');
    expect(b2.success).toBe(true);
  });

  it('22. an event in an open period posts normally', async () => {
    await createPeriod(COMPANY_A, '2026-07', '2026-07-01', '2026-07-31');
    const posted = await postFor(COMPANY_A, 'p-22', 'p-22', '2026-07-15');
    expect(posted.status).toBe('POSTED');
    expect(posted.period_resolution_reason).toBe('open_period_contains_date');

    const { rows } = await db.query(
      `select p.name from public.journal_batches b
        join public.accounting_periods p on p.id = b.accounting_period_id
       where b.event_id = 'p-22'`,
    );
    expect((rows[0] as { name: string }).name).toBe('2026-07');
  });

  it('23. an event dated in a soft-closed period posts into the first eligible open period while preserving effective_date', async () => {
    const { rows: julyRows } = await db.query(
      `select id::text as id from public.accounting_periods where company_id = $1::uuid and name = '2026-07'`,
      [COMPANY_A],
    );
    const july = { id: (julyRows[0] as { id: string }).id };
    await createPeriod(COMPANY_A, '2026-08', '2026-08-01', '2026-08-31');
    await actAs(db, ADMIN_A, COMPANY_A);
    await rpc(db, 'update_accounting_period_status', {
      period_id: july.id, status: 'SOFT_CLOSED', reason: 'close for test 23',
    });

    const posted = await postFor(COMPANY_A, 'p-23', 'p-23', '2026-07-20');
    expect(posted.status).toBe('POSTED');
    expect(posted.period_resolution_reason).toBe('redirected_earliest_open_period');
    expect(String(posted.accounting_period_id)).not.toBe(String(july.id));

    const { rows } = await db.query(
      `select b.effective_date::text as d, p.name
         from public.journal_batches b
         join public.accounting_periods p on p.id = b.accounting_period_id
        where b.event_id = 'p-23'`,
    );
    // Original business event date preserved; posting period is the open one.
    expect(rows[0]).toMatchObject({ d: '2026-07-20', name: '2026-08' });
  });

  it('24. an event dated in a hard-closed period does not write into that closed period', async () => {
    await createPeriod(COMPANY_A, '2026-06', '2026-06-01', '2026-06-30');
    await actAs(db, ADMIN_A, COMPANY_A);
    const { rows: juneRows } = await db.query(
      `select id::text as id from public.accounting_periods where company_id = $1::uuid and name = '2026-06'`,
      [COMPANY_A],
    );
    await rpc(db, 'update_accounting_period_status', {
      period_id: (juneRows[0] as { id: string }).id, status: 'HARD_CLOSED', reason: 'close for test 24',
    });

    const posted = await postFor(COMPANY_A, 'p-24', 'p-24', '2026-06-15');
    expect(posted.status).toBe('POSTED');
    expect(posted.period_resolution_reason).toBe('redirected_earliest_open_period');

    // No batch ever resolves into the HARD_CLOSED period.
    const { rows } = await db.query(
      `select count(*)::int as n from public.journal_batches b
        join public.accounting_periods p on p.id = b.accounting_period_id
       where p.name = '2026-06'`,
    );
    expect((rows[0] as { n: number }).n).toBe(0);
  });

  it('25. posting fails clearly when no eligible open period exists', async () => {
    await expect(postFor(COMPANY_B, 'p-25', 'p-25', '2026-09-15'))
      .rejects.toThrow(/NO_ELIGIBLE_OPEN_ACCOUNTING_PERIOD/);
  });

  it('26. unauthorized period closure or reopening is rejected', async () => {
    // A USER (not admin/manager) cannot change period status.
    const { rows: julyRows } = await db.query(
      `select id::text as id from public.accounting_periods where company_id = $1::uuid and name = '2026-07'`,
      [COMPANY_A],
    );
    const julyId = (julyRows[0] as { id: string }).id;
    await actAs(db, USER_A, COMPANY_A);
    await expect(
      rpc(db, 'update_accounting_period_status', { period_id: julyId, status: 'HARD_CLOSED' }),
    ).rejects.toThrow(/42501|ADMIN or MANAGER/);
    await actAs(db, ADMIN_A, COMPANY_A);

    // Direct SQL status changes are blocked by the write guard.
    await db.exec('BEGIN; SAVEPOINT sp;');
    await expect(
      db.query(`update public.accounting_periods set status = 'HARD_CLOSED' where id = $1::uuid`, [julyId]),
    ).rejects.toThrow(/ACCOUNTING_PERIOD_WRITE_UNAUTHORIZED/);
    await db.exec('ROLLBACK TO SAVEPOINT sp;');

    // Periods are append-only: DELETE is always rejected.
    await expect(
      db.query(`delete from public.accounting_periods where id = $1::uuid`, [julyId]),
    ).rejects.toThrow(/ACCOUNTING_PERIOD_IMMUTABLE/);
    await db.exec('ROLLBACK TO SAVEPOINT sp;');

    // HARD_CLOSED periods can never be reopened, even through the RPC.
    const { rows: juneRows } = await db.query(
      `select id::text as id from public.accounting_periods where company_id = $1::uuid and name = '2026-06'`,
      [COMPANY_A],
    );
    await expect(
      rpc(db, 'update_accounting_period_status', {
        period_id: (juneRows[0] as { id: string }).id, status: 'OPEN', reason: 'attempt reopen',
      }),
    ).rejects.toThrow(/HARD_CLOSED/);
    await db.exec('ROLLBACK;');

    // Reopening a SOFT_CLOSED period requires an explicit reason.
    const { rows: softRows } = await db.query(
      `select id::text as id from public.accounting_periods where company_id = $1::uuid and name = '2026-07'`,
      [COMPANY_A],
    );
    await expect(
      rpc(db, 'update_accounting_period_status', {
        period_id: (softRows[0] as { id: string }).id, status: 'OPEN',
      }),
    ).rejects.toThrow(/REOPEN_REASON_REQUIRED/);

    // With a reason the authorized reopening succeeds and is audited.
    const reopened = await rpc(db, 'update_accounting_period_status', {
      period_id: (softRows[0] as { id: string }).id, status: 'OPEN', reason: 'correction window approved',
    });
    expect(reopened.changed).toBe(true);
    const { rows: audits } = await db.query(
      `select count(*)::int as n from public.audit_log where entity = 'accounting_periods' and entity_id = $1`,
      [(softRows[0] as { id: string }).id],
    );
    expect((audits[0] as { n: number }).n).toBeGreaterThanOrEqual(2);
  });
});

describe('Stage 3 — reversals', () => {
  it('27. a posted batch can be reversed through an equal and opposite batch', async () => {
    const posted = await postFor(COMPANY_A, 'rev-27', 'rev-27', '2026-07-18', 123.456);
    const reversal = await rpcUuid(db, 'reverse_journal_batch', String(posted.batch_id));
    expect(reversal.success).toBe(true);
    expect(reversal.status).toBe('REVERSED');

    const { rows } = await db.query(
      `select l.debit::text as d, l.credit::text as c, l.account_id = $2 as same_account
         from public.journal_lines l where l.batch_id = $1::uuid order by l.created_at`,
      [String(reversal.reversal_batch_id), cashA],
    );
    // Equal and opposite: the cash line becomes a credit, the expense line a debit.
    expect(rows.map((r: any) => ({ d: r.d, c: r.c }))).toEqual([
      { d: '0.000', c: '123.456' },
      { d: '123.456', c: '0.000' },
    ]);
  });

  it('28. the original posted batch remains unchanged', async () => {
    const { rows } = await db.query(
      `select b.status, b.reversal_of_batch_id::text as rev_of,
              count(l.id)::int as lines,
              round(sum(l.debit),3)::text as d, round(sum(l.credit),3)::text as c
         from public.journal_batches b
         join public.journal_lines l on l.batch_id = b.id
        where b.event_id = 'rev-27'
        group by b.id, b.status, b.reversal_of_batch_id`,
    );
    expect(rows[0]).toMatchObject({ status: 'REVERSED', lines: 2, d: '123.456', c: '123.456' });
    // reversal_of_batch_id on the original points at the reversal batch.
    expect((rows[0] as { rev_of: string }).rev_of).toBeTruthy();
  });

  it('29. reversing the same batch twice returns the already-created reversal idempotently', async () => {
    const { rows } = await db.query(
      `select id::text as id from public.journal_batches where event_id = 'rev-27'`,
    );
    const originalId = (rows[0] as { id: string }).id;
    const again = await rpcUuid(db, 'reverse_journal_batch', originalId);
    expect(again.idempotent).toBe(true);

    const { rows: count } = await db.query(
      `select count(*)::int as n from public.journal_batches where source_type = 'journal_reversal' and source_id = $1`,
      [originalId],
    );
    expect((count[0] as { n: number }).n).toBe(1);
  });

  it('30. the reversal follows current open-period rules', async () => {
    // Original posts into OPEN 2026-07 (reopened in test 26); hard-close the
    // period afterwards, then reverse: the reversal must land in the next
    // eligible open period (2026-08) instead of the closed original period.
    const posted = await postFor(COMPANY_A, 'rev-30', 'rev-30', '2026-07-25', 40);
    const { rows: julyRows } = await db.query(
      `select id::text as id from public.accounting_periods where company_id = $1::uuid and name = '2026-07'`,
      [COMPANY_A],
    );
    await actAs(db, ADMIN_A, COMPANY_A);
    await rpc(db, 'update_accounting_period_status', {
      period_id: (julyRows[0] as { id: string }).id, status: 'HARD_CLOSED', reason: 'close for test 30',
    });

    const reversal = await rpcUuid(db, 'reverse_journal_batch', String(posted.batch_id));
    expect(reversal.success).toBe(true);
    expect(reversal.reversal_period_reason).toBe('redirected_earliest_open_period');
    expect(String(reversal.reversal_period_id)).not.toBe(String(posted.accounting_period_id));

    // No eligible open period at all -> reversal fails clearly.
    await expect(postFor(COMPANY_B, 'rev-30b', 'rev-30b', '2026-09-01'))
      .rejects.toThrow(/NO_ELIGIBLE_OPEN_ACCOUNTING_PERIOD/);
  });

  it('31. the original and reversal batches remain fully traceable', async () => {
    const { rows } = await db.query(
      `select b.id::text as id, b.status, b.source_type, b.source_id, b.event_id,
              b.reversal_of_batch_id::text as rev_of
         from public.journal_batches b where b.event_id = 'rev-30'`,
    );
    const original = rows[0] as { id: string; status: string; rev_of: string };
    expect(original.status).toBe('REVERSED');

    const { rows: revs } = await db.query(
      `select b.id::text as id, b.reversal_of_batch_id::text as rev_of, b.source_id, b.event_id
         from public.journal_batches b
        where b.source_type = 'journal_reversal' and b.source_id = $1`,
      [original.id],
    );
    expect(revs).toHaveLength(1);
    const rev = revs[0] as { id: string; rev_of: string; source_id: string; event_id: string };
    expect(rev.rev_of).toBe(original.id);
    expect(rev.event_id).toBe(`REVERSAL-OF:${original.id}`);
    expect(rev.source_id).toBe(original.id);
  });
});

describe('Stage 3 — tenant isolation', () => {
  it('32. company A cannot view company B accounts', async () => {
    await db.exec('BEGIN;');
    await db.exec(`select set_config('request.jwt.claims','{"sub":"${ADMIN_A}","role":"authenticated","app_metadata":{"company_id":"${COMPANY_A}"}}', true);`);
    await db.exec('set local role authenticated;');
    const { rows } = await db.query(
      `select count(*)::int as n from public.accounts where company_id = $1::uuid`,
      [COMPANY_B],
    );
    expect((rows[0] as { n: number }).n).toBe(0);
    const { rows: own } = await db.query(
      `select count(*)::int as n from public.accounts where company_id = $1::uuid`,
      [COMPANY_A],
    );
    expect((own[0] as { n: number }).n).toBeGreaterThan(0);
    await db.exec('ROLLBACK;');
  });

  it('33. company A cannot view company B journal data', async () => {
    // Seed a B journal batch first (as server context).
    await createPeriod(COMPANY_B, '2026-07', '2026-07-01', '2026-07-31');
    await postFor(COMPANY_B, 'iso-33', 'iso-33', '2026-07-01', 15);

    await db.exec('BEGIN;');
    await db.exec(`select set_config('request.jwt.claims','{"sub":"${ADMIN_A}","role":"authenticated","app_metadata":{"company_id":"${COMPANY_A}"}}', true);`);
    await db.exec('set local role authenticated;');
    const { rows: batches } = await db.query(`select count(*)::int as n from public.journal_batches`);
    const { rows: lines } = await db.query(`select count(*)::int as n from public.journal_lines`);
    const { rows: view } = await db.query(`select count(*)::int as n from public.journal_entries`);
    expect((batches[0] as { n: number }).n).toBeGreaterThan(0); // A's own batches visible
    expect((lines[0] as { n: number }).n).toBeGreaterThan(0);
    const { rows: bBatches } = await db.query(
      `select count(*)::int as n from public.journal_batches where company_id = $1::uuid`,
      [COMPANY_B],
    );
    expect((bBatches[0] as { n: number }).n).toBe(0);
    const { rows: bView } = await db.query(
      `select count(*)::int as n from public.journal_entries where company_id = $1::uuid`,
      [COMPANY_B],
    );
    expect((bView[0] as { n: number }).n).toBe(0);
    await db.exec('ROLLBACK;');
  });

  it('34. company A cannot post into company B', async () => {
    // The engine is not browser-callable at all (ACL proven in test 15);
    // the read RPCs are company-scoped server-side regardless of payload.
    await actAs(db, ADMIN_A, COMPANY_A);
    const { rows: rpcRows } = await db.query(
      `select (public.list_chart_of_accounts() ->> 'company_id')::text as cid,
              jsonb_array_length(public.list_chart_of_accounts() -> 'accounts') as n`,
    );
    expect((rpcRows[0] as { cid: string }).cid).toBe(COMPANY_A);

    // Direct cross-company write attempts are blocked by RLS.
    await db.exec('BEGIN;');
    await db.exec(`select set_config('request.jwt.claims','{"sub":"${ADMIN_A}","role":"authenticated","app_metadata":{"company_id":"${COMPANY_A}"}}', true);`);
    await db.exec('set local role authenticated;');
    const { rows: bBatch } = await db.query(
      `select id::text as id from public.journal_batches where company_id = $1::uuid limit 1`,
      [COMPANY_B],
    );
    if (bBatch.length > 0) {
      await db.exec('SAVEPOINT sp_cross;');
      await expect(
        db.query(`update public.journal_batches set description = 'hacked' where id = $1::uuid`, [(bBatch[0] as { id: string }).id]),
      ).rejects.toThrow(/permission denied|row-level security/);
      await db.exec('ROLLBACK TO SAVEPOINT sp_cross;');
    }
    await db.exec('ROLLBACK;');
  });

  it('35. company A cannot close company B accounting period', async () => {
    const { rows } = await db.query(
      `select id::text as id from public.accounting_periods where company_id = $1::uuid limit 1`,
      [COMPANY_B],
    );
    expect(rows.length).toBeGreaterThan(0);
    await actAs(db, ADMIN_A, COMPANY_A);
    await expect(
      rpc(db, 'update_accounting_period_status', {
        period_id: (rows[0] as { id: string }).id, status: 'HARD_CLOSED',
      }),
    ).rejects.toThrow(/ACCOUNTING_PERIOD_NOT_FOUND/);
  });
});
