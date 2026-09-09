/**
 * `rpt_owner_financial_position` and the professional owner document must
 * inherit the co-ownership allocation authority.
 *
 * The canonical baseline (lines 2183-2197) contains an inline owner-expense
 * selector inside `rpt_owner_financial_position` carrying the same bare-EXISTS
 * `property_owners` shape that migrations 18 and 19 repaired elsewhere. That
 * baseline text was a genuine defect, but it is NO LONGER LIVE: migrations 14
 * and 16 rewrote the function so its period economics come from
 * `public.calculate_owner_net_payout`, which migration18 already moved onto
 * `public.owner_is_sole_property_owner_on`.
 *
 * That is a claim about behaviour, so it is proved here rather than asserted
 * from reading a diff. If anyone ever reintroduces an inline expense selector
 * into the position report, these tests fail.
 *
 * They also lock the two properties the position report exists to guarantee:
 * settled entitlement is reported separately from proven cash, and an
 * all-period disbursement total is never subtracted from a single period's
 * entitlement.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createOwnerOffsetFixture, offsetDate } from '@/test/owner-offset-fixture';
import { COMPANY, OWNER } from '@/test/office-creditor-fixture';

let f: Awaited<ReturnType<typeof createOwnerOffsetFixture>>;
let property = '';

const OWNER2 = 'c3000000-0000-4000-8000-0000000000f1';
const SHARED_EXPENSE = 'c3000000-0000-4000-8000-0000000000f9';
const SOLE_EXPENSE = 'c3000000-0000-4000-8000-0000000000fa';
const SHARED_AMOUNT = 100;
const SOLE_AMOUNT = 70;

const COOWNERSHIP_STARTS = offsetDate(5);
const SOLE_ERA_DATE = offsetDate(3);
const SHARED_ERA_DATE = offsetDate(6);

type Position = {
  period: { owner_expenses: number; net_payable: number; tenant_collections: number };
  lifecycle_all_time: {
    settled_pending_net: number;
    paid_net: number;
    paid_cash: number | null;
    paid_cash_proven_total: number;
    paid_cash_evidence_missing_count: number;
    remaining_payable: number;
  };
};

async function position(ownerId: string): Promise<Position> {
  return (await f.db.query<{ d: Position }>(
    'select public.rpt_owner_financial_position($1::uuid,$2::date,$3::date) as d',
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

  await f.db.query(
    "insert into public.owners(id,full_name,name,company_id) values($1,'Position Co Owner','Position Co Owner',$2)",
    [OWNER2, COMPANY],
  );
  await f.db.query(
    'update public.property_owners set ownership_percentage=60 where property_id=$1 and owner_id=$2',
    [property, OWNER],
  );
  await f.db.query(
    'insert into public.property_owners(property_id,owner_id,company_id,ownership_percentage,is_primary,starts_on)'
    + ' values($1,$2,$3,40,false,$4::date)',
    [property, OWNER2, COMPANY, COOWNERSHIP_STARTS],
  );
  await f.db.query(
    'insert into public.expenses(id,company_id,property_id,category,description,amount,status,charged_to,date_time,expense_date)'
    + " values($1,$2,$3,'maintenance','POSITION SHARED',$4,'POSTED','OWNER',$5::text,$6::date)",
    [SHARED_EXPENSE, COMPANY, property, SHARED_AMOUNT, SHARED_ERA_DATE, SHARED_ERA_DATE],
  );
  await f.db.query(
    'insert into public.expenses(id,company_id,property_id,category,description,amount,status,charged_to,date_time,expense_date)'
    + " values($1,$2,$3,'maintenance','POSITION SOLE ERA',$4,'POSTED','OWNER',$5::text,$6::date)",
    [SOLE_EXPENSE, COMPANY, property, SOLE_AMOUNT, SOLE_ERA_DATE, SOLE_ERA_DATE],
  );
  await f.db.exec('set role authenticated');
}, 60_000);

afterAll(async () => { await f?.db.close(); });

it('the position report does not charge an unallocated co-owned expense to a co-owner', async () => {
  // OWNER was the SOLE owner on day 3, so the 70 attaches. The 100 on day 6
  // falls in the co-owned era and belongs to nobody until governed adoption.
  const p = await position(OWNER);
  expect(p.period.owner_expenses).toBe(SOLE_AMOUNT);
});

it('the position report charges the co-owner nothing for the shared expense', async () => {
  const p = await position(OWNER2);
  expect(p.period.owner_expenses).toBe(0);
});

it('no double counting: the shared cost appears in NEITHER position report', async () => {
  const [a, b] = [await position(OWNER), await position(OWNER2)];
  expect(a.period.owner_expenses + b.period.owner_expenses).toBe(SOLE_AMOUNT);
});

it('the position report agrees with calculate_owner_net_payout, its declared authority', async () => {
  // Proves the inline baseline selector is not live: the report and the
  // settlement write-path authority cannot disagree.
  const p = await position(OWNER);
  const derived = Number((await f.db.query<{ v: string }>(
    'select (public.calculate_owner_net_payout($1::uuid,$2::date,$3::date,null)).owner_expenses::text as v',
    [OWNER, offsetDate(1), offsetDate(28)],
  )).rows[0].v);
  expect(p.period.owner_expenses).toBe(derived);
  expect(p.period.net_payable).toBe(Number((await f.db.query<{ v: string }>(
    'select (public.calculate_owner_net_payout($1::uuid,$2::date,$3::date,null)).net_payable::text as v',
    [OWNER, offsetDate(1), offsetDate(28)],
  )).rows[0].v));
});

it('STRUCTURAL: the live position function holds no inline owner-expense selector', async () => {
  await f.db.exec('reset role');
  const d = (await f.db.query<{ d: string }>(
    "select pg_get_functiondef('public.rpt_owner_financial_position(uuid,date,date)'::regprocedure) as d",
  )).rows[0].d;
  await f.db.exec('set role authenticated');
  // The repaired baseline shape must not come back. Ownership attribution for
  // expenses belongs to the shared predicate, reached via the payout authority.
  expect(d).not.toMatch(/charged_to/i);
  expect(d).not.toMatch(/property_owners/i);
  expect(d).toMatch(/calculate_owner_net_payout/);
});

it('settled entitlement is reported separately from proven cash', async () => {
  const p = await position(OWNER);
  // Distinct keys with distinct meanings: an entitlement figure must never be
  // presented as, or silently replaced by, evidenced cash.
  expect(p.lifecycle_all_time).toHaveProperty('settled_pending_net');
  expect(p.lifecycle_all_time).toHaveProperty('paid_net');
  expect(p.lifecycle_all_time).toHaveProperty('paid_cash');
  expect(p.lifecycle_all_time).toHaveProperty('paid_cash_proven_total');
});

it('missing cash evidence is surfaced as null, never coerced to zero', async () => {
  await f.db.exec('reset role');
  // A PAID settlement whose cash proof cannot be established must make the
  // headline cash figure UNKNOWN, not 0 — zero is a claim, absence is not.
  const missing = (await f.db.query<{ n: string }>(
    `select count(*)::text as n from public.owner_settlements s
      where s.company_id=$1 and s.owner_id::text=$2 and s.status='PAID'
        and app_private.owner_settlement_paid_cash($1,s.id) is null`,
    [COMPANY, OWNER],
  )).rows[0].n;
  await f.db.exec('set role authenticated');

  const p = await position(OWNER);
  expect(p.lifecycle_all_time.paid_cash_evidence_missing_count).toBe(Number(missing));
  if (Number(missing) > 0) {
    expect(p.lifecycle_all_time.paid_cash).toBeNull();
    // The partial proof is still disclosed rather than hidden.
    expect(p.lifecycle_all_time.paid_cash_proven_total).not.toBeNull();
  } else {
    expect(p.lifecycle_all_time.paid_cash).toBe(p.lifecycle_all_time.paid_cash_proven_total);
  }
});

it('an all-period disbursement total is never subtracted from one period entitlement', async () => {
  const p = await position(OWNER);
  // remaining_payable is the OUTSTANDING (DRAFT/APPROVED) net, all-time by
  // contract. It must not be the period net minus lifetime paid cash, which
  // would mix a single period's entitlement with lifetime disbursement.
  expect(p.lifecycle_all_time.remaining_payable).toBe(p.lifecycle_all_time.settled_pending_net);
  const wrong = p.period.net_payable - p.lifecycle_all_time.paid_cash_proven_total;
  if (p.lifecycle_all_time.paid_cash_proven_total > 0) {
    expect(p.lifecycle_all_time.remaining_payable).not.toBe(wrong);
  }
});

it('TEETH: the repaired baseline selector WOULD have double counted this fixture', async () => {
  // A suite that passes without a product change is only meaningful if it can
  // fail. This runs the exact bare-EXISTS shape from canonical baseline lines
  // 2183-2197 against the same fixture and shows it produces the wrong answer
  // for both owners — so the assertions above are load-bearing, not vacuous.
  await f.db.exec('reset role');
  const legacy = async (ownerId: string) => Number((await f.db.query<{ v: string }>(
    `select coalesce(sum(e.amount),0)::text as v
       from public.expenses e
      where e.deleted_at is null and e.company_id=$4
        and upper(coalesce(e.status,''))='POSTED'
        and upper(coalesce(e.charged_to,''))='OWNER'
        and public._safe_date(e.date_time) between $2::date and $3::date
        and exists (
          select 1 from public.property_owners po
          where po.property_id=e.property_id and po.owner_id=$1
            and (po.starts_on is null or po.starts_on<=public._safe_date(e.date_time))
            and (po.ends_on is null or po.ends_on>=public._safe_date(e.date_time)))`,
    [ownerId, offsetDate(1), offsetDate(28), COMPANY],
  )).rows[0].v);

  const legacyOwner = await legacy(OWNER);
  const legacyCoOwner = await legacy(OWNER2);
  await f.db.exec('set role authenticated');

  // The old shape charges the shared 100 to BOTH owners: 170 + 100 = 270 for a
  // 170 real cost. That is the defect, reproduced.
  expect(legacyOwner).toBe(SOLE_AMOUNT + SHARED_AMOUNT);
  expect(legacyCoOwner).toBe(SHARED_AMOUNT);
  expect(legacyOwner + legacyCoOwner).toBe(SOLE_AMOUNT + SHARED_AMOUNT * 2);

  // The live report disagrees with the legacy shape — which is the whole point.
  const live = await position(OWNER);
  expect(live.period.owner_expenses).not.toBe(legacyOwner);
  expect(live.period.owner_expenses).toBe(SOLE_AMOUNT);
});

it('the period block is period-scoped while the lifecycle block is all-time', async () => {
  const narrow = (await f.db.query<{ d: Position }>(
    'select public.rpt_owner_financial_position($1::uuid,$2::date,$3::date) as d',
    [OWNER, offsetDate(1), offsetDate(2)],
  )).rows[0].d;
  const wide = await position(OWNER);
  // Day 3 sole-era expense is outside the narrow window.
  expect(narrow.period.owner_expenses).toBe(0);
  expect(wide.period.owner_expenses).toBe(SOLE_AMOUNT);
  // The all-time lifecycle block is unaffected by the period, by contract.
  expect(narrow.lifecycle_all_time.settled_pending_net)
    .toBe(wide.lifecycle_all_time.settled_pending_net);
  expect(narrow.lifecycle_all_time.paid_net).toBe(wide.lifecycle_all_time.paid_net);
});
