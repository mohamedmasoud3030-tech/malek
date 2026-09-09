/**
 * Co-owned property expense allocation in owner reporting.
 *
 * `property_owners` is a genuine many-to-many with an `ownership_percentage`.
 * Co-ownership is a first-class, governed, UI-exposed feature:
 * `20260901000069_atomic_property_ownership_payload.sql` accepts an explicit
 * ownership payload, requires shares totalling EXACTLY 100, rejects duplicate
 * owners and requires exactly one primary.
 *
 * BEFORE 20260909000018 the legacy owner-expense selectors tested ownership
 * with a bare EXISTS against `property_owners` and never read the share, so on
 * a 60/40 property a single 100 OWNER expense was charged in FULL to BOTH
 * owners — 200 reported against 100 actually incurred.
 *
 * APPROVED RESOLUTION (Option 2): an unallocated historical co-owned expense
 * stays UNALLOCATED. It is not apportioned by the current ownership share,
 * because `ownership_percentage` is a present-tense attribute with validity
 * dates and using it to split a historical cost would derive historical
 * ownership from today's state. It attaches to nobody until the governed
 * adoption workflow supplies the authoritative per-owner allocation.
 *
 * The suppressed cost is never silently dropped: it surfaces through
 * `public.owner_unallocated_shared_expenses` as outstanding governed-adoption
 * work.
 *
 * Ownership is evaluated AS OF THE EXPENSE DATE, so historical cutoffs hold in
 * both directions — see the cutoff tests below.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createOwnerOffsetFixture, offsetDate } from '@/test/owner-offset-fixture';
import { COMPANY, MAKER, OWNER } from '@/test/office-creditor-fixture';
import { assumeIdentity } from '@/p1/replay-bootstrap';

let f: Awaited<ReturnType<typeof createOwnerOffsetFixture>>;
let property = '';

const OWNER2 = 'c2000000-0000-4000-8000-0000000000e1';
const SHARED_EXPENSE = 'c2000000-0000-4000-8000-0000000000e9';
const SOLE_EXPENSE = 'c2000000-0000-4000-8000-0000000000ea';
const SHARED_MARKER = 'SHARED EXPENSE';
const SOLE_MARKER = 'SOLE ERA EXPENSE';
const SHARED_AMOUNT = 100;
const SOLE_AMOUNT = 70;

/** Day 1..4 the property has ONE owner; co-ownership starts on day 5. */
const COOWNERSHIP_STARTS = offsetDate(5);
const SOLE_ERA_DATE = offsetDate(3);
const SHARED_ERA_DATE = offsetDate(6);

type StatementTx = { type: string; gross: number; details: string };
type Statement = { transactions: StatementTx[]; total_gross: number };

async function statement(ownerId: string): Promise<Statement> {
  return (await f.db.query<{ d: Statement }>(
    'select public.rpt_owner_statement($1,$2::date,$3::date) as d',
    [ownerId, offsetDate(1), offsetDate(28)],
  )).rows[0].d;
}

async function derivedExpenses(ownerId: string): Promise<number> {
  return Number((await f.db.query<{ v: string }>(
    'select (public.calculate_owner_net_payout($1::uuid,$2::date,$3::date,null)).owner_expenses::text as v',
    [ownerId, offsetDate(1), offsetDate(28)],
  )).rows[0].v);
}

function rows(s: Statement, marker: string) {
  return s.transactions.filter((tx) => tx.details.includes(marker));
}

beforeAll(async () => {
  f = await createOwnerOffsetFixture();
  await f.db.exec('reset role');
  property = (await f.db.query<{ id: string }>(
    'select property_id::text as id from public.property_owners where owner_id=$1 and company_id=$2 limit 1',
    [OWNER, COMPANY],
  )).rows[0].id;

  // The property becomes co-owned 60/40 only from COOWNERSHIP_STARTS onwards.
  await f.db.query("insert into public.owners(id,full_name,name,company_id) values($1,'Co Owner','Co Owner',$2)", [OWNER2, COMPANY]);
  await f.db.query('update public.property_owners set ownership_percentage=60 where property_id=$1 and owner_id=$2', [property, OWNER]);
  await f.db.query(
    'insert into public.property_owners(property_id,owner_id,company_id,ownership_percentage,is_primary,starts_on)'
    + ' values($1,$2,$3,40,false,$4::date)',
    [property, OWNER2, COMPANY, COOWNERSHIP_STARTS],
  );

  // One legacy expense in the CO-OWNED era, one in the SOLE-OWNER era.
  await f.db.query(
    'insert into public.expenses(id,company_id,property_id,category,description,amount,status,charged_to,date_time,expense_date)'
    + " values($1,$2,$3,'maintenance',$4,$5,'POSTED','OWNER',$6::text,$7::date)",
    [SHARED_EXPENSE, COMPANY, property, SHARED_MARKER, SHARED_AMOUNT, SHARED_ERA_DATE, SHARED_ERA_DATE],
  );
  await f.db.query(
    'insert into public.expenses(id,company_id,property_id,category,description,amount,status,charged_to,date_time,expense_date)'
    + " values($1,$2,$3,'maintenance',$4,$5,'POSTED','OWNER',$6::text,$7::date)",
    [SOLE_EXPENSE, COMPANY, property, SOLE_MARKER, SOLE_AMOUNT, SOLE_ERA_DATE, SOLE_ERA_DATE],
  );
  await f.db.exec('set role authenticated');
}, 60_000);

afterAll(async () => { await f?.db.close(); });

it('the fixture is a 60/40 co-ownership starting mid-period, with two un-adopted expenses', async () => {
  await f.db.exec('reset role');
  const shares = (await f.db.query<{ pct: string; starts_on: string | null }>(
    'select ownership_percentage::text as pct, starts_on::text from public.property_owners where property_id=$1 order by ownership_percentage desc',
    [property],
  )).rows;
  const expenses = (await f.db.query<{ id: string; version: number | null }>(
    'select id::text, owner_allocation_version as version from public.expenses where id in ($1,$2) order by amount desc',
    [SHARED_EXPENSE, SOLE_EXPENSE],
  )).rows;
  await f.db.exec('set role authenticated');

  expect(shares.map((s) => Number(s.pct))).toEqual([60, 40]);
  expect(shares.reduce((t, s) => t + Number(s.pct), 0)).toBe(100);
  // Both are legacy sources, NOT adopted into the owner-receivable subledger.
  expect(expenses.every((e) => e.version === null)).toBe(true);
});

it('60/40: the co-owned expense is charged to NEITHER owner and is not apportioned', async () => {
  const first = await statement(OWNER);
  const second = await statement(OWNER2);

  // Not 100 to each (the old double count) and not 60/40 (an invented rule).
  expect(rows(first, SHARED_MARKER)).toHaveLength(0);
  expect(rows(second, SHARED_MARKER)).toHaveLength(0);

  // The derivation authority agrees: the 60% owner sees only the sole-era cost.
  expect(await derivedExpenses(OWNER)).toBe(SOLE_AMOUNT);
  expect(await derivedExpenses(OWNER2)).toBe(0);
});

it('HISTORICAL CUTOFF: an expense from the sole-owner era still belongs to that owner', async () => {
  // The property is co-owned TODAY, but was solely owned when this cost was
  // incurred. Ownership is evaluated at the expense date, so the cost is not
  // retroactively orphaned by a later ownership change.
  const first = await statement(OWNER);
  const soleRows = rows(first, SOLE_MARKER);
  expect(soleRows).toHaveLength(1);
  expect(soleRows[0].gross).toBe(-SOLE_AMOUNT);

  // And it never leaks to the owner who only joined later.
  expect(rows(await statement(OWNER2), SOLE_MARKER)).toHaveLength(0);
});

it('HISTORICAL CUTOFF: a co-owner who leaves does not absorb costs incurred after departure', async () => {
  await f.db.exec('begin;reset role');
  try {
    // OWNER2 leaves the day before the shared expense, making OWNER the sole
    // owner again on that date. The previously unallocated cost now resolves
    // to the single historical owner — evaluated at the event date, not today.
    await f.db.query(
      'update public.property_owners set ends_on=$3::date where property_id=$1 and owner_id=$2',
      [property, OWNER2, offsetDate(5)],
    );
    await f.db.exec('set local role authenticated');

    const first = await statement(OWNER);
    const second = await statement(OWNER2);
    expect(rows(first, SHARED_MARKER)).toHaveLength(1);
    expect(rows(first, SHARED_MARKER)[0].gross).toBe(-SHARED_AMOUNT);
    expect(rows(second, SHARED_MARKER)).toHaveLength(0);
  } finally {
    await f.db.exec('rollback');
  }
});

it('no double counting: the shared cost is reported once in total, or not at all', async () => {
  const reported = [OWNER, OWNER2]
    .map(async (o) => rows(await statement(o), SHARED_MARKER).reduce((t, r) => t + Math.abs(r.gross), 0));
  const totals = await Promise.all(reported);
  const sum = totals.reduce((t, v) => t + v, 0);
  // Previously 200 against a 100 cost. Now 0 — pending governed adoption.
  expect(sum).toBe(0);
  expect(sum).toBeLessThanOrEqual(SHARED_AMOUNT);
});

it('VISIBILITY: the suppressed cost is surfaced as outstanding governed-adoption work', async () => {
  const out = (await f.db.query<{ d: any }>(
    'select public.owner_unallocated_shared_expenses($1::date,$2::date,null) as d',
    [offsetDate(1), offsetDate(28)],
  )).rows[0].d;

  expect(Number(out.count)).toBe(1);
  expect(Number(out.total_amount)).toBe(SHARED_AMOUNT);
  const entry = out.expenses[0];
  expect(entry.description).toContain(SHARED_MARKER);
  expect(Number(entry.amount)).toBe(SHARED_AMOUNT);
  expect(Number(entry.owners_at_expense_date)).toBe(2);
  expect(entry.resolution).toBe('GOVERNED_ADOPTION_REQUIRED');
  // The sole-era expense is attributable, so it is NOT outstanding work.
  expect(JSON.stringify(out.expenses)).not.toContain(SOLE_MARKER);
});

it('VISIBILITY: the surface is permission-checked and company-scoped', async () => {
  await f.db.exec('begin');
  try {
    await f.db.query("select set_config('request.jwt.claims','{}',true)");
    await expect(
      f.db.query('select public.owner_unallocated_shared_expenses(null,null,null)'),
    ).rejects.toThrow();
  } finally {
    await f.db.exec('rollback');
  }
});

it('PRESERVED: the money path stays fail-closed for a sole-owner legacy expense', async () => {
  // The co-ownership change must not weaken the existing guard: a genuinely
  // attributable, un-reviewed legacy expense still blocks a new settlement.
  // The fixture already holds an active settlement over the main period, and
  // that distinct rule would mask the guard, so assert on a clean later
  // period carrying only a fresh sole-era expense.
  await f.db.exec('reset role');
  // Dates are computed in SQL: offsetDate only formats a day of the current
  // month and cannot express a later period.
  const later = (await f.db.query<{ d1: string; d2: string; d3: string; d4: string }>(
    "select to_char($1::date + 40,'YYYY-MM-DD') as d1, to_char($1::date + 30,'YYYY-MM-DD') as d2,"
    + " to_char($1::date + 35,'YYYY-MM-DD') as d3, to_char($1::date + 45,'YYYY-MM-DD') as d4",
    [offsetDate(1)],
  )).rows[0];

  await f.db.query(
    'insert into public.expenses(id,company_id,property_id,category,description,amount,status,charged_to,date_time,expense_date)'
    + " values($1,$2,$3,'maintenance','LATER SOLE EXPENSE',15,'POSTED','OWNER',$4::text,$5::date)",
    ['c2000000-0000-4000-8000-0000000000eb', COMPANY, property, later.d1, later.d1],
  );
  // Sole ownership again before that expense.
  await f.db.query(
    'update public.property_owners set ends_on=$3::date where property_id=$1 and owner_id=$2',
    [property, OWNER2, later.d2],
  );
  await f.db.exec('set role authenticated');

  await assumeIdentity(f.db, MAKER, COMPANY);
  await expect(f.db.query(
    'select public.create_owner_settlement_draft_atomic($1::jsonb)',
    [JSON.stringify({
      owner_id: OWNER, property_id: property,
      period_start: later.d3, period_end: later.d4,
      request_id: 'c2000000-0000-4000-8000-0000000000b3',
    })],
  )).rejects.toThrow(/OWNER_SETTLEMENT_LEGACY_EXPENSE_REVIEW_REQUIRED/);
});

it('PRESERVED: no expense row was modified, and posted history is intact', async () => {
  await f.db.exec('reset role');
  const rowsOut = (await f.db.query<{ id: string; amount: string; version: number | null; deleted: string | null }>(
    'select id::text, amount::text, owner_allocation_version as version, deleted_at::text as deleted'
    + ' from public.expenses where id in ($1,$2)',
    [SHARED_EXPENSE, SOLE_EXPENSE],
  )).rows;
  await f.db.exec('set role authenticated');

  // The repair is a read-path change only: nothing was backfilled, allocated
  // or soft-deleted to make the numbers work.
  const byId = new Map(rowsOut.map((r) => [r.id, r]));
  expect(Number(byId.get(SHARED_EXPENSE)?.amount)).toBe(SHARED_AMOUNT);
  expect(Number(byId.get(SOLE_EXPENSE)?.amount)).toBe(SOLE_AMOUNT);
  expect(rowsOut.every((r) => r.version === null)).toBe(true);
  expect(rowsOut.every((r) => r.deleted === null)).toBe(true);
});

it('PRESERVED: ownership_percentage is still never used to apportion money', async () => {
  await f.db.exec('reset role');
  const users = (await f.db.query<{ n: string }>(
    `select count(*)::text as n from (
       select pg_get_functiondef(p.oid) as def
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public','app_private')
          and p.prokind = 'f'
     ) d
     where d.def like '%ownership_percentage%'
       and d.def ~ '(amount|gross|net)[^;]*ownership_percentage'`,
  )).rows[0].n;
  await f.db.exec('set role authenticated');
  expect(Number(users)).toBe(0);
});
