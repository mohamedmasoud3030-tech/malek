/**
 * OMR 3-decimal integrity across the remaining money columns.
 *
 * `db0:audit` flags every money column that is not exactly 3 decimals, but
 * that rule alone does not distinguish a real defect from a false positive.
 * Each flagged column was checked against its LIVE type and classified:
 *
 *   - UNCONSTRAINED `numeric` (owner_settlements.*, tenant_balances.balance_due,
 *     commissions.*, lands.*) keeps every decimal and cannot truncate baisa.
 *     Forcing numeric(18,3) on these would be a NARROWING that could round
 *     posted settlement history — the opposite of the requirement.
 *   - numeric(14,4) / numeric(18,6) are commission RATES and fee snapshots, not
 *     OMR amounts. Narrowing them to 3 decimals would change agreed commercial
 *     terms.
 *   - numeric(14,2) genuinely truncates. Seven such columns existed; 20260909000021
 *     widens them.
 *
 * This suite pins that classification so a future "fix all audit findings"
 * sweep cannot narrow a settlement column or a commission rate by mistake.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createOwnerOffsetFixture } from '@/test/owner-offset-fixture';

let f: Awaited<ReturnType<typeof createOwnerOffsetFixture>>;

/** Columns that previously truncated a real OMR amount. */
const WIDENED: Array<[string, string]> = [
  ['contract_balances', 'total_paid'],
  ['contract_balances', 'total_invoiced'],
  ['contract_balances', 'balance_due'],
  ['bank_accounts', 'opening_balance'],
  ['units', 'rent_amount'],
  ['utility_bills', 'paid_amount'],
  ['properties', 'purchase_value'],
];

/** Unconstrained numeric: lossless already, must NOT be narrowed. */
const MUST_STAY_UNCONSTRAINED: Array<[string, string]> = [
  ['owner_settlements', 'net_payable'],
  ['owner_settlements', 'gross_collected'],
  ['owner_settlements', 'office_fee'],
  ['owner_settlements', 'tax_amount'],
  ['owner_settlements', 'amount'],
  ['tenant_balances', 'balance_due'],
];

/** Rates and snapshots: more than 3 decimals on purpose. */
const MUST_KEEP_EXTRA_SCALE: Array<[string, string, number]> = [
  ['owner_agreements', 'commission_value', 4],
  ['owner_agreement_versions', 'commission_value', 4],
  ['fixed_monthly_daily_accruals', 'monthly_contract_amount', 4],
  ['contract_registration_records', 'fee_value_snapshot', 6],
];

async function typeOf(table: string, column: string): Promise<string> {
  return (await f.db.query<{ t: string }>(
    `select format_type(a.atttypid, a.atttypmod) as t
       from pg_attribute a
      where a.attrelid = $1::regclass and a.attname = $2 and not a.attisdropped`,
    [`public.${table}`, column],
  )).rows[0].t;
}

/** Round-trips 12.345 through the column's exact type. */
async function storedValue(table: string, column: string): Promise<number> {
  const t = await typeOf(table, column);
  return Number((await f.db.query<{ v: string }>(
    `select (12.345::numeric)::${t}::text as v`,
  )).rows[0].v);
}

beforeAll(async () => {
  f = await createOwnerOffsetFixture();
  await f.db.exec('reset role');
}, 60_000);

afterAll(async () => { await f?.db.close(); });

it('every widened column now holds 3 decimals', async () => {
  for (const [table, column] of WIDENED) {
    expect(await typeOf(table, column), `${table}.${column}`).toBe('numeric(18,3)');
  }
});

it('the third OMR decimal survives storage in every widened column', async () => {
  for (const [table, column] of WIDENED) {
    // Before the repair each of these returned 12.35, losing 5 baisa.
    expect(await storedValue(table, column), `${table}.${column} truncates baisa`).toBe(12.345);
  }
});

it('unconstrained money columns are left unconstrained, never narrowed', async () => {
  for (const [table, column] of MUST_STAY_UNCONSTRAINED) {
    // Bare 'numeric' has no typmod and keeps every decimal. Narrowing these to
    // numeric(18,3) could round POSTED settlement history.
    expect(await typeOf(table, column), `${table}.${column} must stay unconstrained`).toBe('numeric');
    expect(await storedValue(table, column)).toBe(12.345);
  }
});

it('commission rates and fee snapshots keep their extra scale', async () => {
  for (const [table, column, scale] of MUST_KEEP_EXTRA_SCALE) {
    const t = await typeOf(table, column);
    const actual = Number(/^numeric\(\d+,(\d+)\)$/.exec(t)?.[1]);
    // A RATE is not an OMR amount; narrowing it to 3 changes commercial terms.
    expect(actual, `${table}.${column} is ${t}`).toBe(scale);
    expect(actual).toBeGreaterThan(3);
  }
});

it('contract_balances stays consistent with its own source after recalculation', async () => {
  const contract = (await f.db.query<{ id: string }>(
    'select id::text from public.contracts where deleted_at is null limit 1',
  )).rows[0];
  expect(contract).toBeDefined();

  await f.db.query('select public.recalculate_all_balances()');
  const stored = (await f.db.query<{ p: string | null }>(
    'select total_paid::text as p from public.contract_balances where contract_id=$1',
    [contract.id],
  )).rows[0];
  const source = (await f.db.query<{ s: string }>(
    `select coalesce(sum(amount),0)::text as s from public.payments
      where contract_id=$1 and deleted_at is null and upper(coalesce(status,'')) <> 'VOID'`,
    [contract.id],
  )).rows[0].s;

  if (stored?.p != null) {
    // Equality to the baisa, not to 2 decimals.
    expect(Number(stored.p)).toBe(Number(Number(source).toFixed(3)));
  }
});

it('PRESERVED: widening invented no contract_balances row', async () => {
  const orphan = (await f.db.query<{ n: string }>(
    `select count(*)::text as n from public.contract_balances b
      where not exists (select 1 from public.contracts c where c.id = b.contract_id)`,
  )).rows[0].n;
  expect(Number(orphan)).toBe(0);
});
