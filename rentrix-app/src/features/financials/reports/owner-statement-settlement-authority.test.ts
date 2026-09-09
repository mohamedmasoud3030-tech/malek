/**
 * Owner statement settlement authority.
 *
 * BEFORE 20260909000017, `rpt_owner_statement` built its settlement movements
 * from the LEGACY columns `owner_settlements.date` (text) and
 * `owner_settlements.amount`:
 *
 *   settlement_rows AS (
 *     SELECT s.date tx_date, ... -s.amount gross ...
 *     WHERE public._safe_date(s.date) BETWEEN p_from AND p_to
 *
 * Both are written ONCE at draft creation (`date := period_end::text`,
 * `amount := net_payable`) and are never revised by the APPROVED, PAID,
 * CANCELLED or offset paths. That produced three proven defects — the movement
 * carried gross entitlement instead of the cash that left the bank, was dated
 * to the period end instead of the payment date, and included settlements that
 * were cancelled and never paid.
 *
 * The repair moves authority to the columns the lifecycle actually maintains
 * (`status`, `paid_at`, `net_payable`) and to the same original-cash proof the
 * bank reconciliation and the owner position already use,
 * `app_private.owner_settlement_paid_cash`. The legacy pair is left untouched
 * as posted history: this suite still asserts it is intact, and separately
 * asserts the statement no longer derives anything from it.
 *
 * Cash is never computed as `net_payable - offset_applied`; the offset header
 * is mutable and a later reversal can drive it back to zero without changing
 * the payment that actually happened.
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

/** Reads the private evidence function with the elevated harness role. It is
 *  revoked from `authenticated` by design; the test satisfies that boundary
 *  instead of weakening the grant. */
async function provenCash(settlementId: string): Promise<number | null> {
  await f.db.exec('reset role');
  const cash = (await f.db.query<{ cash: string | null }>(
    'select app_private.owner_settlement_paid_cash($1,$2)::text as cash', [COMPANY, settlementId],
  )).rows[0].cash;
  await f.db.exec('set role authenticated');
  return cash === null ? null : Number(cash);
}

let paidOn = '';

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
  paidOn = (await f.db.query<{ d: string }>(
    "select to_char(paid_at,'YYYY-MM-DD') as d from public.owner_settlements where id=$1",
    [f.settlement],
  )).rows[0].d;
}, 60_000);

afterAll(async () => { await f?.db.close(); });

it('preserves the legacy date/amount pair as posted history (no backfill, no rewrite)', async () => {
  const row = (await f.db.query<{
    date: string; amount: string; net_payable: string; offset_applied: string;
    paid_at: string | null; status: string;
  }>(
    'select date, amount::text, net_payable::text, offset_applied::text, paid_at::text, status'
    + ' from public.owner_settlements where id=$1',
    [f.settlement],
  )).rows[0];

  expect(row.status).toBe('PAID');
  // The historical columns are untouched by the repair: still the original
  // entitlement, still frozen at the draft's period end.
  expect(Number(row.amount)).toBe(1000);
  expect(Number(row.net_payable)).toBe(1000);
  expect(row.date).toBe(offsetDate(28));
  // The lawful offset remains recorded only in the modern column.
  expect(Number(row.offset_applied)).toBe(25);
  expect(row.paid_at).not.toBeNull();
});

it('MONETARY: the settlement movement is the 975 cash proven by the journal, not the 1000 entitlement', async () => {
  expect(await provenCash(f.settlement)).toBe(975);

  const result = await statement(offsetDate(1), offsetDate(28));
  const settlementRows = result.transactions.filter((tx) => tx.type === 'settlement');
  expect(settlementRows).toHaveLength(1);

  // The statement now reports the cash that actually left the bank.
  expect(settlementRows[0].gross).toBe(-975);
  expect(settlementRows[0].net).toBe(-975);
  // And it is explicit about why the disbursement is below the entitlement,
  // instead of silently showing a smaller number.
  expect(settlementRows[0].details).toContain('بعد مقاصة مستحقات على المالك');
});

it('MONETARY: the movement is not derivable from net_payable minus offset_applied', async () => {
  // The header is deliberately NOT mutated here: a PAID settlement is
  // immutable historical evidence and
  // `app_private.guard_paid_owner_settlement` (migration 13) correctly rejects
  // any such update. The point is proven structurally instead.
  const row = (await f.db.query<{ net_payable: string; offset_applied: string }>(
    'select net_payable::text, offset_applied::text from public.owner_settlements where id=$1',
    [f.settlement],
  )).rows[0];

  // Today the naive derivation happens to agree with the truth...
  expect(Number(row.net_payable) - Number(row.offset_applied)).toBe(975);
  // ...but the authority is the posted journal, read independently of the
  // header. A lawful post-payment offset reversal can drive `offset_applied`
  // back to 0 while the original 975 bank outflow is unchanged, which is
  // exactly why the statement must not use the header.
  expect(await provenCash(f.settlement)).toBe(975);

  const result = await statement(offsetDate(1), offsetDate(28));
  expect(result.transactions.find((tx) => tx.type === 'settlement')?.gross).toBe(-975);
});

it('TEMPORAL: the movement is dated to the actual payment date and found by a window covering it', async () => {
  const result = await statement(offsetDate(1), offsetDate(28));
  const row = result.transactions.find((tx) => tx.type === 'settlement');
  expect(row?.date).toBe(paidOn);
  expect(row?.date).not.toBe(offsetDate(28));

  // A one-day window on the true payment date now finds it.
  const narrow = await statement(paidOn, paidOn);
  expect(narrow.transactions.filter((tx) => tx.type === 'settlement')).toHaveLength(1);
  expect(narrow.transactions.find((tx) => tx.type === 'settlement')?.gross).toBe(-975);
});

it('TEMPORAL: a period that ends before the payment does not show the disbursement', async () => {
  const dayBefore = (await f.db.query<{ d: string }>(
    "select to_char($1::date - 1,'YYYY-MM-DD') as d", [paidOn],
  )).rows[0].d;
  const before = await statement(offsetDate(1), dayBefore);
  expect(before.transactions.filter((tx) => tx.type === 'settlement')).toHaveLength(0);
});

it('LIFECYCLE: a CANCELLED settlement is not presented as a deduction', async () => {
  await f.db.exec('begin;reset role');
  try {
    // Satisfies owner_settlements_cancellation_state_check (cancelled_at,
    // cancelled_by and a reason are all mandatory) and the net_payable
    // identity check.
    await f.db.query(
      "insert into public.owner_settlements(id,company_id,owner_id,status,date,amount,no,gross_collected,office_fee,owner_expenses,tax_amount,net_payable,cancelled_at,cancelled_by,cancellation_reason)"
      + " values('stmt-cancelled',$1,$2,'CANCELLED',$3,500,'OST-CANCELLED',500,0,0,0,500,now(),$4,'withdrawn')",
      [COMPANY, OWNER, offsetDate(10), CHECKER],
    );
    await f.db.exec('set local role authenticated');
    const result = await statement(offsetDate(1), offsetDate(28));
    // No entitlement was settled and no cash moved, so there is no movement.
    expect(result.transactions.filter((tx) => tx.details.includes('OST-CANCELLED'))).toHaveLength(0);
  } finally {
    await f.db.exec('rollback');
  }
});

it('LIFECYCLE: DRAFT and APPROVED settlements are not presented as disbursements', async () => {
  await f.db.exec('begin;reset role');
  try {
    await f.db.query(
      "insert into public.owner_settlements(id,company_id,owner_id,status,date,amount,no,gross_collected,office_fee,owner_expenses,tax_amount,net_payable,approved_at,approved_by)"
      + " values('stmt-draft',$1,$2,'DRAFT',$3,300,'OST-DRAFT',300,0,0,0,300,null,null),"
      + "        ('stmt-approved',$1,$2,'APPROVED',$3,400,'OST-APPROVED',400,0,0,0,400,now(),$4)",
      [COMPANY, OWNER, offsetDate(10), CHECKER],
    );
    await f.db.exec('set local role authenticated');
    const result = await statement(offsetDate(1), offsetDate(28));
    expect(result.transactions.filter((tx) => tx.details.includes('OST-DRAFT'))).toHaveLength(0);
    expect(result.transactions.filter((tx) => tx.details.includes('OST-APPROVED'))).toHaveLength(0);
  } finally {
    await f.db.exec('rollback');
  }
});

it('EVIDENCE: a PAID settlement with unprovable cash is surfaced as unconfirmed, never zeroed or dropped', async () => {
  await f.db.exec('begin;reset role');
  try {
    // A legacy import: PAID with a payment timestamp but no journal batch and
    // no persisted zero-cash acknowledgement, so its original cash is unknown.
    await f.db.query(
      "insert into public.owner_settlements(id,company_id,owner_id,status,date,amount,no,gross_collected,office_fee,owner_expenses,tax_amount,net_payable,approved_at,approved_by,paid_at,paid_by,method)"
      + " values('stmt-legacy-unknown',$1,$2,'PAID',$3,120,'OST-LEGACY',120,0,0,0,120,now(),$5,$4::date + time '10:00',$5,'cash')",
      [COMPANY, OWNER, offsetDate(12), offsetDate(12), CHECKER],
    );
    await f.db.exec('set local role authenticated');

    const result = await statement(offsetDate(1), offsetDate(28));
    const legacy = result.transactions.filter((tx) => tx.details.includes('OST-LEGACY'));
    // Missing evidence must not become a silent zero and must not vanish.
    expect(legacy).toHaveLength(1);
    expect(legacy[0].gross).toBe(-120);
    expect(legacy[0].date).toBe(offsetDate(12));
    expect(legacy[0].details).toContain('صرف غير مثبت بالمستندات');
  } finally {
    await f.db.exec('rollback');
  }
});
