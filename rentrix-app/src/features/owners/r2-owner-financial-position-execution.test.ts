/**
 * R2 — Owner Financial Position: authoritative position read-model proof.
 *
 * Proves against a FULL migration replay that public.rpt_owner_financial_position:
 *   1. fails closed (auth + company context + cross-company owner),
 *   2. reconciles EXACTLY with the settlement derivation authority
 *      (calculate_owner_net_payout) — position == what a settlement would store,
 *   3. reconciles with the owner statement (rpt_owner_statement parity),
 *   4. tracks the settlement lifecycle truthfully:
 *      draft → approved → paid moves value from remaining_payable to paid_net,
 *   5. reports fee VAT as fee VAT (tax never surfaces as a "utility" bucket),
 *   6. surfaces owner-funds control events with drill-down identifiers.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'e2000000-0000-4000-8000-000000000001';
const OTHER_COMPANY = 'e2000000-0000-4000-8000-000000000002';
const ADMIN = 'e2000000-0000-4000-8000-000000000011';
const CHECKER = 'e2000000-0000-4000-8000-000000000019';
const OTHER_ADMIN = 'e2000000-0000-4000-8000-000000000012';
const OWNER = 'e2000000-0000-4000-8000-000000000021';
const OTHER_OWNER = 'e2000000-0000-4000-8000-000000000022';
const PROPERTY = 'e2000000-0000-4000-8000-000000000031';
const UNIT = 'e2000000-0000-4000-8000-000000000041';
const TENANT = 'e2000000-0000-4000-8000-000000000051';
const CONTRACT = 'e2000000-0000-4000-8000-000000000061';
const AGREEMENT = 'e2000000-0000-4000-8000-000000000071';

const JULY = { from: '2026-07-01', to: '2026-07-31' };

let db: PGlite;

function num(v: unknown) {
  return Number(v ?? NaN);
}

async function position(ownerId = OWNER, from = JULY.from, to = JULY.to) {
  const { rows } = await db.query<{ value: string }>(
    `select public.rpt_owner_financial_position($1::uuid, $2::date, $3::date)::text as value`,
    [ownerId, from, to],
  );
  return JSON.parse(rows[0]?.value ?? '{}') as Record<string, any>;
}

async function derivation(ownerId = OWNER, from = JULY.from, to = JULY.to) {
  const { rows } = await db.query(
    `select gross_collected, office_fee, owner_expenses, tax_amount, net_payable
       from public.calculate_owner_net_payout($1::uuid, $2::date, $3::date, null)`,
    [ownerId, from, to],
  );
  return rows[0] as any;
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY}', 'R2 Co', 'r2-co'),
      ('${OTHER_COMPANY}', 'R2 Other', 'r2-other');

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${ADMIN}', 'admin@r2.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${CHECKER}', 'checker@r2.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${OTHER_ADMIN}', 'other@r2.test', '{"company_id":"${OTHER_COMPANY}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${ADMIN}', 'admin@r2.test', 'Admin', 'ADMIN', 'ACTIVE', true),
      ('${CHECKER}', 'checker@r2.test', 'Checker', 'ADMIN', 'ACTIVE', true),
      ('${OTHER_ADMIN}', 'other@r2.test', 'Other', 'ADMIN', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${ADMIN}', 'ADMIN'),
      ('${COMPANY}', '${CHECKER}', 'ADMIN'),
      ('${OTHER_COMPANY}', '${OTHER_ADMIN}', 'ADMIN');

    -- VAT enabled at 5% so fee VAT is a REAL number in this fixture, proving
    -- it flows through as fee VAT — never as a utilities bucket.
    insert into public.company_settings (id, singleton_key, company_name, currency, vat_enabled, vat_rate, company_id)
    values (gen_random_uuid(), true, 'R2 Co', 'OMR', true, 5, '${COMPANY}');

    insert into public.owners (id, full_name, name, company_id) values
      ('${OWNER}', 'R2 Owner', 'R2 Owner', '${COMPANY}'),
      ('${OTHER_OWNER}', 'Foreign Owner', 'Foreign Owner', '${OTHER_COMPANY}');

    insert into public.properties (id, title, name, type, address, company_id)
    values ('${PROPERTY}', 'R2 Property', 'R2 Property', 'residential', 'Muscat', '${COMPANY}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id)
    values ('${PROPERTY}', '${OWNER}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id)
    values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 10, date '2026-01-01', date '2027-12-31', '${COMPANY}');
    insert into public.units (id, property_id, unit_number, company_id)
    values ('${UNIT}', '${PROPERTY}', 'R2-1', '${COMPANY}');
    insert into public.people (id, full_name, type, company_id)
    values ('${TENANT}', 'R2 Tenant', 'tenant', '${COMPANY}');
    insert into public.contracts (id, property_id, unit_id, tenant_id, start_date, end_date, rent_amount, status, agreement_id, company_id)
    values ('${CONTRACT}', '${PROPERTY}', '${UNIT}', '${TENANT}', '2026-01-01', '2026-12-31', 12000, 'active', '${AGREEMENT}', '${COMPANY}');

    -- Collections in July: 1000 + 500 POSTED, 250 VOID (excluded).
    insert into public.invoices (id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, status, company_id) values
      ('e2000000-0000-4000-8000-000000000101', '${CONTRACT}', '2026-07-01', '2026-07-05', 1000, 1000, 0, 'PAID', '${COMPANY}'),
      ('e2000000-0000-4000-8000-000000000102', '${CONTRACT}', '2026-07-06', '2026-07-12', 500, 500, 0, 'PAID', '${COMPANY}'),
      ('e2000000-0000-4000-8000-000000000103', '${CONTRACT}', '2026-07-13', '2026-07-20', 250, 0, 0, 'UNPAID', '${COMPANY}');
    insert into public.receipts (id, amount, status, company_id) values
      ('e2000000-0000-4000-8000-000000000201', 1000, 'POSTED', '${COMPANY}'),
      ('e2000000-0000-4000-8000-000000000202', 500, 'POSTED', '${COMPANY}'),
      ('e2000000-0000-4000-8000-000000000203', 250, 'VOID', '${COMPANY}');
    insert into public.payments (id, invoice_id, contract_id, amount, payment_method, payment_date, status, receipt_id, company_id) values
      ('e2000000-0000-4000-8000-000000000201', 'e2000000-0000-4000-8000-000000000101', '${CONTRACT}', 1000, 'cash', date '2026-07-05', 'POSTED', 'e2000000-0000-4000-8000-000000000201', '${COMPANY}'),
      ('e2000000-0000-4000-8000-000000000202', 'e2000000-0000-4000-8000-000000000102', '${CONTRACT}', 500, 'cash', date '2026-07-12', 'POSTED', 'e2000000-0000-4000-8000-000000000202', '${COMPANY}'),
      ('e2000000-0000-4000-8000-000000000203', 'e2000000-0000-4000-8000-000000000103', '${CONTRACT}', 250, 'cash', date '2026-07-20', 'VOID', 'e2000000-0000-4000-8000-000000000203', '${COMPANY}');
    update public.receipts set payment_id = id
     where id in ('e2000000-0000-4000-8000-000000000201','e2000000-0000-4000-8000-000000000202','e2000000-0000-4000-8000-000000000203');

    -- Owner expense in period: 120 POSTED/OWNER.
    insert into public.expenses (id, property_id, category, amount, expense_date, date_time, status, charged_to, description, company_id) values
      ('e2000000-0000-4000-8000-000000000301', '${PROPERTY}', 'maintenance', 120, date '2026-07-10', '2026-07-10', 'POSTED', 'OWNER', 'R2 expense', '${COMPANY}');

    -- Payout accounts for the pay path (fixture provisioning, P1 pattern).
    update public.accounts set company_id = '${COMPANY}' where no in ('1111', '2000');

    -- RC1 owner-funds control: in the live flow every owner collection posts a
    -- canonical GL batch (Dr 1111 Cash / Cr 2000 Owner Funds Payable) and
    -- appends a positive OWNER_COLLECTION event in the same transaction.
    -- Seed both sides so the payout is solvent — the RC1 solvency trigger
    -- verifies the ACTUAL GL 2000 balance, not just the events.
    -- The cutover gate requires each 2000 batch to be linked from an owner
    -- funds event before the NEXT event is appended (live RPCs post batch +
    -- event in one transaction). Interleave batch → event, batch → event.
    insert into public.journal_batches
      (id, company_id, status, source_type, source_id, event_id, is_legacy_compat, effective_date, posted_at)
    values
      ('e2000000-0000-4000-8000-000000000401', '${COMPANY}', 'POSTED', 'receipt', 'e2000000-0000-4000-8000-000000000201', 'owner-collection', true, date '2026-07-05', now());
    insert into public.journal_lines (id, batch_id, company_id, account_id, debit, credit) values
      ('r2-jl-1', 'e2000000-0000-4000-8000-000000000401', '${COMPANY}', (select id from public.accounts where no = '1111' and company_id = '${COMPANY}'), 1000, 0),
      ('r2-jl-2', 'e2000000-0000-4000-8000-000000000401', '${COMPANY}', (select id from public.accounts where no = '2000' and company_id = '${COMPANY}'), 0, 1000);
    insert into public.owner_funds_events
      (company_id, owner_id, contract_id, source_type, source_id, event_id, amount_delta, effective_date, journal_batch_id) values
      ('${COMPANY}', '${OWNER}', '${CONTRACT}', 'OWNER_COLLECTION', 'e2000000-0000-4000-8000-000000000201', 'collection', 1000, date '2026-07-05', 'e2000000-0000-4000-8000-000000000401');
    insert into public.journal_batches
      (id, company_id, status, source_type, source_id, event_id, is_legacy_compat, effective_date, posted_at)
    values
      ('e2000000-0000-4000-8000-000000000402', '${COMPANY}', 'POSTED', 'receipt', 'e2000000-0000-4000-8000-000000000202', 'owner-collection', true, date '2026-07-12', now());
    insert into public.journal_lines (id, batch_id, company_id, account_id, debit, credit) values
      ('r2-jl-3', 'e2000000-0000-4000-8000-000000000402', '${COMPANY}', (select id from public.accounts where no = '1111' and company_id = '${COMPANY}'), 500, 0),
      ('r2-jl-4', 'e2000000-0000-4000-8000-000000000402', '${COMPANY}', (select id from public.accounts where no = '2000' and company_id = '${COMPANY}'), 0, 500);
    insert into public.owner_funds_events
      (company_id, owner_id, contract_id, source_type, source_id, event_id, amount_delta, effective_date, journal_batch_id) values
      ('${COMPANY}', '${OWNER}', '${CONTRACT}', 'OWNER_COLLECTION', 'e2000000-0000-4000-8000-000000000202', 'collection', 500, date '2026-07-12', 'e2000000-0000-4000-8000-000000000402');
  `);

  await assumeIdentity(db, ADMIN, COMPANY);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

// Expected July derivation for this fixture:
//   collections 1500 (VOID excluded), fee 10% = 150, VAT 5% on fee = 7.5,
//   expenses 120, net = 1500 - 150 - 120 - 7.5 = 1222.5.
const EXPECTED = { gross: 1500, fee: 150, vat: 7.5, expenses: 120, net: 1222.5 };

describe('R2 — rpt_owner_financial_position authoritative read model', () => {
  it('fails closed without auth, and rejects a cross-company owner', async () => {
    await assumeIdentity(db, null, null);
    await expect(position()).rejects.toThrow(/42501|required/i);
    await assumeIdentity(db, ADMIN, COMPANY);
    await expect(position(OTHER_OWNER)).rejects.toThrow(/42501|not in your company/i);
  });

  it('rejects an invalid period instead of guessing', async () => {
    await expect(position(OWNER, '2026-08-01', '2026-07-01')).rejects.toThrow(/22023|period/i);
  });

  it('period breakdown equals the settlement derivation authority EXACTLY', async () => {
    const [p, d] = [await position(), await derivation()];
    expect(num(p.period.tenant_collections)).toBe(num(d.gross_collected));
    expect(num(p.period.management_fees.amount)).toBe(num(d.office_fee));
    expect(num(p.period.owner_expenses)).toBe(num(d.owner_expenses));
    expect(num(p.period.fee_vat)).toBe(num(d.tax_amount));
    expect(num(p.period.net_payable)).toBe(num(d.net_payable));
    // And both equal the independently computed business expectation.
    expect(num(p.period.tenant_collections)).toBe(EXPECTED.gross);
    expect(num(p.period.management_fees.amount)).toBe(EXPECTED.fee);
    expect(num(p.period.fee_vat)).toBe(EXPECTED.vat);
    expect(num(p.period.owner_expenses)).toBe(EXPECTED.expenses);
    expect(num(p.period.net_payable)).toBe(EXPECTED.net);
  });

  it('fee basis comes from the server breakdown — no fabricated 0 / fixed', async () => {
    const p = await position();
    const breakdown = p.period.management_fees.breakdown;
    expect(breakdown.source).toBe('server_derived');
    expect(num(breakdown.rate_fees)).toBe(EXPECTED.fee);
    expect(num(breakdown.fixed_fees)).toBe(0);
    expect(breakdown.vat?.enabled).toBe(true);
    expect(num(breakdown.vat?.rate)).toBe(5);
    const agreements = breakdown.agreements as Array<Record<string, unknown>>;
    expect(agreements[0]?.commission_type).toBe('RATE');
    expect(num(agreements[0]?.commission_value)).toBe(10);
  });

  it('VAT is reported as fee VAT — never inside an expenses/utilities bucket', async () => {
    const p = await position();
    expect(num(p.period.fee_vat)).toBe(EXPECTED.vat);
    expect(num(p.period.owner_expenses)).toBe(EXPECTED.expenses); // expenses do NOT absorb VAT
    // The reserved adjustments bucket is an explicit, honest zero.
    expect(num(p.period.authorized_adjustments)).toBe(0);
    expect(p.period.adjustments_note).toBe('no_adjustments_authority_defined');
  });

  // Runs BEFORE the lifecycle test: rpt_owner_statement includes paid
  // settlements as statement transactions, so parity against the raw period
  // derivation must be asserted on the pre-settlement state.
  it('reconciles with the owner statement authority (rpt_owner_statement parity contract)', async () => {
    const p = await position();
    const statement = (await db.query<{ out: any }>(
      `select public.rpt_owner_statement($1::uuid, $2::date, $3::date) as out`,
      [OWNER, JULY.from, JULY.to],
    )).rows[0]?.out as any;
    // P1 parity contract: statement total_gross = collections − owner expenses.
    expect(num(p.period.tenant_collections) - num(p.period.owner_expenses)).toBeCloseTo(num(statement.total_gross), 3);
    // Statement deductions carry the management fee (VAT handling may differ by
    // statement version, so assert the fee is contained, not strict equality).
    expect(num(statement.total_deductions)).toBeGreaterThanOrEqual(num(p.period.management_fees.amount));
  });

  it('settlement lifecycle moves value from remaining_payable to paid_net truthfully', async () => {
    const before = await position();
    expect(num(before.lifecycle_all_time.settled_pending_net)).toBe(0);
    expect(num(before.lifecycle_all_time.paid_net)).toBe(0);

    // Create a draft — remaining_payable must now carry the derived net.
    const created = (await db.query<{ out: any }>(
      `select public.create_owner_settlement_draft_atomic($1::jsonb) as out`,
      [JSON.stringify({ owner_id: OWNER, property_id: PROPERTY, period_start: JULY.from, period_end: JULY.to, request_id: 'e2000000-0000-4000-8000-00000000aa01' })],
    )).rows[0]?.out as any;
    const sid = created?.settlement_id as string;
    expect(num(created?.net_payable)).toBe(EXPECTED.net);

    const drafted = await position();
    expect(num(drafted.lifecycle_all_time.settled_pending_net)).toBe(EXPECTED.net);
    expect(num(drafted.lifecycle_all_time.remaining_payable)).toBe(EXPECTED.net);
    expect(num(drafted.lifecycle_all_time.draft_count)).toBe(1);
    // Drill-down: the settlement row is present with its identifiers.
    const row = drafted.settlements.find((s: any) => s.id === sid);
    expect(row).toBeTruthy();
    expect(num(row.net_payable)).toBe(EXPECTED.net);
    expect(num(row.fee_vat)).toBe(EXPECTED.vat);
    expect(row.status).toBe('DRAFT');

    // Approve (maker/checker separation) then pay.
    await assumeIdentity(db, CHECKER, COMPANY);
    await db.query(`select public.approve_owner_settlement_atomic($1::jsonb)`,
      [JSON.stringify({ settlement_id: sid, request_id: 'e2000000-0000-4000-8000-00000000aa02' })]);
    const approved = await position();
    expect(num(approved.lifecycle_all_time.approved_count)).toBe(1);
    expect(num(approved.lifecycle_all_time.remaining_payable)).toBe(EXPECTED.net);

    await db.query(`select public.pay_owner_settlement_atomic($1::jsonb)`,
      [JSON.stringify({ settlement_id: sid, request_id: 'e2000000-0000-4000-8000-00000000aa03', method: 'bank_transfer', payment_reference: 'R2-PAYOUT-1' })]);
    const paid = await position();
    expect(num(paid.lifecycle_all_time.paid_net)).toBe(EXPECTED.net);
    expect(num(paid.lifecycle_all_time.remaining_payable)).toBe(0);
    expect(num(paid.lifecycle_all_time.paid_count)).toBe(1);
    const paidRow = paid.settlements.find((s: any) => s.id === sid);
    expect(paidRow.status).toBe('PAID');
    expect(paidRow.payment_reference).toBe('R2-PAYOUT-1');
    await assumeIdentity(db, ADMIN, COMPANY);
  });

  it('owner funds control reconciles: collections in, payout out, drill-down ids present', async () => {
    const p = await position();
    // +1000 +500 collections, then the PAID settlement appended -1222.5.
    expect(num(p.owner_funds.held)).toBeCloseTo(1500 - EXPECTED.net, 3);
    const payout = p.owner_funds.events.find((e: any) => e.source_type === 'OWNER_SETTLEMENT_PAYOUT');
    expect(payout).toBeTruthy();
    expect(num(payout.amount_delta)).toBeCloseTo(-EXPECTED.net, 3);
    const collectionIds = p.owner_funds.events
      .filter((e: any) => e.source_type === 'OWNER_COLLECTION')
      .map((e: any) => e.source_id)
      .sort();
    expect(collectionIds).toEqual([
      'e2000000-0000-4000-8000-000000000201',
      'e2000000-0000-4000-8000-000000000202',
    ]);
  });

  // Boundary proof: "period" is period-scoped economics, "lifecycle_all_time"
  // is the lifetime settlement position. A settlement from a PREVIOUS period
  // must appear in lifecycle_all_time but never inside period.*.
  it('period vs all-time boundary: a prior-period settlement is all-time lifecycle, not period economics', async () => {
    // A June (previous-period) DRAFT settlement for the owner. Net is
    // non-zero so a naive period mix-in would be observable in period.*.
    await db.query(
      `insert into public.owner_settlements
         (id, owner_id, property_id, status, gross_collected, office_fee, owner_expenses, tax_amount, net_payable,
          period_start, period_end, company_id, created_at)
       values
         ('e2000000-0000-4000-8000-00000000bb01', $1, $3, 'DRAFT', 268.5, 0, 0, 0, 268.5,
          date '2026-06-01', date '2026-06-30', $2, now())`,
      [OWNER, COMPANY, PROPERTY],
    );

    const p = await position(OWNER, JULY.from, JULY.to);

    // period.* remains July-scoped: no June collection, fee, expense or net.
    expect(num(p.period.tenant_collections)).toBe(EXPECTED.gross); // 1500
    expect(num(p.period.net_payable)).toBe(EXPECTED.net);          // 1222.5
    expect(num(p.period.owner_expenses)).toBe(EXPECTED.expenses);  // 120

    // lifecycle_all_time.* is all-time: the June DRAFT is present, and the
    // July settlement paid earlier is lifetime paid history.
    expect(num(p.lifecycle_all_time.settled_pending_net)).toBe(268.5);
    expect(num(p.lifecycle_all_time.draft_count)).toBe(1);
    expect(num(p.lifecycle_all_time.paid_count)).toBe(1);
    expect(num(p.lifecycle_all_time.paid_net)).toBe(EXPECTED.net);
    expect(num(p.lifecycle_all_time.cancelled_count)).toBe(0);
  });
});
