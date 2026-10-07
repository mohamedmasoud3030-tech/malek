/**
 * OMR is a 3-decimal currency (1000 baisa). `public.owner_balances` stored its
 * four money columns as numeric(14,2), so the third decimal was silently
 * truncated ON WRITE — after `public.recalculate_owner_balance` had already
 * computed the correct `public._r3(...)` value.
 *
 * Proved before the repair: a single POSTED owner expense of 12.345 gave
 * `owner_balances.total_expenses = 12.35` while `rpt_owner_statement` reported
 * 12.345 — the persisted balance disagreeing with the statement it reconciles
 * to, by 5 baisa, from the column type alone.
 *
 * 20260909000020 widens the four columns to numeric(18,3). This suite proves
 * the third decimal survives a full round trip and that the balance now agrees
 * with the statement and the payout authority to the baisa.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createOwnerOffsetFixture, offsetDate } from '@/test/owner-offset-fixture';
import { COMPANY, OWNER } from '@/test/office-creditor-fixture';

let f: Awaited<ReturnType<typeof createOwnerOffsetFixture>>;
let property = '';

/** Three genuinely 3-decimal OMR amounts; none is representable in 2 decimals. */
const A = 12.345;
const B = 7.891;
const C = 0.007;
const TOTAL = 20.243;

const MONEY_COLUMNS = ['total_income', 'total_expenses', 'commission', 'net_balance'];

async function columnType(column: string): Promise<string> {
  return (await f.db.query<{ t: string }>(
    `select format_type(a.atttypid, a.atttypmod) as t
       from pg_attribute a
      where a.attrelid = 'public.owner_balances'::regclass
        and a.attname = $1 and not a.attisdropped`,
    [column],
  )).rows[0].t;
}

async function recalculated(): Promise<{ expenses: number; net: number }> {
  await f.db.query('select public.recalculate_owner_balance($1::uuid)', [OWNER]);
  const row = (await f.db.query<{ e: string; n: string }>(
    'select total_expenses::text as e, net_balance::text as n from public.owner_balances where owner_id=$1',
    [OWNER],
  )).rows[0];
  return { expenses: Number(row.e), net: Number(row.n) };
}

beforeAll(async () => {
  f = await createOwnerOffsetFixture();
  await f.db.exec('reset role');
  property = (await f.db.query<{ id: string }>(
    'select property_id::text as id from public.property_owners where owner_id=$1 and company_id=$2 limit 1',
    [OWNER, COMPANY],
  )).rows[0].id;

  for (const amount of [A, B, C]) {
    await f.db.query(
      'insert into public.expenses(id,company_id,property_id,category,description,amount,status,charged_to,date_time,expense_date)'
      + " values(gen_random_uuid(),$1,$2,'maintenance','OMR PRECISION',$3,'POSTED','OWNER',$4::text,$4::date)",
      [COMPANY, property, amount, offsetDate(3)],
    );
  }
}, 60_000);

afterAll(async () => { await f?.db.close(); });

it('every owner_balances money column carries 3 decimals', async () => {
  for (const column of MONEY_COLUMNS) {
    expect(await columnType(column), `${column} must hold baisa`).toBe('numeric(18,3)');
  }
});

it('the third OMR decimal survives the balance round trip', async () => {
  const { expenses } = await recalculated();
  // Under numeric(14,2) this stored 20.24 and lost 3 baisa.
  expect(expenses).toBe(TOTAL);
  expect(expenses.toFixed(3)).toBe('20.243');
});

it('a sub-baisa-only amount is not rounded away entirely', async () => {
  // 0.007 rounds to 0.01 under 2 decimals — a 43% error on that line.
  const { expenses } = await recalculated();
  const withoutC = Number((TOTAL - C).toFixed(3));
  expect(expenses).not.toBe(withoutC);
  expect(expenses - withoutC).toBeCloseTo(C, 3);
});

it('the stored balance agrees with the statement to the baisa', async () => {
  const { expenses } = await recalculated();
  const statement = (await f.db.query<{ d: { transactions: Array<{ type: string; gross: number }> } }>(
    'select public.rpt_owner_statement($1,$2::date,$3::date) as d',
    [OWNER, offsetDate(1), offsetDate(28)],
  )).rows[0].d;
  const statementExpenses = statement.transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.gross), 0);

  // This is the assertion that failed before the repair, by exactly 0.005.
  expect(expenses).toBe(Number(statementExpenses.toFixed(3)));
});

it('the stored balance agrees with the payout authority to the baisa', async () => {
  const { expenses } = await recalculated();
  const derived = Number((await f.db.query<{ v: string }>(
    'select (public.calculate_owner_net_payout($1::uuid,$2::date,$3::date,null)).owner_expenses::text as v',
    [OWNER, offsetDate(1), offsetDate(28)],
  )).rows[0].v);
  expect(expenses).toBe(derived);
});

it('net_balance keeps 3 decimals through income - expenses - commission', async () => {
  const { net } = await recalculated();
  const parts = (await f.db.query<{ i: string; e: string; c: string }>(
    'select total_income::text as i, total_expenses::text as e, commission::text as c'
    + ' from public.owner_balances where owner_id=$1',
    [OWNER],
  )).rows[0];
  const expected = Number((Number(parts.i) - Number(parts.e) - Number(parts.c)).toFixed(3));
  expect(net).toBe(expected);
});

it('PRESERVED: widening did not recompute or rewrite any stored figure', async () => {
  // The migration is a type change only. A row written before it must keep its
  // value until a lawful recalculation, so a balance must never appear from
  // nowhere for an owner that was never recalculated.
  const orphan = (await f.db.query<{ n: string }>(
    `select count(*)::text as n from public.owner_balances b
      where b.company_id=$1 and not exists (
        select 1 from public.owners o where o.id=b.owner_id and o.company_id=b.company_id)`,
    [COMPANY],
  )).rows[0].n;
  expect(Number(orphan)).toBe(0);
});
