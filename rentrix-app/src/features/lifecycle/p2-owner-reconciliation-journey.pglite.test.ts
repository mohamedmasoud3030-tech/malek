/**
 * P2 reconciliation gate — Unit → Contract → Due Schedule → Collection →
 * Expense → Settlement reconciles with the existing financial engine.
 *
 * Runs the real callable chain on the fully replayed schema:
 *   create_contract_atomic → submit/approve → activate (agreement snapshot)
 *   → generate_invoices_from_active_contracts (due schedule)
 *   → record_invoice_payment_atomic (collection + receipt)
 *   → create_expense_with_journal_atomic (OWNER vs COMPANY responsibility)
 *   → create_owner_settlement_draft_atomic (server-derived settlement)
 *   → approve_owner_settlement_atomic (approval + idempotent replay)
 *
 * and proves the GL (journal_batches/journal_lines + journal_entries) and the
 * settlement amounts agree with the same canonical sources.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'e2000000-0000-4000-8000-000000000001';
const MAKER = 'e2000000-0000-4000-8000-000000000011';
const CHECKER = 'e2000000-0000-4000-8000-000000000012';
const OWNER = 'e2000000-0000-4000-8000-000000000021';
const AGREEMENT = 'e2000000-0000-4000-8000-000000000031';
const VERSION = 'e2000000-0000-4000-8000-000000000041';
const PROPERTY = 'e2000000-0000-4000-8000-000000000051';
const UNIT = 'e2000000-0000-4000-8000-000000000061';
const TENANT = 'e2000000-0000-4000-8000-000000000071';

const RENT = 450;
const FEE_RATE = 10; // percentage on collections (owner agreement RATE)
const OWNER_EXPENSE = 30; // owner-responsibility expense deducted in settlement
const COMPANY_EXPENSE = 20; // office-responsibility expense, never touches the owner

const FEE = (RENT * FEE_RATE) / 100; // 45
const SETTLEMENT_NET = RENT - FEE - OWNER_EXPENSE; // 375

let db: PGlite;
let contractId = '';
let invoiceId = '';

function monthRange() {
  const now = new Date();
  const from = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from, to: iso(to), asOf: iso(now) };
}

async function firstError(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
    return '';
  } catch (error) {
    return String((error as { message?: string })?.message ?? error);
  }
}

/** Net signed balance (debit − credit) of an account `no` across the GL batch
 * ledger (journal_batches/journal_lines) — posted invoices and their likes. */
async function glBatchNet(accountNo: string): Promise<number> {
  const { rows } = await db.query<{ net: string }>(
    `select coalesce(sum(jl.debit - jl.credit), 0)::text as net
       from public.journal_lines jl
       join public.journal_batches jb on jb.id = jl.batch_id
       join public.accounts a on a.id = jl.account_id and a.company_id = jb.company_id
      where jb.company_id = $1::uuid
        and jb.status in ('POSTED', 'REVERSED')
        and a.no = $2`,
    [COMPANY, accountNo],
  );
  return Number(rows[0].net);
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  const { from } = monthRange();

  await db.exec(`
    insert into public.companies (id, name, slug, is_active) values
      ('${COMPANY}', 'شركة بوابة التسوية', 'p2-gate-co', true);
    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MAKER}', 'maker@p2gate.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${CHECKER}', 'checker@p2gate.test', '{"company_id":"${COMPANY}"}'::jsonb);
    insert into public.users (id, email, name, role, status, is_active) values
      ('${MAKER}', 'maker@p2gate.test', 'Maker', 'ADMIN', 'ACTIVE', true),
      ('${CHECKER}', 'checker@p2gate.test', 'Checker', 'ADMIN', 'ACTIVE', true);
    insert into public.company_members (company_id, user_id, role, is_active) values
      ('${COMPANY}', '${MAKER}', 'MANAGER', true),
      ('${COMPANY}', '${CHECKER}', 'MANAGER', true);
    insert into public.company_settings (id, singleton_key, company_name, currency, vat_enabled, vat_rate, company_id)
    values (gen_random_uuid(), true, 'شركة بوابة التسوية', 'OMR', false, 0, '${COMPANY}');
    insert into public.company_tax_profiles
      (id, company_id, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
    values ('e2000000-0000-4000-8000-000000000081', '${COMPANY}', 1, 'NON_TAXABLE', 0, date '2020-01-01', 'ACTIVE', '${MAKER}', '${CHECKER}', now());
    insert into public.company_fee_tax_treatments
      (id, company_id, fee_kind, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
    values ('e2000000-0000-4000-8000-000000000082', '${COMPANY}', 'RATE_MANAGEMENT_FEE', 1, 'NON_TAXABLE', 0, date '2020-01-01', 'ACTIVE', '${MAKER}', '${CHECKER}', now());
    insert into public.owners (id, full_name, name, company_id)
    values ('${OWNER}', 'مالك البوابة', 'مالك البوابة', '${COMPANY}');
    insert into public.properties (id, title, name, type, address, status, company_id)
    values ('${PROPERTY}', 'عقار البوابة', 'عقار البوابة', 'residential', 'Muscat', 'active', '${COMPANY}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('${PROPERTY}', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', ${FEE_RATE}, date '2020-01-01', '${COMPANY}');
    update public.owner_agreement_versions
       set effective_to = date '2019-12-31', superseded_at = now()
     where owner_agreement_id = '${AGREEMENT}'::uuid and superseded_at is null;
    insert into public.owner_agreement_versions
      (id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
       commission_type, commission_value, commission_recognition_basis, offset_allowed,
       reserve_amount, effective_from, effective_to, created_by)
    values ('${VERSION}', '${AGREEMENT}', '${COMPANY}', 2,
       'OWNER_AGENCY', 'OFFICE_IS_CREDITOR', 'RATE', ${FEE_RATE}, 'ON_COLLECTION', false, 0,
       date '2020-01-01', date '2030-12-31', '${MAKER}');
    update public.owner_agreements set current_version_id = '${VERSION}' where id = '${AGREEMENT}';
    insert into public.units (id, property_id, name, unit_number, status, rent_amount, company_id)
    values ('${UNIT}', '${PROPERTY}', 'G-1', 'G-1', 'available', ${RENT}, '${COMPANY}');
    insert into public.people (id, full_name, type, company_id)
    values ('${TENANT}', 'مستأجر البوابة', 'tenant', '${COMPANY}');
  `);

  await assumeIdentity(db, MAKER, COMPANY);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);

  // The contract covers the current month so every generated obligation,
  // collection, expense and settlement lands in one verifiable period.
  const created = (await db.query<{ out: Record<string, unknown> }>(
    `select public.create_contract_atomic(
       $1::text, $2::uuid, $3::uuid, $4::uuid,
       date '${from}', date '2030-12-31',
       ${RENT}, 'monthly', null, 'draft', null, null, null, 1, 0) as out`,
    [PROPERTY, UNIT, TENANT, AGREEMENT],
  )).rows[0]?.out;
  contractId = String(created?.id);

  await db.query(`select public.submit_contract_for_approval_atomic($1::text, 'P2 Gate Maker')`, [contractId]);
  await assumeIdentity(db, CHECKER, COMPANY);
  await db.query(`select public.approve_contract_atomic($1::text, 'P2 Gate Checker')`, [contractId]);
  await assumeIdentity(db, MAKER, COMPANY);
  const activated = (await db.query<{ out: Record<string, unknown> }>(
    `select public.activate_contract_with_agreement_snapshot_atomic($1::text) as out`,
    [contractId],
  )).rows[0]?.out;
  expect(String(activated?.status).toLowerCase()).toBe('active');
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('P2 gate — unit to settlement reconciles with the financial engine', () => {
  it('due schedule: one posted rent invoice for the period, due at month end', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    const { to } = monthRange();
    const generated = (await db.query<{ n: string }>(
      `select public.generate_invoices_from_active_contracts()::text as n`,
    )).rows[0];
    expect(Number(generated.n)).toBe(1);

    const { rows } = await db.query<{
      id: string; amount: string; status: string; document_status: string; due_date: string; charge_type: string;
    }>(
      `select id, amount::text, status, document_status, due_date::text, charge_type
         from public.invoices
        where contract_id::text = $1 and deleted_at is null`,
      [contractId],
    );
    expect(rows).toHaveLength(1);
    invoiceId = rows[0].id;
    expect(Number(rows[0].amount)).toBe(RENT);
    expect(rows[0].charge_type).toBe('RENT');
    expect(rows[0].document_status).toBe('POSTED');
    expect(rows[0].status).toBe('UNPAID');
    expect(rows[0].due_date).toBe(to);
  });

  it('collection: full payment settles the invoice and posts one receipt', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    const { asOf } = monthRange();
    const paid = (await db.query<{ out: Record<string, unknown> }>(
      `select public.record_invoice_payment_atomic($1::jsonb) as out`,
      [JSON.stringify({ invoice_id: invoiceId, amount: RENT, method: 'cash', date: asOf, request_id: 'p2-gate-pay-1' })],
    )).rows[0]?.out;
    expect(Boolean(paid?.success ?? true)).toBe(true);

    const { rows } = await db.query<{ status: string; paid_amount: string }>(
      `select status, paid_amount::text from public.invoices where id::text = $1`,
      [invoiceId],
    );
    expect(rows[0].status).toBe('PAID');
    expect(Number(rows[0].paid_amount)).toBe(RENT);

    const { rows: receipts } = await db.query<{ n: string }>(
      `select count(*)::text as n
         from public.receipts r
        where upper(coalesce(r.status, '')) = 'POSTED'
          and (
            exists (select 1 from public.payments p where p.receipt_id = r.id and p.invoice_id::text = $1)
            or exists (select 1 from public.receipt_allocations ra where ra.receipt_id = r.id and ra.invoice_id::text = $1)
          )`,
      [invoiceId],
    );
    expect(Number(receipts[0].n)).toBe(1);
  });

  it('expense responsibility: OWNER and COMPANY expenses post balanced journals; only OWNER belongs to the owner', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    const { asOf } = monthRange();

    const ownerExpense = (await db.query<{ out: Record<string, unknown> }>(
      `select public.create_expense_with_journal_atomic($1::jsonb) as out`,
      [JSON.stringify({
        request_id: 'p2-gate-exp-owner',
        property_id: PROPERTY,
        category: 'صيانة',
        amount: OWNER_EXPENSE,
        expense_date: asOf,
        charged_to: 'OWNER',
        description: 'إصلاح مكيف على حساب المالك',
      })],
    )).rows[0]?.out;
    expect(Boolean(ownerExpense?.success ?? true)).toBe(true);

    const companyExpense = (await db.query<{ out: Record<string, unknown> }>(
      `select public.create_expense_with_journal_atomic($1::jsonb) as out`,
      [JSON.stringify({
        request_id: 'p2-gate-exp-company',
        property_id: PROPERTY,
        category: 'رسوم حكومية',
        amount: COMPANY_EXPENSE,
        expense_date: asOf,
        charged_to: 'COMPANY',
        description: 'رسوم تجديد على حساب المكتب',
      })],
    )).rows[0]?.out;
    expect(Boolean(companyExpense?.success ?? true)).toBe(true);

    const { rows } = await db.query<{ charged_to: string; status: string; n: string }>(
      `select charged_to, status, count(*)::text as n
         from public.expenses
        where company_id = $1::uuid and deleted_at is null
        group by charged_to, status`,
      [COMPANY],
    );
    const ownerRow = rows.find((row) => row.charged_to === 'OWNER');
    const companyRow = rows.find((row) => row.charged_to === 'COMPANY');
    expect(ownerRow?.status).toBe('POSTED');
    expect(Number(ownerRow?.n)).toBe(1);
    expect(companyRow?.status).toBe('POSTED');
    expect(Number(companyRow?.n)).toBe(1);

    // Every expense posts an exact DEBIT/CREDIT pair (classic ledger): the sum
    // of signed journal_entries for the expense entity is exactly zero.
    const { rows: pairs } = await db.query<{ entity_id: string; net: string }>(
      `select entity_id::text as entity_id,
              coalesce(sum(case when type = 'DEBIT' then amount else -amount end), 0)::text as net
         from public.journal_entries
        where company_id = $1::uuid and entity_type = 'expense'
        group by entity_id`,
      [COMPANY],
    );
    expect(pairs).toHaveLength(2);
    for (const pair of pairs) expect(Number(pair.net)).toBe(0);
  });

  it('settlement: server-derived amounts reserve exactly the collected payment and the OWNER expense', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    const { from, to } = monthRange();
    const draft = (await db.query<{ out: Record<string, unknown> }>(
      `select public.create_owner_settlement_draft_atomic($1::jsonb) as out`,
      [JSON.stringify({
        request_id: 'e2000000-0000-4000-8000-000000000101',
        owner_id: OWNER,
        property_id: PROPERTY,
        period_start: from,
        period_end: to,
        notes: 'تسوية بوابة P2',
      })],
    )).rows[0]?.out;

    expect(String(draft?.status)).toBe('DRAFT');
    expect(String(draft?.amounts_source)).toBe('server_derived');
    expect(Number(draft?.net_payable)).toBe(SETTLEMENT_NET);
    expect(Number(draft?.reserved_payments)).toBe(1);
    expect(Number(draft?.reserved_expenses)).toBe(1);

    const { rows } = await db.query<{
      gross_collected: string; office_fee: string; owner_expenses: string; tax_amount: string; net_payable: string; status: string;
    }>(
      `select gross_collected::text, office_fee::text, owner_expenses::text, tax_amount::text, net_payable::text, status
         from public.owner_settlements
        where company_id = $1::uuid and owner_id::text = $2
        order by created_at desc limit 1`,
      [COMPANY, OWNER],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].gross_collected)).toBe(RENT);
    expect(Number(rows[0].office_fee)).toBe(FEE);
    // Only the OWNER-responsibility expense is deducted; the office one never
    // reaches the owner's settlement.
    expect(Number(rows[0].owner_expenses)).toBe(OWNER_EXPENSE);
    expect(Number(rows[0].tax_amount)).toBe(0);
    expect(Number(rows[0].net_payable)).toBe(SETTLEMENT_NET);
    expect(rows[0].status).toBe('DRAFT');
  });

  it('approval: settlement moves to APPROVED and replays idempotently; duplicate periods stay rejected', async () => {
    const { from, to } = monthRange();
    const { rows: drafts } = await db.query<{ id: string }>(
      `select id::text as id from public.owner_settlements
        where company_id = $1::uuid and owner_id::text = $2 and status = 'DRAFT'`,
      [COMPANY, OWNER],
    );
    expect(drafts).toHaveLength(1);
    const settlementId = drafts[0].id;

    // The maker cannot approve their own settlement (maker-checker).
    const selfApproval = await firstError(() => db.query(
      `select public.approve_owner_settlement_atomic($1::jsonb)`,
      [JSON.stringify({ settlement_id: settlementId, request_id: 'e2000000-0000-4000-8000-000000000104' })],
    ));
    expect(selfApproval).toMatch(/MAKER_CHECKER_SELF_APPROVAL_DENIED/i);

    await assumeIdentity(db, CHECKER, COMPANY);
    const approved = (await db.query<{ out: Record<string, unknown> }>(
      `select public.approve_owner_settlement_atomic($1::jsonb) as out`,
      [JSON.stringify({ settlement_id: settlementId, request_id: 'e2000000-0000-4000-8000-000000000102' })],
    )).rows[0]?.out;
    expect(String(approved?.status)).toBe('APPROVED');
    expect(Number(approved?.net_payable)).toBe(SETTLEMENT_NET);
    expect(Boolean(approved?.idempotent ?? false)).toBe(false);

    // Idempotent replay of the same approval request.
    const replayed = (await db.query<{ out: Record<string, unknown> }>(
      `select public.approve_owner_settlement_atomic($1::jsonb) as out`,
      [JSON.stringify({ settlement_id: settlementId, request_id: 'e2000000-0000-4000-8000-000000000102' })],
    )).rows[0]?.out;
    expect(String(replayed?.status)).toBe('APPROVED');
    expect(Boolean(replayed?.idempotent)).toBe(true);

    const { rows: statuses } = await db.query<{ n: string }>(
      `select count(*)::text as n from public.owner_settlements
        where id::text = $1 and status = 'APPROVED'`,
      [settlementId],
    );
    expect(Number(statuses[0].n)).toBe(1);

    // The reserved items are still locked to this settlement: a second draft
    // for the same owner/property/period is rejected.
    const duplicate = await firstError(() => db.query(
      `select public.create_owner_settlement_draft_atomic($1::jsonb)`,
      [JSON.stringify({
        request_id: 'e2000000-0000-4000-8000-000000000103',
        owner_id: OWNER,
        property_id: PROPERTY,
        period_start: from,
        period_end: to,
      })],
    ));
    expect(duplicate).toMatch(/active settlement already exists/i);
  });

  it('ledger reconciliation: the GL agrees with the settlement to the last baisa', async () => {
    // Invoice posting (OFFICE_IS_CREDITOR) + collection both live in the batch
    // ledger: Dr 1201 AR at issue, Cr 1201 at collection → AR fully settled.
    expect(await glBatchNet('1201')).toBe(0);

    // Cash position: Dr 1111 from the collection minus Cr 1111 for the two
    // office-paid expenses (their journal_entries pairs mirror into the batch
    // ledger, so the batch ledger is the single authoritative view).
    expect(await glBatchNet('1111')).toBe(RENT - OWNER_EXPENSE - COMPANY_EXPENSE);

    // Fee revenue recognized on collection (RATE 10%): Dr 2000 / Cr 4100.
    expect(await glBatchNet('4100')).toBe(-FEE);

    // Expense account carries both responsibilities' costs.
    expect(await glBatchNet('6100')).toBe(OWNER_EXPENSE + COMPANY_EXPENSE);

    // Owner payable per GL = gross − recognized fee (invoice Cr 2000, fee Dr 2000).
    const glOwnerPayable = -(await glBatchNet('2000'));
    expect(glOwnerPayable).toBe(RENT - FEE);

    // Reconciliation identity: GL owner payable minus the settlement net
    // payable equals exactly the owner-responsibility expenses deducted in the
    // settlement (they were paid in office cash and recovered from the owner).
    const { rows } = await db.query<{ net_payable: string; owner_expenses: string }>(
      `select net_payable::text, owner_expenses::text from public.owner_settlements
        where company_id = $1::uuid and owner_id::text = $2 and status = 'APPROVED'`,
      [COMPANY, OWNER],
    );
    expect(glOwnerPayable - Number(rows[0].net_payable)).toBe(Number(rows[0].owner_expenses));
    expect(glOwnerPayable - Number(rows[0].net_payable)).toBe(OWNER_EXPENSE);
  });
});
