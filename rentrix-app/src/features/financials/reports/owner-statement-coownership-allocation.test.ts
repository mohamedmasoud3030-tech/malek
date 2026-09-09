/**
 * Co-owned property expense allocation in owner reporting — source diagnosis.
 *
 * `property_owners` is a genuine many-to-many with an `ownership_percentage`
 * (DOM: "share/primary-owner rules must be explicit and company-consistent").
 * Co-ownership is a first-class, governed, UI-exposed feature:
 * `20260901000069_atomic_property_ownership_payload.sql` accepts an explicit
 * ownership payload, requires the shares to total EXACTLY 100, rejects
 * duplicate owners, and requires exactly one primary.
 *
 * The legacy owner-expense selectors, however, test ownership with a bare
 * EXISTS against `property_owners` and never read `ownership_percentage`:
 *
 *   AND EXISTS (SELECT 1 FROM public.property_owners po
 *               WHERE po.property_id = e.property_id AND po.owner_id = $1 ...)
 *
 * So for a property owned 60/40, a single 100 OWNER expense is charged in FULL
 * to BOTH owners — 200 of owner-charged expense reported against 100 of actual
 * cost. `ownership_percentage` is never used to apportion money anywhere in
 * the migration chain (verified by search).
 *
 * SCOPE AND SEVERITY, established by execution rather than assumed:
 *
 *  - The MONEY path is already fail-closed. `create_owner_settlement_draft_atomic`
 *    refuses a co-owned legacy expense with
 *    OWNER_SETTLEMENT_LEGACY_EXPENSE_REVIEW_REQUIRED (migration 12), so no
 *    settlement can silently pay a double-counted deduction. The governed
 *    adoption path (`owner_allocation_version = 1`) requires an explicit
 *    per-owner allocation totalling the expense exactly, and adopted sources
 *    are excluded from these legacy selectors.
 *  - The REPORTING path is NOT protected. `rpt_owner_statement` and
 *    `calculate_owner_net_payout` still present the full amount to each
 *    co-owner.
 *
 * This suite pins CURRENT REALITY so the defect is evidenced, and asserts the
 * money-path guard genuinely holds. The reporting repair requires an approved
 * apportionment rule: whether a legacy un-allocated expense on a co-owned
 * property should be split by `ownership_percentage`, or refused as
 * unallocated. That is an accounting decision, not a code guess, so it is NOT
 * silently invented here — see RECONSTRUCTION_INVENTORY.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createOwnerOffsetFixture, offsetDate } from '@/test/owner-offset-fixture';
import { COMPANY, MAKER, OWNER } from '@/test/office-creditor-fixture';
import { assumeIdentity } from '@/p1/replay-bootstrap';

let f: Awaited<ReturnType<typeof createOwnerOffsetFixture>>;
let property = '';

const OWNER2 = 'c2000000-0000-4000-8000-0000000000e1';
const SHARED_EXPENSE = 'c2000000-0000-4000-8000-0000000000e9';
const SHARED_MARKER = 'SHARED EXPENSE';
const SHARED_AMOUNT = 100;

type StatementTx = { type: string; gross: number; details: string };
type Statement = { transactions: StatementTx[]; total_gross: number };

async function statement(ownerId: string): Promise<Statement> {
  return (await f.db.query<{ d: Statement }>(
    'select public.rpt_owner_statement($1,$2::date,$3::date) as d',
    [ownerId, offsetDate(1), offsetDate(28)],
  )).rows[0].d;
}

beforeAll(async () => {
  f = await createOwnerOffsetFixture();
  await f.db.exec('reset role');
  property = (await f.db.query<{ id: string }>(
    'select property_id::text as id from public.property_owners where owner_id=$1 and company_id=$2 limit 1',
    [OWNER, COMPANY],
  )).rows[0].id;

  // Split the property 60/40 between two owners in the same company.
  await f.db.query("insert into public.owners(id,full_name,name,company_id) values($1,'Co Owner','Co Owner',$2)", [OWNER2, COMPANY]);
  await f.db.query('update public.property_owners set ownership_percentage=60 where property_id=$1 and owner_id=$2', [property, OWNER]);
  await f.db.query(
    'insert into public.property_owners(property_id,owner_id,company_id,ownership_percentage,is_primary,starts_on)'
    + ' values($1,$2,$3,40,false,$4::date)',
    [property, OWNER2, COMPANY, offsetDate(1)],
  );

  // One legacy (un-adopted) owner-charged expense of 100 on the shared property.
  await f.db.query(
    'insert into public.expenses(id,company_id,property_id,category,description,amount,status,charged_to,date_time,expense_date)'
    + " values($1,$2,$3,'maintenance',$4,$5,'POSTED','OWNER',$6::text,$7::date)",
    [SHARED_EXPENSE, COMPANY, property, SHARED_MARKER, SHARED_AMOUNT, offsetDate(6), offsetDate(6)],
  );
  await f.db.exec('set role authenticated');
}, 60_000);

afterAll(async () => { await f?.db.close(); });

it('the fixture really is a 60/40 co-owned property with one un-adopted expense', async () => {
  await f.db.exec('reset role');
  const shares = (await f.db.query<{ owner_id: string; pct: string }>(
    'select owner_id::text, ownership_percentage::text as pct from public.property_owners where property_id=$1 order by ownership_percentage desc',
    [property],
  )).rows;
  const expense = (await f.db.query<{ amount: string; version: number | null }>(
    'select amount::text, owner_allocation_version as version from public.expenses where id=$1',
    [SHARED_EXPENSE],
  )).rows[0];
  await f.db.exec('set role authenticated');

  expect(shares.map((s) => Number(s.pct))).toEqual([60, 40]);
  expect(shares.reduce((t, s) => t + Number(s.pct), 0)).toBe(100);
  expect(Number(expense.amount)).toBe(SHARED_AMOUNT);
  // Legacy source: NOT adopted into the owner-receivable subledger.
  expect(expense.version).toBeNull();
});

it('DEFECT (reporting): the full expense is charged to BOTH co-owners, double counting it', async () => {
  const first = await statement(OWNER);
  const second = await statement(OWNER2);

  const firstRows = first.transactions.filter((tx) => tx.details.includes(SHARED_MARKER));
  const secondRows = second.transactions.filter((tx) => tx.details.includes(SHARED_MARKER));

  expect(firstRows).toHaveLength(1);
  expect(secondRows).toHaveLength(1);

  // Neither is apportioned by the 60/40 share: each carries the whole cost.
  expect(firstRows[0].gross).toBe(-SHARED_AMOUNT);
  expect(secondRows[0].gross).toBe(-SHARED_AMOUNT);

  // 200 reported against 100 actually incurred.
  const reported = Math.abs(firstRows[0].gross) + Math.abs(secondRows[0].gross);
  expect(reported).toBe(2 * SHARED_AMOUNT);
});

it('DEFECT (derivation): calculate_owner_net_payout charges the full expense to each co-owner', async () => {
  const read = async (ownerId: string) => (await f.db.query<{ v: string }>(
    'select (public.calculate_owner_net_payout($1::uuid,$2::date,$3::date,null)).owner_expenses::text as v',
    [ownerId, offsetDate(1), offsetDate(28)],
  )).rows[0].v;

  expect(Number(await read(OWNER))).toBe(SHARED_AMOUNT);
  expect(Number(await read(OWNER2))).toBe(SHARED_AMOUNT);
});

it('PRESERVED: the money path stays fail-closed for an un-allocated co-owned expense', async () => {
  // The reporting defect must not be mistaken for a payable one. Migration 12
  // refuses to build a settlement over un-reviewed legacy owner expenses, so
  // no double-counted deduction can reach a payout.
  await assumeIdentity(f.db, MAKER, COMPANY);
  await expect(f.db.query(
    'select public.create_owner_settlement_draft_atomic($1::jsonb)',
    [JSON.stringify({
      owner_id: OWNER2, property_id: property,
      period_start: offsetDate(1), period_end: offsetDate(28),
      request_id: 'c2000000-0000-4000-8000-0000000000b2',
    })],
  )).rejects.toThrow(/OWNER_SETTLEMENT_LEGACY_EXPENSE_REVIEW_REQUIRED/);

  // And nothing reserved the shared expense.
  await f.db.exec('reset role');
  const links = (await f.db.query(
    'select 1 from public.owner_settlement_expense_links where expense_id=$1 and released_at is null',
    [SHARED_EXPENSE],
  )).rows;
  await f.db.exec('set role authenticated');
  expect(links).toHaveLength(0);
});

it('PRESERVED: ownership_percentage is never used to apportion money in any authority', async () => {
  // Documents the gap structurally: the ownership share exists and is
  // validated to total 100, but no financial selector reads it. If a future
  // apportionment rule is approved, this assertion is the one that must change.
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
