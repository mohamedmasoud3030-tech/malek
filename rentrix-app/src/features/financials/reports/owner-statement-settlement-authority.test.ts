/**
 * Owner statement settlement authority — source diagnosis.
 *
 * `rpt_owner_statement` builds its settlement movements from the LEGACY
 * columns `owner_settlements.date` (text) and `owner_settlements.amount`:
 *
 *   settlement_rows AS (
 *     SELECT s.date tx_date, ... -s.amount gross ...
 *     WHERE public._safe_date(s.date) BETWEEN p_from AND p_to
 *
 * Both columns are written ONCE at draft creation (`date := period_end::text`,
 * `amount := net_payable`) and are never revised afterwards. The governed
 * payment path instead records `paid_at`, applies `offset_applied`, and posts
 * the real cash journal.
 *
 * Consequences this suite pins down against real SQL, before any repair:
 *   1. TEMPORAL — the movement is dated to the period end, not to the date the
 *      money actually moved. A statement covering the true payment date can
 *      omit a settlement that was genuinely paid inside it.
 *   2. MONETARY — the movement carries gross entitlement, not the cash that
 *      left the bank. When part of the entitlement was discharged by a lawful
 *      offset, the statement overstates the outflow.
 *   3. LIFECYCLE — a CANCELLED settlement keeps its legacy `amount`, so it can
 *      still appear as a deduction it never caused.
 *
 * These assertions describe CURRENT REALITY so the defect is evidenced rather
 * than asserted. They are updated in the same commit as the repair.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createOwnerOffsetFixture, offsetFixtureCommand, offsetDate } from '@/test/owner-offset-fixture';
import { COMPANY, OWNER } from '@/test/office-creditor-fixture';
import { assumeIdentity } from '@/p1/replay-bootstrap';

let f: Awaited<ReturnType<typeof createOwnerOffsetFixture>>;
const CHECKER = 'c2000000-0000-4000-8000-000000000099';

type StatementTx = {
  date: string;
  type: string;
  gross: number;
  deduction: number;
  net: number;
  details: string;
};

type Statement = {
  transactions: StatementTx[];
  total_gross: number;
  total_deductions: number;
  total_net: number;
};

async function statement(from: string, to: string): Promise<Statement> {
  return (await f.db.query<{ data: Statement }>(
    'select public.rpt_owner_statement($1,$2::date,$3::date) as data',
    [OWNER, from, to],
  )).rows[0].data;
}

beforeAll(async () => {
  f = await createOwnerOffsetFixture();
  // Lawful offset of 25 against a 1000 entitlement, then a governed payout.
  // Real cash out of the bank is therefore 975, not 1000.
  await offsetFixtureCommand(f.db, 'offset_owner_receivable_atomic', {
    due_from_owner_id: f.receivable, owner_settlement_id: f.settlement, amount: 25,
    effective_date: offsetDate(2), lawful_offset_evidence: 'Contractual offset',
    request_id: 'statement-offset',
  });
  await assumeIdentity(f.db, CHECKER, COMPANY);
  await offsetFixtureCommand(f.db, 'pay_owner_settlement_atomic', {
    settlement_id: f.settlement, method: 'bank_transfer',
    payment_reference: 'Statement cash evidence', request_id: 'statement-pay',
  });
}, 60_000);

afterAll(async () => { await f?.db.close(); });

it('records the legacy date/amount pair that the statement still reads', async () => {
  const row = (await f.db.query<{
    date: string; amount: string; net_payable: string; offset_applied: string;
    paid_at: string | null; status: string;
  }>(
    'select date, amount::text, net_payable::text, offset_applied::text, paid_at::text, status'
    + ' from public.owner_settlements where id=$1',
    [f.settlement],
  )).rows[0];

  expect(row.status).toBe('PAID');
  // Legacy economic columns still hold the ORIGINAL entitlement.
  expect(Number(row.amount)).toBe(1000);
  expect(Number(row.net_payable)).toBe(1000);
  // The lawful offset is recorded only in the modern column.
  expect(Number(row.offset_applied)).toBe(25);
  // The payment timestamp exists, but `date` was frozen at draft creation.
  expect(row.paid_at).not.toBeNull();
  expect(row.date).toBe(offsetDate(28));
});

it('DEFECT (monetary): the settlement movement shows entitlement, not the 975 cash actually paid', async () => {
  const result = await statement(offsetDate(1), offsetDate(28));
  const settlementRows = result.transactions.filter((tx) => tx.type === 'settlement');
  expect(settlementRows).toHaveLength(1);

  // Proven cash for this settlement, from the migration-15 evidence reader.
  // That reader is private (revoked from authenticated by design), so read it
  // with the elevated harness role rather than weakening its grants.
  await f.db.exec('reset role');
  const provenCash = (await f.db.query<{ cash: string | null }>(
    'select app_private.owner_settlement_paid_cash($1,$2)::text as cash', [COMPANY, f.settlement],
  )).rows[0].cash;
  await f.db.exec('set role authenticated');
  expect(Number(provenCash)).toBe(975);

  // Current behaviour: the statement reports the full 1000 entitlement as the
  // outflow, overstating the cash that left the bank by exactly the offset.
  expect(settlementRows[0].gross).toBe(-1000);
  expect(Math.abs(settlementRows[0].gross)).not.toBe(Number(provenCash));
});

it('DEFECT (temporal): the movement is dated to period end, not to the actual payment date', async () => {
  const paidOn = (await f.db.query<{ d: string }>(
    "select to_char(paid_at,'YYYY-MM-DD') as d from public.owner_settlements where id=$1",
    [f.settlement],
  )).rows[0].d;

  const result = await statement(offsetDate(1), offsetDate(28));
  const row = result.transactions.find((tx) => tx.type === 'settlement');
  expect(row?.date).toBe(offsetDate(28));

  // A window that genuinely contains the payment date but ends before the
  // frozen legacy `date` loses the movement entirely.
  const narrow = await statement(paidOn, paidOn);
  expect(narrow.transactions.filter((tx) => tx.type === 'settlement')).toHaveLength(0);
});

it('DEFECT (lifecycle): a CANCELLED settlement still carries a legacy amount that the statement would report', async () => {
  await f.db.exec('begin;reset role');
  try {
    // Satisfies owner_settlements_cancellation_state_check (cancelled_at,
    // cancelled_by and a reason are all mandatory) and the net_payable
    // identity check. Only the legacy `amount`/`date` pair is the subject.
    await f.db.query(
      "insert into public.owner_settlements(id,company_id,owner_id,status,date,amount,no,gross_collected,office_fee,owner_expenses,tax_amount,net_payable,cancelled_at,cancelled_by,cancellation_reason)"
      + " values('stmt-cancelled',$1,$2,'CANCELLED',$3,500,'OST-CANCELLED',500,0,0,0,500,now(),$4,'withdrawn')",
      [COMPANY, OWNER, offsetDate(10), CHECKER],
    );
    await f.db.exec('set local role authenticated');
    const result = await statement(offsetDate(1), offsetDate(28));
    const cancelled = result.transactions.filter((tx) => tx.details.includes('OST-CANCELLED'));
    // Current behaviour: a cancelled settlement is presented as a real -500
    // movement even though no entitlement was settled and no cash moved.
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].gross).toBe(-500);
  } finally {
    await f.db.exec('rollback');
  }
});
