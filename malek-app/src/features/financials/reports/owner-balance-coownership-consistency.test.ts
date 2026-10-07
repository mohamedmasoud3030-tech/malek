/**
 * Owner balance consistency with the co-ownership allocation authority.
 *
 * `public.owner_balances` is a PERSISTED table maintained by
 * `public.recalculate_owner_balance`. Migration18 moved the statement, the
 * settlement derivation and the reservation selector onto the shared
 * `public.owner_is_sole_property_owner_on` predicate, but missed this one, so
 * the stored balance still charged an unallocated co-owned expense in full to
 * every co-owner while every other owner surface had stopped doing so.
 *
 * That is the most damaging shape of the bug: a persisted figure that
 * disagrees with the statement it is supposed to reconcile to, and that
 * outlives the request. 20260909000019 closes it with the same predicate and
 * the same date semantics.
 *
 * This suite proves the four owner-facing surfaces now agree, that the
 * historical cutoff is honoured by the balance path too, and that the
 * COMPANY-level 1300 control total is deliberately unchanged.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createOwnerOffsetFixture, offsetDate } from '@/test/owner-offset-fixture';
import { COMPANY, OWNER } from '@/test/office-creditor-fixture';

let f: Awaited<ReturnType<typeof createOwnerOffsetFixture>>;
let property = '';

const OWNER2 = 'c2000000-0000-4000-8000-0000000000e1';
const SHARED_EXPENSE = 'c2000000-0000-4000-8000-0000000000e9';
const SOLE_EXPENSE = 'c2000000-0000-4000-8000-0000000000ea';
const SHARED_AMOUNT = 100;
const SOLE_AMOUNT = 70;

/** Co-ownership begins on day 5; day 3 is still the sole-owner era. */
const COOWNERSHIP_STARTS = offsetDate(5);
const SOLE_ERA_DATE = offsetDate(3);
const SHARED_ERA_DATE = offsetDate(6);

async function balanceExpenses(ownerId: string): Promise<number> {
  await f.db.exec('reset role');
  await f.db.query('select public.recalculate_owner_balance($1::uuid)', [ownerId]);
  const row = (await f.db.query<{ v: string | null }>(
    'select total_expenses::text as v from public.owner_balances where owner_id=$1', [ownerId],
  )).rows[0];
  await f.db.exec('set role authenticated');
  return Number(row?.v ?? 0);
}

async function statementExpenses(ownerId: string): Promise<number> {
  const s = (await f.db.query<{ d: { transactions: Array<{ type: string; gross: number }> } }>(
    'select public.rpt_owner_statement($1,$2::date,$3::date) as d',
    [ownerId, offsetDate(1), offsetDate(28)],
  )).rows[0].d;
  return s.transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.gross), 0);
}

async function derivedExpenses(ownerId: string): Promise<number> {
  return Number((await f.db.query<{ v: string }>(
    'select (public.calculate_owner_net_payout($1::uuid,$2::date,$3::date,null)).owner_expenses::text as v',
    [ownerId, offsetDate(1), offsetDate(28)],
  )).rows[0].v);
}

beforeAll(async () => {
  f = await createOwnerOffsetFixture();
  await f.db.exec('reset role');
  property = (await f.db.query<{ id: string }>(
    'select property_id::text as id from public.property_owners where owner_id=$1 and company_id=$2 limit 1',
    [OWNER, COMPANY],
  )).rows[0].id;

  await f.db.query("insert into public.owners(id,full_name,name,company_id) values($1,'Co Owner','Co Owner',$2)", [OWNER2, COMPANY]);
  await f.db.query('update public.property_owners set ownership_percentage=60 where property_id=$1 and owner_id=$2', [property, OWNER]);
  await f.db.query(
    'insert into public.property_owners(property_id,owner_id,company_id,ownership_percentage,is_primary,starts_on)'
    + ' values($1,$2,$3,40,false,$4::date)',
    [property, OWNER2, COMPANY, COOWNERSHIP_STARTS],
  );
  await f.db.query(
    'insert into public.expenses(id,company_id,property_id,category,description,amount,status,charged_to,date_time,expense_date)'
    + " values($1,$2,$3,'maintenance','SHARED EXPENSE',$4,'POSTED','OWNER',$5::text,$6::date)",
    [SHARED_EXPENSE, COMPANY, property, SHARED_AMOUNT, SHARED_ERA_DATE, SHARED_ERA_DATE],
  );
  await f.db.query(
    'insert into public.expenses(id,company_id,property_id,category,description,amount,status,charged_to,date_time,expense_date)'
    + " values($1,$2,$3,'maintenance','SOLE ERA EXPENSE',$4,'POSTED','OWNER',$5::text,$6::date)",
    [SOLE_EXPENSE, COMPANY, property, SOLE_AMOUNT, SOLE_ERA_DATE, SOLE_ERA_DATE],
  );
  await f.db.exec('set role authenticated');
}, 60_000);

afterAll(async () => { await f?.db.close(); });

it('the stored owner balance excludes the unallocated co-owned expense', async () => {
  // Previously 100 for BOTH owners. The 60% owner now carries only the
  // sole-era cost, and the 40% owner carries nothing.
  expect(await balanceExpenses(OWNER)).toBe(SOLE_AMOUNT);
  expect(await balanceExpenses(OWNER2)).toBe(0);
});

it('the stored balance agrees with the statement and the settlement derivation', async () => {
  // The persisted figure must reconcile to the surfaces it backs; a stored
  // total that disagrees with the statement is the drift this closes.
  for (const owner of [OWNER, OWNER2]) {
    const [balance, statement, derived] = [
      await balanceExpenses(owner),
      await statementExpenses(owner),
      await derivedExpenses(owner),
    ];
    expect(balance).toBe(statement);
    expect(balance).toBe(derived);
  }
});

it('no double counting across owners: the shared cost is in nobody balance', async () => {
  const total = (await balanceExpenses(OWNER)) + (await balanceExpenses(OWNER2));
  // Previously 200 against a 100 cost, plus the 70 sole-era cost = 270.
  expect(total).toBe(SOLE_AMOUNT);
});

it('HISTORICAL CUTOFF: the balance attributes a sole-era cost to its historical owner', async () => {
  // The property is co-owned today, yet the day-3 cost still belongs to the
  // owner who solely held it then — ownership is read at the expense date.
  expect(await balanceExpenses(OWNER)).toBe(SOLE_AMOUNT);
  expect(await balanceExpenses(OWNER2)).toBe(0);
});

it('HISTORICAL CUTOFF: a departed co-owner does not absorb later costs in the balance', async () => {
  await f.db.exec('begin;reset role');
  try {
    await f.db.query(
      'update public.property_owners set ends_on=$3::date where property_id=$1 and owner_id=$2',
      [property, OWNER2, offsetDate(5)],
    );
    await f.db.exec('set local role authenticated');
    // OWNER is sole owner again on the shared-expense date, so it resolves to
    // that single historical owner rather than staying orphaned.
    expect(await balanceExpenses(OWNER)).toBe(SOLE_AMOUNT + SHARED_AMOUNT);
    expect(await balanceExpenses(OWNER2)).toBe(0);
  } finally {
    await f.db.exec('rollback');
  }
});

it('PRESERVED: the company-level 1300 control total still counts each cost exactly once', async () => {
  // wp05_subledger_due_from_owner is keyed on company/date with no owner
  // argument: it is the 1300 reconciliation control, not a per-owner
  // attribution, so co-ownership must not change it. Since migration07 it sums
  // legacy owner-charged expenses PLUS the owner-receivable history balance,
  // so the ground truth below combines both rather than expenses alone.
  await f.db.exec('reset role');
  const before = (await f.db.query<{ balance: string; cnt: string }>(
    'select balance::text, cnt::text from public.wp05_subledger_due_from_owner($1::uuid,$2::date)',
    [COMPANY, offsetDate(28)],
  )).rows[0];

  const legacy = (await f.db.query<{ total: string; n: string }>(
    `select coalesce(sum(e.amount),0)::text as total, count(*)::text as n
       from public.expenses e
      where e.company_id = $1 and e.deleted_at is null
        and e.expense_date <= $2::date
        and (upper(coalesce(e.charged_to::text,''))='OWNER' or upper(coalesce(e.category::text,''))='OWNER')
        and e.amount > 0.0005`,
    [COMPANY, offsetDate(28)],
  )).rows[0];
  const history = (await f.db.query<{ balance: string; cnt: string }>(
    'select balance::text, cnt::text from app_private.owner_receivable_history_balance($1::uuid,$2::date)',
    [COMPANY, offsetDate(28)],
  )).rows[0];
  await f.db.exec('set role authenticated');

  // The control equals legacy expenses + receivable history, each counted once
  // regardless of how many owners the property has.
  expect(Number(before.cnt)).toBe(Number(legacy.n) + Number(history.cnt));
  expect(Number(before.balance)).toBe(Number(legacy.total) + Number(history.balance));
  // Both co-ownership expenses under test are inside the legacy leg exactly
  // once each: the shared cost is still a company obligation even though it is
  // attributed to no individual owner.
  expect(Number(legacy.n)).toBe(2);
  expect(Number(legacy.total)).toBe(SHARED_AMOUNT + SOLE_AMOUNT);
});

it('PRESERVED: the unallocated cost remains visible as governed-adoption work', async () => {
  const out = (await f.db.query<{ d: { count: number; total_amount: number } }>(
    'select public.owner_unallocated_shared_expenses($1::date,$2::date,null) as d',
    [offsetDate(1), offsetDate(28)],
  )).rows[0].d;
  // Removing it from the balance must not make it disappear from the books.
  expect(Number(out.count)).toBe(1);
  expect(Number(out.total_amount)).toBe(SHARED_AMOUNT);
});

it('PRESERVED: recalculation does not modify any expense row', async () => {
  await f.db.exec('reset role');
  const rows = (await f.db.query<{ id: string; amount: string; version: number | null; deleted: string | null }>(
    'select id::text, amount::text, owner_allocation_version as version, deleted_at::text as deleted'
    + ' from public.expenses where id in ($1,$2)',
    [SHARED_EXPENSE, SOLE_EXPENSE],
  )).rows;
  await f.db.exec('set role authenticated');
  const byId = new Map(rows.map((r) => [r.id, r]));
  expect(Number(byId.get(SHARED_EXPENSE)?.amount)).toBe(SHARED_AMOUNT);
  expect(Number(byId.get(SOLE_EXPENSE)?.amount)).toBe(SOLE_AMOUNT);
  expect(rows.every((r) => r.version === null && r.deleted === null)).toBe(true);
});
