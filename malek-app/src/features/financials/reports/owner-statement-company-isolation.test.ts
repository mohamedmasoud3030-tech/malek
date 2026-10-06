/**
 * Owner statement company isolation.
 *
 * `rpt_owner_statement` is SECURITY DEFINER and resolves the caller's company
 * once via `public.require_company_id()`. Every CTE inside it filters on that
 * value — `owner_contracts`, `payment_rows` and `settlement_rows` all carry
 * `company_id = v_company_id` — with one exception: the expense source
 * `public._owner_statement_expenses` carried NO company predicate at all.
 *
 * That is not merely a missing filter. Because the caller is SECURITY DEFINER,
 * the invoker's row-level security on `public.expenses`
 * (`expenses_select_app_users`, which enforces
 * `company_id = current_company_id()`) does not apply inside the call. The
 * helper's only scoping was the owner id and a `property_owners` link, and both
 * `expenses` and `property_owners` are per-company tables whose rows can exist
 * for the same owner id in another company.
 *
 * Result before 20260909000017: a POSTED, OWNER-charged expense belonging to a
 * DIFFERENT company was rendered inside this company's owner statement as a
 * real deduction, and was summed into its totals.
 *
 * This suite reproduces that exact arrangement and asserts the boundary holds.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createOwnerOffsetFixture, offsetDate } from '@/test/owner-offset-fixture';
import { COMPANY, OTHER_COMPANY, OWNER } from '@/test/office-creditor-fixture';

let f: Awaited<ReturnType<typeof createOwnerOffsetFixture>>;

const FOREIGN_PROPERTY = 'c2000000-0000-4000-8000-0000000000f1';
const FOREIGN_EXPENSE = 'c2000000-0000-4000-8000-0000000000f2';
const FOREIGN_MARKER = 'FOREIGN COMPANY EXPENSE';

type StatementTx = { date: string; type: string; gross: number; details: string; property_name: string };
type Statement = { transactions: StatementTx[]; total_gross: number; total_net: number };

beforeAll(async () => {
  f = await createOwnerOffsetFixture();

  // Build the leak scenario with the elevated role, exactly as a second
  // company's own legitimate data would exist in a shared database.
  await f.db.exec('reset role');
  await f.db.query(
    "insert into public.properties(id,title,type,address,company_id)"
    + " values($1,'Foreign Property','residential','Foreign',$2)",
    [FOREIGN_PROPERTY, OTHER_COMPANY],
  );
  // The SAME owner id also holds property in the other company.
  await f.db.query(
    "insert into public.property_owners(property_id,owner_id,company_id,ownership_percentage,is_primary,starts_on)"
    + " values($1,$2,$3,100,true,$4::date)",
    [FOREIGN_PROPERTY, OWNER, OTHER_COMPANY, offsetDate(1)],
  );
  await f.db.query(
    "insert into public.expenses(id,company_id,property_id,category,description,amount,status,charged_to,date_time,expense_date)"
    + " values($1,$2,$3,'maintenance',$4,777,'POSTED','OWNER',$5::text,$6::date)",
    [FOREIGN_EXPENSE, OTHER_COMPANY, FOREIGN_PROPERTY, FOREIGN_MARKER, offsetDate(5), offsetDate(5)],
  );
  await f.db.exec('set role authenticated');
}, 60_000);

afterAll(async () => { await f?.db.close(); });

it('the foreign-company expense really exists and would match on owner and date', async () => {
  // Proves the negative assertions below are meaningful rather than vacuous:
  // the row is POSTED, charged to the OWNER, inside the window, and linked to
  // the same owner id — every condition the helper tested — differing only in
  // company.
  // Read with the elevated role: RLS on public.expenses correctly hides this
  // row from `authenticated` in this company, which is precisely why the
  // SECURITY DEFINER statement path had to filter explicitly.
  await f.db.exec('reset role');
  const row = (await f.db.query<{ company_id: string; status: string; charged_to: string; amount: string }>(
    'select company_id, status, charged_to, amount::text from public.expenses where id=$1',
    [FOREIGN_EXPENSE],
  )).rows[0];
  await f.db.exec('set role authenticated');
  expect(row.company_id).toBe(OTHER_COMPANY);
  expect(row.company_id).not.toBe(COMPANY);
  expect(row.status).toBe('POSTED');
  expect(row.charged_to).toBe('OWNER');
  expect(Number(row.amount)).toBe(777);
});

it('does not leak another company expense into this company owner statement', async () => {
  const result = (await f.db.query<{ data: Statement }>(
    'select public.rpt_owner_statement($1,$2::date,$3::date) as data',
    [OWNER, offsetDate(1), offsetDate(28)],
  )).rows[0].data;

  expect(result.transactions.filter((tx) => tx.details.includes(FOREIGN_MARKER))).toHaveLength(0);
  expect(result.transactions.filter((tx) => tx.property_name === 'Foreign Property')).toHaveLength(0);
  // The leaked amount must not be buried in the totals either.
  expect(result.transactions.some((tx) => tx.gross === -777)).toBe(false);
});

it('the company-scoped expense source cannot be called without a company', async () => {
  // The unsafe three-argument overload is dropped, so no caller can reach a
  // version that lacks the predicate.
  await expect(
    f.db.query('select * from public._owner_statement_expenses($1,$2::date,$3::date)',
      [OWNER, offsetDate(1), offsetDate(28)]),
  ).rejects.toThrow();
});

it('still returns this company own owner-charged expenses', async () => {
  // The isolation fix must not silence legitimate rows. Insert an in-company
  // expense on the fixture property and require it to appear.
  await f.db.exec('begin;reset role');
  try {
    const ownProperty = (await f.db.query<{ id: string }>(
      'select property_id::text as id from public.property_owners where owner_id=$1 and company_id=$2 limit 1',
      [OWNER, COMPANY],
    )).rows[0]?.id;
    expect(ownProperty).toBeTruthy();

    await f.db.query(
      "insert into public.expenses(id,company_id,property_id,category,description,amount,status,charged_to,date_time,expense_date)"
      + " values('c2000000-0000-4000-8000-0000000000f3',$1,$2,'maintenance','IN COMPANY EXPENSE',60,'POSTED','OWNER',$3::text,$4::date)",
      [COMPANY, ownProperty, offsetDate(6), offsetDate(6)],
    );
    await f.db.exec('set local role authenticated');

    const result = (await f.db.query<{ data: Statement }>(
      'select public.rpt_owner_statement($1,$2::date,$3::date) as data',
      [OWNER, offsetDate(1), offsetDate(28)],
    )).rows[0].data;
    const own = result.transactions.filter((tx) => tx.details.includes('IN COMPANY EXPENSE'));
    expect(own).toHaveLength(1);
    expect(own[0].gross).toBe(-60);
  } finally {
    await f.db.exec('rollback');
  }
});
