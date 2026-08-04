/**
 * Stage 3 — Posting engine, journal validation, idempotency, precision and
 * legacy compatibility tests.
 *
 * Required scenarios 7–19 and 36–38 of the Stage 3 exit gate, plus the legacy
 * journal_entries backfill and compatibility-path proofs.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  createStage3Database,
  createStage3DatabaseWithLegacyBackfill,
  seedCompaniesAndUsers,
  actAs,
  rpc,
  rpc0,
  rpcUuid,
  ADMIN_A,
  ADMIN_B,
  COMPANY_A,
  COMPANY_B,
} from './stage3-harness';

let db: PGlite;
let cashA: string;
let expenseA: string;
let cashB: string;
let expenseB: string;

async function accountIds() {
  const byNo: Record<string, string> = {};
  for (const company of [COMPANY_A, COMPANY_B]) {
    const { rows } = await db.query(
      `select id::text as id, no from public.accounts
        where company_id = $1::uuid and no in ('1111','6100')`,
      [company],
    );
    for (const r of rows as { id: string; no: string }[]) byNo[`${company}:${r.no}`] = r.id;
  }
  return byNo;
}

async function post(lines: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
  return rpc(db, 'post_journal_event', {
    company_id: COMPANY_A,
    source_type: 'test',
    source_id: extra.source_id ?? 'evt',
    event_id: extra.event_id ?? 'evt',
    effective_date: extra.effective_date ?? '2026-07-10',
    lines,
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

  await rpc(db, 'create_accounting_period', {
    name: '2026-07', start_date: '2026-07-01', end_date: '2026-07-31',
  });
  await rpc(db, 'create_accounting_period', {
    name: '2026-08', start_date: '2026-08-01', end_date: '2026-08-31',
  });

  const ids = await accountIds();
  cashA = ids[`${COMPANY_A}:1111`];
  expenseA = ids[`${COMPANY_A}:6100`];
  cashB = ids[`${COMPANY_B}:1111`];
  expenseB = ids[`${COMPANY_B}:6100`];
});

afterAll(async () => {
  await db?.close();
});

describe('Stage 3 — journal validation and posting engine', () => {
  it('7. a balanced batch posts successfully', async () => {
    const result = await post([
      { account_id: cashA, debit: 500 },
      { account_id: expenseA, credit: 500 },
    ], { source_id: 'ok-1', event_id: 'ok-1' });
    expect(result.status).toBe('POSTED');
    expect(result.success).toBe(true);
    expect(result.idempotent).toBe(false);
    expect(result.posted_at).toBeTruthy();
    expect(result.accounting_period_id).toBeTruthy();
    expect(Number(result.debits)).toBe(500);
    expect(Number(result.credits)).toBe(500);

    // posted_at is the actual posting timestamp; effective_date untouched.
    const { rows } = await db.query(
      `select status, posted_at is not null as has_ts, effective_date = date '2026-07-10' as keeps_date
         from public.journal_batches where id = $1::uuid`,
      [String(result.batch_id)],
    );
    expect(rows[0]).toMatchObject({ status: 'POSTED', has_ts: true, keeps_date: true });
  });

  it('8. an unbalanced batch is rejected', async () => {
    await expect(
      post([
        { account_id: cashA, debit: 100 },
        { account_id: expenseA, credit: 99.999 },
      ], { source_id: 'unbal-1', event_id: 'unbal-1' }),
    ).rejects.toThrow(/JOURNAL_BATCH_UNBALANCED/);
  });

  it('9. an empty batch is rejected', async () => {
    await expect(
      post([], { source_id: 'empty-1', event_id: 'empty-1' }),
    ).rejects.toThrow(/JOURNAL_BATCH_EMPTY/);
  });

  it('10. a line containing both debit and credit is rejected', async () => {
    await expect(
      post([
        { account_id: cashA, debit: 10, credit: 10 },
      ], { source_id: 'both-1', event_id: 'both-1' }),
    ).rejects.toThrow(/JOURNAL_LINE_SIDE_INVALID/);
  });

  it('11. a zero-value line is rejected', async () => {
    await expect(
      post([
        { account_id: cashA, debit: 0 },
        { account_id: expenseA, credit: 0 },
      ], { source_id: 'zero-1', event_id: 'zero-1' }),
    ).rejects.toThrow(/JOURNAL_LINE_SIDE_INVALID/);
  });

  it('12. a negative amount is rejected', async () => {
    await expect(
      post([
        { account_id: cashA, debit: -5 },
        { account_id: expenseA, credit: 5 },
      ], { source_id: 'neg-1', event_id: 'neg-1' }),
    ).rejects.toThrow(/JOURNAL_LINE_NEGATIVE_INVALID/);
  });

  it('13. cross-company accounts cannot be used in one batch', async () => {
    await expect(
      post([
        { account_id: cashA, debit: 10 },
        { account_id: expenseB, credit: 10 },
      ], { source_id: 'cross-1', event_id: 'cross-1' }),
    ).rejects.toThrow(/JOURNAL_LINE_ACCOUNT_SCOPE/);
  });

  it('14. posted batches and lines cannot be mutated or deleted', async () => {
    const result = await post([
      { account_id: cashA, debit: 33 },
      { account_id: expenseA, credit: 33 },
    ], { source_id: 'imm-1', event_id: 'imm-1' });
    const batchId = String(result.batch_id);

    await db.exec('BEGIN; SAVEPOINT sp;');
    await expect(db.query(`update public.journal_batches set status = 'DRAFT' where id = $1::uuid`, [batchId]))
      .rejects.toThrow(/JOURNAL_BATCH_LIFECYCLE/);
    await db.exec('ROLLBACK TO SAVEPOINT sp;');
    await expect(db.query(`delete from public.journal_batches where id = $1::uuid`, [batchId]))
      .rejects.toThrow(/JOURNAL_BATCH_IMMUTABLE/);
    await db.exec('ROLLBACK TO SAVEPOINT sp;');
    await expect(db.query(`update public.journal_lines set debit = 999 where batch_id = $1::uuid`, [batchId]))
      .rejects.toThrow(/JOURNAL_LINE_IMMUTABLE/);
    await db.exec('ROLLBACK TO SAVEPOINT sp;');
    await expect(db.query(`delete from public.journal_lines where batch_id = $1::uuid`, [batchId]))
      .rejects.toThrow(/JOURNAL_LINE_IMMUTABLE/);
    await db.exec('ROLLBACK TO SAVEPOINT sp; ROLLBACK;');
  });

  it('15. unauthorized frontend-level writes are rejected', async () => {
    await db.exec('BEGIN;');
    await db.exec(`select set_config('request.jwt.claims','{"sub":"${ADMIN_A}","role":"authenticated","app_metadata":{"company_id":"${COMPANY_A}"}}', true);`);
    await db.exec('set local role authenticated;');

    // Browser roles have NO write grants on the canonical ledger tables at all
    // (permission denied precedes RLS), and RLS would reject them anyway.
    const DENIED = /permission denied|row-level security/;
    const attempts: Array<[string, string[]]> = [
      [`insert into public.journal_batches (company_id, status, source_type, source_id, event_id, effective_date) values ($1::uuid, 'POSTED', 'x','y','z', date '2026-07-01')`, [COMPANY_A]],
      [`insert into public.journal_lines (id, batch_id, company_id, account_id, debit) values ('bw-1', '00000000-0000-0000-0000-000000000000', $1::uuid, $2, 5)`, [COMPANY_A, cashA]],
      [`update public.accounting_periods set status = 'HARD_CLOSED' where company_id = $1::uuid`, [COMPANY_A]],
    ];
    for (const [sql, params] of attempts) {
      await db.exec('SAVEPOINT sp_bw;');
      await expect(db.query(sql, params)).rejects.toThrow(DENIED);
      await db.exec('ROLLBACK TO SAVEPOINT sp_bw;');
    }
    // The compatibility view carries an INSTEAD OF trigger that rejects any
    // non-server writer outright.
    await db.exec('SAVEPOINT sp_bw;');
    await expect(
      db.query(`insert into public.journal_entries (id, no, date, account_id, amount, type, company_id) values ('bw-2','B','2026-07-01',$1,5,'DEBIT',$2::uuid)`, [cashA, COMPANY_A]),
    ).rejects.toThrow(/JOURNAL_ENTRIES_BROWSER_WRITE_BLOCKED|permission denied/);
    await db.exec('ROLLBACK TO SAVEPOINT sp_bw;');
    await db.exec('ROLLBACK;');

    // Engine RPCs are not executable by browser roles.
    const { rows: acl } = await db.query(`
      select
        has_function_privilege('authenticated', 'public.gl_create_journal_batch(jsonb)', 'EXECUTE') as create_batch,
        has_function_privilege('authenticated', 'public.gl_post_journal_batch(uuid)', 'EXECUTE') as post_batch,
        has_function_privilege('authenticated', 'public.post_journal_event(jsonb)', 'EXECUTE') as post_event,
        has_function_privilege('authenticated', 'public.reverse_journal_batch(uuid)', 'EXECUTE') as reverse_batch,
        has_function_privilege('service_role', 'public.post_journal_event(jsonb)', 'EXECUTE') as post_event_service
    `);
    expect(acl[0]).toMatchObject({
      create_batch: false, post_batch: false, post_event: false, reverse_batch: false, post_event_service: true,
    });
  });

  it('16. retrying the same event returns the same posted batch', async () => {
    const lines = [
      { account_id: cashA, debit: 12.345 },
      { account_id: expenseA, credit: 12.345 },
    ];
    const first = await post(lines, { source_id: 'retry-1', event_id: 'retry-1' });
    const second = await post(lines, { source_id: 'retry-1', event_id: 'retry-1' });
    expect(second.idempotent).toBe(true);
    expect(second.batch_id).toBe(first.batch_id);
    expect(second.status).toBe('POSTED');
  });

  it('17. repeated identical calls create only one batch (database-enforced)', async () => {
    const lines = [
      { account_id: cashA, debit: 7 },
      { account_id: expenseA, credit: 7 },
    ];
    const results = [];
    for (let i = 0; i < 8; i += 1) {
      results.push(await post(lines, { source_id: 'conc-1', event_id: 'conc-1' }));
    }
    const batchIds = new Set(results.map((r) => String(r.batch_id)));
    expect(batchIds.size).toBe(1);

    const { rows } = await db.query(
      `select count(*)::int as n from public.journal_batches where source_id = 'conc-1'`
    );
    expect((rows[0] as { n: number }).n).toBe(1);

    // The idempotency key is enforced by the database, not only application code.
    const { rows: cons } = await db.query(
      `select conname from pg_constraint where conname = 'journal_batches_event_uidx'`
    );
    expect(cons).toHaveLength(1);
  });

  it('18. reusing an event identity with different amounts fails', async () => {
    await post([
      { account_id: cashA, debit: 20 },
      { account_id: expenseA, credit: 20 },
    ], { source_id: 'conf-1', event_id: 'conf-1' });

    await expect(
      post([
        { account_id: cashA, debit: 999 },
        { account_id: expenseA, credit: 999 },
      ], { source_id: 'conf-1', event_id: 'conf-1' }),
    ).rejects.toThrow(/GL_EVENT_CONFLICT/);
  });

  it('19. the same external event identifier can be used by another company without collision', async () => {
    const aResult = await rpc(db, 'post_journal_event', {
      company_id: COMPANY_A,
      source_type: 'test', source_id: 'shared-evt', event_id: 'shared-evt',
      effective_date: '2026-07-12',
      lines: [
        { account_id: cashA, debit: 66 },
        { account_id: expenseA, credit: 66 },
      ],
    });
    expect(aResult.status).toBe('POSTED');

    await actAs(db, ADMIN_A, COMPANY_B);
    await rpc(db, 'create_accounting_period', {
      name: '2026-07-b', start_date: '2026-07-01', end_date: '2026-07-31',
    });
    const bResult = await rpc(db, 'post_journal_event', {
      company_id: COMPANY_B,
      source_type: 'test', source_id: 'shared-evt', event_id: 'shared-evt',
      effective_date: '2026-07-12',
      lines: [
        { account_id: cashB, debit: 88 },
        { account_id: expenseB, credit: 88 },
      ],
    });
    expect(bResult.status).toBe('POSTED');
    await actAs(db, ADMIN_A, COMPANY_A);

    const { rows } = await db.query(
      `select company_id::text as c, count(*)::int as n from public.journal_batches
        where source_id = 'shared-evt' group by company_id order by c`
    );
    expect(rows).toHaveLength(2);
    expect((rows[0] as { n: number }).n).toBe(1);
    expect((rows[1] as { n: number }).n).toBe(1);
  });

  it('36. precision: 0.001, 1.005 and multi-line sums round exactly', async () => {
    // 0.001 edges
    const tiny = await post([
      { account_id: cashA, debit: 0.001 },
      { account_id: expenseA, credit: 0.001 },
    ], { source_id: 'prec-1', event_id: 'prec-1' });
    expect(Number(tiny.debits)).toBe(0.001);

    // 1.005 stored and summed exactly at three decimals
    const mid = await post([
      { account_id: cashA, debit: 1.005 },
      { account_id: expenseA, credit: 1.005 },
    ], { source_id: 'prec-2', event_id: 'prec-2' });
    expect(Number(mid.debits)).toBe(1.005);

    // Multi-line sums that expose rounding errors: 0.334 + 0.333 = 0.667
    const multi = await post([
      { account_id: cashA, debit: 0.334 },
      { account_id: cashA, debit: 0.333 },
      { account_id: expenseA, credit: 0.667 },
    ], { source_id: 'prec-3', event_id: 'prec-3' });
    expect(Number(multi.debits)).toBe(0.667);
    expect(Number(multi.credits)).toBe(0.667);

    // Normalization: values are rounded once server-side to 0.001 before the
    // balance comparison; 1.0004 and 1.0 are both 1.000 after rounding.
    const norm = await post([
      { account_id: cashA, debit: 1.0004 },
      { account_id: expenseA, credit: 1.0 },
    ], { source_id: 'prec-4', event_id: 'prec-4' });
    expect(Number(norm.debits)).toBe(1);

    // And a value that rounds differently on one side only is rejected:
    // debit 0.0015 rounds to 0.002 while credit 0.0014 rounds to 0.001.
    await expect(
      post([
        { account_id: cashA, debit: 0.0015 },
        { account_id: expenseA, credit: 0.0014 },
      ], { source_id: 'prec-5', event_id: 'prec-5' }),
    ).rejects.toThrow(/JOURNAL_BATCH_UNBALANCED/);
  });

  it('37. no floating-point drift can produce a false balanced or unbalanced result', async () => {
    // Exact numeric storage: a classic binary-drift sum (0.1 + 0.2) must be
    // exactly 0.3 in the ledger.
    const drift = await post([
      { account_id: cashA, debit: 0.1 },
      { account_id: cashA, debit: 0.2 },
      { account_id: expenseA, credit: 0.3 },
    ], { source_id: 'drift-1', event_id: 'drift-1' });
    expect(Number(drift.debits)).toBe(0.3);

    const { rows } = await db.query(
      `select sum(debit)::text as d, sum(credit)::text as c
         from public.journal_lines where batch_id = $1::uuid`,
      [String(drift.batch_id)],
    );
    // numeric(18,3) exact decimal comparison — no epsilon needed.
    expect((rows[0] as { d: string }).d).toBe((rows[0] as { c: string }).c);
    expect((rows[0] as { d: string }).d).toBe('0.300');
  });

  it('38. database, RPC and TypeScript representations preserve the monetary contract', async () => {
    const { rows } = await db.query(
      `select data_type, numeric_precision, numeric_scale
         from information_schema.columns
        where table_schema = 'public' and table_name = 'journal_lines' and column_name = 'debit'`
    );
    expect(rows[0]).toMatchObject({ data_type: 'numeric', numeric_scale: 3 });

    // RPC outputs carry exact three-decimal values.
    const result = await post([
      { account_id: cashA, debit: 123.456 },
      { account_id: expenseA, credit: 123.456 },
    ], { source_id: 'ts-1', event_id: 'ts-1' });
    expect(String(result.debits)).toBe('123.456');

    // The view (legacy contract) maps debit/credit back to amount/type exactly.
    const { rows: viewRows } = await db.query(
      `select amount::text as amount, type from public.journal_entries where batch_id = $1::uuid order by type`,
      [String(result.batch_id)],
    );
    expect(viewRows.map((r: any) => ({ amount: r.amount, type: r.type }))).toEqual([
      { amount: '123.456', type: 'CREDIT' },
      { amount: '123.456', type: 'DEBIT' },
    ]);
  });
});

describe('Stage 3 — legacy ledger consolidation', () => {
  it('backfills legacy journal_entries into canonical batches/lines and freezes the archive', async () => {
    const built = await createStage3DatabaseWithLegacyBackfill();
    const legacyDb = built.db;

    const { rows: batches } = await legacyDb.query(
      `select status, count(*)::int as n from public.journal_batches group by status order by status`
    );
    const byStatus = Object.fromEntries((batches as any[]).map((r) => [r.status, r.n]));
    // lg-0001/0002 pair (balanced), lg-0003/0004 pair (balanced) -> POSTED;
    // lg-0005 (draft) and lg-0006 (untraced single) -> DRAFT (never invented balances).
    expect(byStatus.POSTED).toBe(2);
    expect(byStatus.DRAFT).toBe(2);

    const { rows: lines } = await legacyDb.query(`select count(*)::int as n from public.journal_lines`);
    const { rows: viewRows } = await legacyDb.query(`select count(*)::int as n from public.journal_entries`);
    const { rows: archiveRows } = await legacyDb.query(`select count(*)::int as n from public.journal_entries_archive`);
    expect((lines[0] as { n: number }).n).toBe(6);
    expect((viewRows[0] as { n: number }).n).toBe(6);
    expect((archiveRows[0] as { n: number }).n).toBe(6);

    // The archive is frozen.
    await legacyDb.exec('BEGIN; SAVEPOINT sp;');
    await expect(
      legacyDb.query(`insert into public.journal_entries_archive (id, no, date, account_id, amount, type, company_id) values ('x','X','2026-07-01','1111',1,'DEBIT',$1::uuid)`, [COMPANY_A]),
    ).rejects.toThrow(/JOURNAL_ENTRIES_ARCHIVE_FROZEN/);
    await legacyDb.exec('ROLLBACK TO SAVEPOINT sp; ROLLBACK;');

    // Legacy compatibility inserts still land in canonical batches.
    await legacyDb.exec(`
      insert into public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, company_id)
      values
        ('lg-0007', 'L-5-D', '2026-07-05', '1111', 60, 'DEBIT', 'src-5', 'expense', 'exp-5', '${COMPANY_A}'),
        ('lg-0008', 'L-5-C', '2026-07-05', '6100', 60, 'CREDIT', 'src-5', 'expense', 'exp-5', '${COMPANY_A}');
    `);
    const { rows: after } = await legacyDb.query(
      `select count(*)::int as n from public.journal_batches b where b.source_type = 'expense' and b.source_id = 'src-5'`
    );
    expect((after[0] as { n: number }).n).toBe(1);

    // Reversal of a legacy-compat batch: equal and opposite, traceable.
    // The legacy database has no accounting periods yet; reversal must follow
    // the open-period rules, so an OPEN period must exist for the reversal to
    // resolve into (this also proves the reversal resolves server-side).
    await legacyDb.query(
      `insert into public.accounting_periods (company_id, name, start_date, end_date, status)
       values ($1::uuid, '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN')`,
      [COMPANY_A],
    );

    const { rows: src5 } = await legacyDb.query(
      `select b.id::text as id from public.journal_batches b
        where b.source_id = 'src-5' and b.status = 'POSTED' order by b.created_at desc limit 1`
    );
    expect(src5).toHaveLength(1);
    const batchId = (src5[0] as { id: string }).id;

    const reversed = await rpcUuid(legacyDb, 'reverse_journal_batch', batchId);
    expect(reversed.success).toBe(true);

    const { rows: revRows } = await legacyDb.query(
      `select b.status, b.reversal_of_batch_id::text as rev_of,
              round(sum(l.debit),3)::text as d, round(sum(l.credit),3)::text as c
         from public.journal_batches b
         join public.journal_lines l on l.batch_id = b.id
        where b.id = $1::uuid group by b.id, b.status, b.reversal_of_batch_id`,
      [String(reversed.reversal_batch_id)],
    );
    expect(revRows[0]).toMatchObject({ status: 'POSTED', rev_of: batchId, d: '60.000', c: '60.000' });

    const { rows: origRows } = await legacyDb.query(
      `select status from public.journal_batches where id = $1::uuid`,
      [batchId],
    );
    expect((origRows[0] as { status: string }).status).toBe('REVERSED');

    // The legacy view still exposes every line after the reversal (report RPCs
    // keep reading the historical shape).
    const { rows: viewAfter } = await legacyDb.query(
      `select count(*)::int as n from public.journal_entries`
    );
    expect((viewAfter[0] as { n: number }).n).toBe(10); // 6 backfilled + 2 compat lines + 2 reversal lines

    await legacyDb.close();
  }, 300_000);

  it('legacy business RPCs still post through the compatibility view into canonical batches', async () => {
    const { rows: props } = await db.query(
      `insert into public.properties (id, title, name, type, address, company_id)
       values ('a3000000-0000-4000-8000-000000000099', 'P1', 'P1', 'residential', 'Muscat', $1::uuid)
       returning id::text as id`,
      [COMPANY_A],
    );
    const propertyId = (props[0] as { id: string }).id;
    await actAs(db, ADMIN_A, COMPANY_A);

    const created = await rpc(db, 'create_expense_with_journal_atomic', {
      request_id: 'stage3-legacy-expense',
      property_id: propertyId,
      category: 'maintenance',
      amount: 99.75,
      expense_date: '2026-07-08',
      description: 'Stage 3 legacy compat',
    });
    expect(created.success).toBe(true);

    const { rows } = await db.query(
      `select b.status, b.source_id, count(l.id)::int as lines,
              round(sum(l.debit),3)::text as d, round(sum(l.credit),3)::text as c
         from public.journal_batches b
         join public.journal_lines l on l.batch_id = b.id
        where b.source_id = $1
        group by b.id, b.status, b.source_id`,
      [String(created.expense_id)],
    );
    expect(rows[0]).toMatchObject({ status: 'POSTED', lines: 2, d: '99.750', c: '99.750' });

    // The view exposes the legacy shape for report RPCs.
    const { rows: viewRows } = await db.query(
      `select count(*)::int as n, bool_and(type in ('DEBIT','CREDIT')) as ok
         from public.journal_entries where entity_type = 'expense' and entity_id = $1`,
      [String(created.expense_id)],
    );
    expect(viewRows[0]).toMatchObject({ n: 2, ok: true });
  });
});
