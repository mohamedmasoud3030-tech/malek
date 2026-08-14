import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../p1/replay-bootstrap';

/**
 * WP-02 / GAP-009 — governed deposit lifecycle test matrix (A–V):
 * receipt, OFFICE/OWNER arrears application with invoice subledger parity,
 * damage beneficiary routing, fail-closed evidence/approval/maker-checker,
 * cross-company isolation, over-application guards, idempotency, partial/full
 * refunds, compensating reversals, period resolution, legacy bypass closure,
 * OMR 3dp precision and 2200 control reconciliation.
 */

const C1 = 'c5000000-0000-4000-8000-000000000001';
const C2 = 'c5000000-0000-4000-8000-000000000002';
const MAKER = 'a5000000-0000-4000-8000-000000000001';
const CHECKER = 'a5000000-0000-4000-8000-000000000002';
const ACCOUNTANT = 'a5000000-0000-4000-8000-000000000003';
const OUTSIDER = 'a5000000-0000-4000-8000-000000000004';
const OWNER = '05000000-0000-4000-8000-000000000001';

const P_OFFICE = '05000000-0000-4000-8000-000000000011';
const P_OWNER = '05000000-0000-4000-8000-000000000012';
const P_DMG_OWNER = '05000000-0000-4000-8000-000000000013';
const P_DMG_OFFICE = '05000000-0000-4000-8000-000000000014';
const P_DMG_MISSING = '05000000-0000-4000-8000-000000000015';
const P_PERIOD = '05000000-0000-4000-8000-000000000016';

const AGR_OFFICE = '05000000-0000-4000-8000-000000000021';
const AGR_OWNER = '05000000-0000-4000-8000-000000000022';
const AGR_DMG_OWNER = '05000000-0000-4000-8000-000000000023';
const AGR_DMG_OFFICE = '05000000-0000-4000-8000-000000000024';
const AGR_DMG_MISSING = '05000000-0000-4000-8000-000000000025';
const AGR_PERIOD = '05000000-0000-4000-8000-000000000026';

const V_OFFICE = '15000000-0000-4000-8000-000000000001';
const V_OWNER = '15000000-0000-4000-8000-000000000002';
const V_DMG_OWNER = '15000000-0000-4000-8000-000000000003';
const V_DMG_OFFICE = '15000000-0000-4000-8000-000000000004';
const V_DMG_MISSING = '15000000-0000-4000-8000-000000000005';
const V_PERIOD = '15000000-0000-4000-8000-000000000006';

const TENANT = '05000000-0000-4000-8000-000000000032';

const C_OFFICE = '05000000-0000-4000-8000-000000000041';
const C_OWNER = '05000000-0000-4000-8000-000000000042';
const C_DMG_OWNER = '05000000-0000-4000-8000-000000000043';
const C_DMG_OFFICE = '05000000-0000-4000-8000-000000000044';
const C_DMG_MISSING = '05000000-0000-4000-8000-000000000045';
const C_PERIOD = '05000000-0000-4000-8000-000000000046';

const INV_OFFICE = '05000000-0000-4000-8000-000000000051';
const INV_OWNER = '05000000-0000-4000-8000-000000000052';
const INV_PERIOD = '05000000-0000-4000-8000-000000000053';

let db: PGlite;

async function rpc(name: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { rows } = await db.query<{ value: string }>(
    `select public.${name}($1::jsonb)::text as value`,
    [JSON.stringify(payload)],
  );
  return JSON.parse(rows[0]?.value ?? '{}') as Record<string, unknown>;
}

/** GL control balance in normal direction (liability = credit - debit), POSTED+REVERSED, OMR 3dp. */
async function gl(accountNo: string): Promise<number> {
  const { rows } = await db.query<{ value: string }>(
    `select public.wp05_gl_balance($1::uuid, $2)::text as value`,
    [C1, accountNo],
  );
  return Number(rows[0]?.value ?? 0);
}

async function depositRow(depositId: string) {
  const { rows } = await db.query(
    `select deposit_amount::text as deposit_amount, deducted_amount::text as deducted_amount,
            refunded_amount::text as refunded_amount, remaining_amount::text as remaining_amount,
            status
       from public.tenant_deposits
      where id::text = $1 and company_id = $2::uuid`,
    [depositId, C1],
  );
  const r = rows[0] as Record<string, string> | undefined;
  return r
    ? {
        deposit_amount: Number(r.deposit_amount),
        deducted_amount: Number(r.deducted_amount),
        refunded_amount: Number(r.refunded_amount),
        remaining_amount: Number(r.remaining_amount),
        status: r.status,
      }
    : null;
}

async function invoiceRow(invoiceId: string) {
  const { rows } = await db.query(
    `select paid_amount::text as paid_amount, status from public.invoices
      where id::text = $1 and company_id = $2::uuid`,
    [invoiceId, C1],
  );
  const r = rows[0] as Record<string, string> | undefined;
  return r ? { paid_amount: Number(r.paid_amount), status: r.status } : null;
}

/** Deposit subledger total for C1 vs GL 2200. */
async function assert2200Reconciled(label: string, tolerance = 0.001) {
  const { rows } = await db.query<{ value: string }>(
    `select coalesce(sum(remaining_amount), 0)::text as value
       from public.tenant_deposits
      where company_id = $1::uuid and deleted_at is null`,
    [C1],
  );
  const subledger = Number(rows[0]?.value ?? 0);
  const control = await gl('2200');
  expect(Math.abs(subledger - control), `${label}: deposit subledger ${subledger} vs GL 2200 ${control}`).toBeLessThanOrEqual(tolerance);
  return { subledger, control };
}

let depositOffice: string;
let depositOwner: string;
let depositDmgOwner: string;
let depositDmgOffice: string;
let depositPrecision: string;

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug, timezone) values
      ('${C1}', 'GAP-009 Company', 'gap-009-company', 'Asia/Muscat'),
      ('${C2}', 'GAP-009 Other', 'gap-009-other', 'Asia/Muscat');

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MAKER}', 'maker@gap009.test', '{"company_id":"${C1}"}'::jsonb),
      ('${CHECKER}', 'checker@gap009.test', '{"company_id":"${C1}"}'::jsonb),
      ('${ACCOUNTANT}', 'acct@gap009.test', '{"company_id":"${C1}"}'::jsonb),
      ('${OUTSIDER}', 'outsider@gap009.test', '{"company_id":"${C2}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${MAKER}', 'maker@gap009.test', 'Maker', 'ADMIN', 'ACTIVE', true),
      ('${CHECKER}', 'checker@gap009.test', 'Checker', 'ADMIN', 'ACTIVE', true),
      ('${ACCOUNTANT}', 'acct@gap009.test', 'Acct', 'ACCOUNTANT', 'ACTIVE', true),
      ('${OUTSIDER}', 'outsider@gap009.test', 'Outsider', 'ADMIN', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role) values
      ('${C1}', '${MAKER}', 'ADMIN'),
      ('${C1}', '${CHECKER}', 'ADMIN'),
      ('${C1}', '${ACCOUNTANT}', 'ADMIN'),
      ('${C2}', '${OUTSIDER}', 'ADMIN');

    insert into public.owners (id, full_name, name, company_id) values
      ('${OWNER}', 'GAP Owner', 'GAP Owner', '${C1}');

    insert into public.properties (id, title, name, type, address, company_id) values
      ('${P_OFFICE}', 'Office Credit', 'Office Credit', 'residential', 'Muscat', '${C1}'),
      ('${P_OWNER}', 'Owner Credit', 'Owner Credit', 'residential', 'Muscat', '${C1}'),
      ('${P_DMG_OWNER}', 'Dmg Owner', 'Dmg Owner', 'residential', 'Muscat', '${C1}'),
      ('${P_DMG_OFFICE}', 'Dmg Office', 'Dmg Office', 'residential', 'Muscat', '${C1}'),
      ('${P_DMG_MISSING}', 'Dmg Missing', 'Dmg Missing', 'residential', 'Muscat', '${C1}'),
      ('${P_PERIOD}', 'Period', 'Period', 'residential', 'Muscat', '${C1}');

    insert into public.property_owners
      (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id) values
      ('${P_OFFICE}', '${OWNER}', 100, true, date '2026-01-01', '${C1}'),
      ('${P_OWNER}', '${OWNER}', 100, true, date '2026-01-01', '${C1}'),
      ('${P_DMG_OWNER}', '${OWNER}', 100, true, date '2026-01-01', '${C1}'),
      ('${P_DMG_OFFICE}', '${OWNER}', 100, true, date '2026-01-01', '${C1}'),
      ('${P_DMG_MISSING}', '${OWNER}', 100, true, date '2026-01-01', '${C1}'),
      ('${P_PERIOD}', '${OWNER}', 100, true, date '2026-01-01', '${C1}');

    insert into public.owner_agreements
      (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id) values
      ('${AGR_OFFICE}', '${OWNER}', '${P_OFFICE}', 'property_management', 'RATE', 10, date '2026-01-01', '${C1}'),
      ('${AGR_OWNER}', '${OWNER}', '${P_OWNER}', 'property_management', 'RATE', 10, date '2026-01-01', '${C1}'),
      ('${AGR_DMG_OWNER}', '${OWNER}', '${P_DMG_OWNER}', 'property_management', 'RATE', 10, date '2026-01-01', '${C1}'),
      ('${AGR_DMG_OFFICE}', '${OWNER}', '${P_DMG_OFFICE}', 'property_management', 'RATE', 10, date '2026-01-01', '${C1}'),
      ('${AGR_DMG_MISSING}', '${OWNER}', '${P_DMG_MISSING}', 'property_management', 'RATE', 10, date '2026-01-01', '${C1}'),
      ('${AGR_PERIOD}', '${OWNER}', '${P_PERIOD}', 'property_management', 'RATE', 10, date '2026-01-01', '${C1}');

    insert into public.owner_agreement_versions
      (id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
       commission_type, commission_value, commission_recognition_basis, offset_allowed,
       reserve_amount, deposit_beneficiary, effective_from, effective_to, created_by)
    values
      ('${V_OFFICE}', '${AGR_OFFICE}', '${C1}', 1, 'OWNER_AGENCY', 'OFFICE_IS_CREDITOR',
       'RATE', 10, 'ON_COLLECTION', false, 0, 'OFFICE', date '2026-01-01', null, '${MAKER}'),
      ('${V_OWNER}', '${AGR_OWNER}', '${C1}', 1, 'OWNER_AGENCY', 'OWNER_IS_CREDITOR',
       'RATE', 10, 'ON_COLLECTION', false, 0, 'OFFICE', date '2026-01-01', null, '${MAKER}'),
      ('${V_DMG_OWNER}', '${AGR_DMG_OWNER}', '${C1}', 1, 'OWNER_AGENCY', 'OWNER_IS_CREDITOR',
       'RATE', 10, 'ON_COLLECTION', false, 0, 'OWNER', date '2026-01-01', null, '${MAKER}'),
      ('${V_DMG_OFFICE}', '${AGR_DMG_OFFICE}', '${C1}', 1, 'OWNER_AGENCY', 'OWNER_IS_CREDITOR',
       'RATE', 10, 'ON_COLLECTION', false, 0, 'OFFICE', date '2026-01-01', null, '${MAKER}'),
      ('${V_DMG_MISSING}', '${AGR_DMG_MISSING}', '${C1}', 1, 'OWNER_AGENCY', 'OWNER_IS_CREDITOR',
       'RATE', 10, 'ON_COLLECTION', false, 0, null, date '2026-01-01', null, '${MAKER}'),
      ('${V_PERIOD}', '${AGR_PERIOD}', '${C1}', 1, 'OWNER_AGENCY', 'OWNER_IS_CREDITOR',
       'RATE', 10, 'ON_COLLECTION', false, 0, 'OFFICE', date '2026-01-01', null, '${MAKER}');

    update public.owner_agreements set current_version_id = '${V_OFFICE}' where id = '${AGR_OFFICE}';
    update public.owner_agreements set current_version_id = '${V_OWNER}' where id = '${AGR_OWNER}';
    update public.owner_agreements set current_version_id = '${V_DMG_OWNER}' where id = '${AGR_DMG_OWNER}';
    update public.owner_agreements set current_version_id = '${V_DMG_OFFICE}' where id = '${AGR_DMG_OFFICE}';
    update public.owner_agreements set current_version_id = '${V_DMG_MISSING}' where id = '${AGR_DMG_MISSING}';
    update public.owner_agreements set current_version_id = '${V_PERIOD}' where id = '${AGR_PERIOD}';

    insert into public.units (id, property_id, name, unit_number, company_id) values
      ('05000000-0000-4000-8000-000000000031', '${P_OFFICE}', 'Unit 1', 'U-1', '${C1}'),
      ('05000000-0000-4000-8000-000000000033', '${P_OWNER}', 'Unit 2', 'U-2', '${C1}'),
      ('05000000-0000-4000-8000-000000000034', '${P_DMG_OWNER}', 'Unit 3', 'U-3', '${C1}'),
      ('05000000-0000-4000-8000-000000000035', '${P_DMG_OFFICE}', 'Unit 4', 'U-4', '${C1}'),
      ('05000000-0000-4000-8000-000000000036', '${P_DMG_MISSING}', 'Unit 5', 'U-5', '${C1}'),
      ('05000000-0000-4000-8000-000000000037', '${P_PERIOD}', 'Unit 6', 'U-6', '${C1}');

    insert into public.people (id, full_name, type, company_id) values
      ('${TENANT}', 'GAP Tenant', 'tenant', '${C1}');

    insert into public.contracts
      (id, property_id, unit_id, tenant_id, agreement_id, agreement_version_id,
       collection_role_snapshot, operating_model_snapshot,
       start_date, end_date, rent_amount, status, company_id) values
      ('${C_OFFICE}', '${P_OFFICE}', '05000000-0000-4000-8000-000000000031', '${TENANT}', '${AGR_OFFICE}', '${V_OFFICE}',
       'OFFICE_IS_CREDITOR', 'OWNER_AGENCY', date '2026-01-01', date '2026-12-31', 1000, 'active', '${C1}'),
      ('${C_OWNER}', '${P_OWNER}', '05000000-0000-4000-8000-000000000033', '${TENANT}', '${AGR_OWNER}', '${V_OWNER}',
       'OWNER_IS_CREDITOR', 'OWNER_AGENCY', date '2026-01-01', date '2026-12-31', 1000, 'active', '${C1}'),
      ('${C_DMG_OWNER}', '${P_DMG_OWNER}', '05000000-0000-4000-8000-000000000034', '${TENANT}', '${AGR_DMG_OWNER}', '${V_DMG_OWNER}',
       'OWNER_IS_CREDITOR', 'OWNER_AGENCY', date '2026-01-01', date '2026-12-31', 1000, 'active', '${C1}'),
      ('${C_DMG_OFFICE}', '${P_DMG_OFFICE}', '05000000-0000-4000-8000-000000000035', '${TENANT}', '${AGR_DMG_OFFICE}', '${V_DMG_OFFICE}',
       'OWNER_IS_CREDITOR', 'OWNER_AGENCY', date '2026-01-01', date '2026-12-31', 1000, 'active', '${C1}'),
      ('${C_DMG_MISSING}', '${P_DMG_MISSING}', '05000000-0000-4000-8000-000000000036', '${TENANT}', '${AGR_DMG_MISSING}', '${V_DMG_MISSING}',
       'OWNER_IS_CREDITOR', 'OWNER_AGENCY', date '2026-01-01', date '2026-12-31', 1000, 'active', '${C1}'),
      ('${C_PERIOD}', '${P_PERIOD}', '05000000-0000-4000-8000-000000000037', '${TENANT}', '${AGR_PERIOD}', '${V_PERIOD}',
       'OWNER_IS_CREDITOR', 'OWNER_AGENCY', date '2026-01-01', date '2026-12-31', 1000, 'active', '${C1}');

    insert into public.invoices
      (id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, status, company_id) values
      ('${INV_OFFICE}', '${C_OFFICE}', date '2026-07-01', date '2026-07-31', 1000, 0, 0, 'UNPAID', '${C1}'),
      ('${INV_OWNER}', '${C_OWNER}', date '2026-07-01', date '2026-07-31', 1000, 0, 0, 'UNPAID', '${C1}'),
      ('${INV_PERIOD}', '${C_PERIOD}', date '2026-06-01', date '2026-06-30', 800, 0, 0, 'UNPAID', '${C1}');

    insert into public.accounting_periods (company_id, name, start_date, end_date, status, closed_at) values
      ('${C1}', '2026 Jun hard', date '2026-06-01', date '2026-06-30', 'HARD_CLOSED', now()),
      ('${C1}', '2026 Jul open', date '2026-07-01', date '2026-07-31', 'OPEN', null);
  `);

  await assumeIdentity(db, MAKER, C1);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [C1]);

  // ── A. Deposit receipt 200.000
  const created = await rpc('create_deposit_atomic', {
    contract_id: C_OFFICE,
    tenant_id: TENANT,
    property_id: P_OFFICE,
    unit_id: '05000000-0000-4000-8000-000000000031',
    amount: 200,
    received_date: '2026-07-01',
    request_id: 'gap009-dep-office-1',
  });
  depositOffice = String(created.deposit_id);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('WP-02 GAP-009 governed deposit lifecycle', () => {
  it('A. receipt posts 200.000 to 2200, batch-links the held transaction, and the log is immutable', async () => {
    await assumeIdentity(db, MAKER, C1);
    expect(await gl('2200')).toBe(200);
    const dep = await depositRow(depositOffice);
    expect(dep?.remaining_amount).toBe(200);
    expect(dep?.status).toBe('held');

    const { rows } = await db.query<{ batch: string | null }>(
      `select journal_batch_id::text as batch from public.deposit_transactions
        where deposit_id = $1 and company_id = $2::uuid and type = 'held'`,
      [depositOffice, C1],
    );
    expect(rows[0]?.batch).toBeTruthy();

    await expect(
      db.query(`update public.deposit_transactions set amount = 1 where company_id = $1::uuid`, [C1]),
    ).rejects.toMatchObject({ code: '55000' });
    await expect(
      db.query(`delete from public.deposit_transactions where company_id = $1::uuid`, [C1]),
    ).rejects.toMatchObject({ code: '55000' });

    await assert2200Reconciled('A');
  });

  it('B. OFFICE_IS_CREDITOR arrears: claim→approve→apply settles GL 1201 AND the invoice subledger; reversal restores both', async () => {
    await assumeIdentity(db, MAKER, C1);

    const created = await rpc('create_deposit_atomic', {
      contract_id: C_OFFICE,
      amount: 500,
      received_date: '2026-07-02',
      request_id: 'gap009-dep-office-2',
    });
    const depositId = String(created.deposit_id);

    const claim = await rpc('create_deposit_application_claim_atomic', {
      request_id: 'gap009-claim-b-1',
      deposit_id: depositId,
      claim_kind: 'INVOICE_ARREARS',
      invoice_id: INV_OFFICE,
      allocation_amount: 300,
      evidence_uri: 'evidence://gap009/claim-b',
      claim_note: 'arrears application',
    });
    expect(claim.status).toBe('PENDING');
    expect(claim.target_type).toBe('rent_arrears');
    const claimId = String(claim.claim_id);

    // Maker cannot approve their own claim.
    await expect(
      rpc('approve_deposit_application_claim_atomic', { claim_id: claimId }),
    ).rejects.toMatchObject({ code: '42501' });

    await assumeIdentity(db, CHECKER, C1);
    const approved = await rpc('approve_deposit_application_claim_atomic', { claim_id: claimId });
    expect(approved.status).toBe('APPROVED');

    await assumeIdentity(db, MAKER, C1);
    const applied = await rpc('apply_deposit_claim_atomic', {
      claim_id: claimId,
      request_id: 'gap009-apply-b-1',
      effective_date: '2026-07-10',
    });
    expect(applied.status).toBe('APPLIED');
    expect(applied.target_account_no).toBe('1201');

    // GL: 2200 = A200 + B500 - 300 = 400; 1201 credit 300 (asset balance -300).
    expect(await gl('2200')).toBe(400);
    expect(await gl('1201')).toBe(-300);
    const dep = await depositRow(depositId);
    expect(dep?.remaining_amount).toBe(200);
    expect(dep?.status).toBe('partially_deducted');

    // Invoice subledger parity: paid_amount 300, PARTIALLY_PAID.
    const inv = await invoiceRow(INV_OFFICE);
    expect(inv?.paid_amount).toBe(300);
    expect(inv?.status).toBe('PARTIALLY_PAID');

    await assert2200Reconciled('B applied');

    // Reversal restores GL, deposit and invoice atomically.
    await assumeIdentity(db, MAKER, C1);
    const reversed = await rpc('reverse_deposit_claim_atomic', {
      claim_id: claimId,
      request_id: 'gap009-reverse-b-1',
      reason: 'claim reversal test',
    });
    expect(reversed.status).toBe('REVERSED');

    expect(await gl('2200')).toBe(700);
    expect(await gl('1201')).toBe(0);
    const depAfter = await depositRow(depositId);
    expect(depAfter?.remaining_amount).toBe(500);
    expect(depAfter?.status).toBe('held');
    const invAfter = await invoiceRow(INV_OFFICE);
    expect(invAfter?.paid_amount).toBe(0);
    // Canonical status recomputation: the unpaid invoice is now past due.
    expect(invAfter?.status).toBe('OVERDUE');

    // Reversal transaction is batch-linked and references the original.
    const { rows } = await db.query<{ batch: string | null; of: string | null }>(
      `select journal_batch_id::text as batch, reversal_of_id::text as of
         from public.deposit_transactions
        where deposit_id = $1 and company_id = $2::uuid and type = 'reversal'`,
      [depositId, C1],
    );
    expect(rows[0]?.batch).toBeTruthy();
    expect(rows[0]?.of).toBeTruthy();

    await assert2200Reconciled('B reversed');
  });

  it('C. OWNER_IS_CREDITOR arrears: Dr2200/Cr2000 with no 1201 or invoice effect', async () => {
    await assumeIdentity(db, MAKER, C1);

    const created = await rpc('create_deposit_atomic', {
      contract_id: C_OWNER,
      amount: 400,
      received_date: '2026-07-03',
      request_id: 'gap009-dep-owner-1',
    });
    depositOwner = String(created.deposit_id);

    // NOTE: deposits so far: A (200) + B deposit (500, held after reversal) + C (400) = 1100.
    const glBefore = await gl('2200');

    const claim = await rpc('create_deposit_application_claim_atomic', {
      request_id: 'gap009-claim-c-1',
      deposit_id: depositOwner,
      claim_kind: 'INVOICE_ARREARS',
      invoice_id: INV_OWNER,
      allocation_amount: 300,
      evidence_uri: 'evidence://gap009/claim-c',
    });
    expect(claim.target_type).toBe('owner_arrears');
    const claimId = String(claim.claim_id);

    await assumeIdentity(db, CHECKER, C1);
    await rpc('approve_deposit_application_claim_atomic', { claim_id: claimId });
    await assumeIdentity(db, MAKER, C1);
    await rpc('apply_deposit_claim_atomic', {
      claim_id: claimId,
      request_id: 'gap009-apply-c-1',
      effective_date: '2026-07-11',
    });

    expect(await gl('2200')).toBe(glBefore - 300);
    expect(await gl('2000')).toBe(300); // liability normal direction
    expect(await gl('1201')).toBe(0); // no incorrect 1201 effect
    const dep = await depositRow(depositOwner);
    expect(dep?.remaining_amount).toBe(100);
    const inv = await invoiceRow(INV_OWNER);
    expect(inv?.paid_amount).toBe(0); // operational tenant AR untouched (FIN-003)

    await assert2200Reconciled('C');
  });

  it('D. damage beneficiary OWNER: Dr2200/Cr2000', async () => {
    await assumeIdentity(db, MAKER, C1);

    const created = await rpc('create_deposit_atomic', {
      contract_id: C_DMG_OWNER,
      amount: 250,
      received_date: '2026-07-04',
      request_id: 'gap009-dep-dmg-owner-1',
    });
    depositDmgOwner = String(created.deposit_id);
    const glBefore = await gl('2200');

    const claim = await rpc('create_deposit_application_claim_atomic', {
      request_id: 'gap009-claim-d-1',
      deposit_id: depositDmgOwner,
      claim_kind: 'DAMAGE',
      allocation_amount: 100,
      evidence_uri: 'evidence://gap009/claim-d',
    });
    expect(claim.target_type).toBe('damage');
    const claimId = String(claim.claim_id);

    await assumeIdentity(db, CHECKER, C1);
    await rpc('approve_deposit_application_claim_atomic', { claim_id: claimId });
    await assumeIdentity(db, MAKER, C1);
    await rpc('apply_deposit_claim_atomic', {
      claim_id: claimId,
      request_id: 'gap009-apply-d-1',
      effective_date: '2026-07-12',
    });

    expect(await gl('2200')).toBe(glBefore - 100);
    expect(await gl('2000')).toBe(400); // 300 (C) + 100 (D)
    expect(await gl('4300')).toBe(0);
    expect((await depositRow(depositDmgOwner))?.remaining_amount).toBe(150);
    await assert2200Reconciled('D');
  });

  it('E. damage beneficiary OFFICE: Dr2200/Cr4300', async () => {
    await assumeIdentity(db, MAKER, C1);

    const created = await rpc('create_deposit_atomic', {
      contract_id: C_DMG_OFFICE,
      amount: 250,
      received_date: '2026-07-05',
      request_id: 'gap009-dep-dmg-office-1',
    });
    depositDmgOffice = String(created.deposit_id);
    const glBefore = await gl('2200');

    const claim = await rpc('create_deposit_application_claim_atomic', {
      request_id: 'gap009-claim-e-1',
      deposit_id: depositDmgOffice,
      claim_kind: 'DAMAGE',
      allocation_amount: 90,
      evidence_uri: 'evidence://gap009/claim-e',
    });
    const claimId = String(claim.claim_id);

    await assumeIdentity(db, CHECKER, C1);
    await rpc('approve_deposit_application_claim_atomic', { claim_id: claimId });
    await assumeIdentity(db, MAKER, C1);
    await rpc('apply_deposit_claim_atomic', {
      claim_id: claimId,
      request_id: 'gap009-apply-e-1',
      effective_date: '2026-07-13',
    });

    expect(await gl('2200')).toBe(glBefore - 90);
    expect(await gl('4300')).toBe(90);
    expect(await gl('2000')).toBe(400); // unchanged by E
    expect((await depositRow(depositDmgOffice))?.remaining_amount).toBe(160);
    await assert2200Reconciled('E');
  });

  it('F. missing/ambiguous damage beneficiary fails closed at claim creation', async () => {
    await assumeIdentity(db, MAKER, C1);
    const created = await rpc('create_deposit_atomic', {
      contract_id: C_DMG_MISSING,
      amount: 100,
      received_date: '2026-07-06',
      request_id: 'gap009-dep-dmg-missing-1',
    });
    const depositId = String(created.deposit_id);

    await expect(
      rpc('create_deposit_application_claim_atomic', {
        request_id: 'gap009-claim-f-1',
        deposit_id: depositId,
        claim_kind: 'DAMAGE',
        allocation_amount: 50,
        evidence_uri: 'evidence://gap009/claim-f',
      }),
    ).rejects.toThrow(/DEPOSIT_CLAIM_DAMAGE_BENEFICIARY_MISSING/);
  });

  it('G. missing evidence fails closed', async () => {
    await assumeIdentity(db, MAKER, C1);
    await expect(
      rpc('create_deposit_application_claim_atomic', {
        request_id: 'gap009-claim-g-1',
        deposit_id: depositOffice,
        claim_kind: 'DAMAGE',
        allocation_amount: 10,
      }),
    ).rejects.toThrow(/EVIDENCE_REQUIRED/);
  });

  it('H. unapproved claim has no economic effect', async () => {
    await assumeIdentity(db, MAKER, C1);
    const glBefore = await gl('2200');
    const claim = await rpc('create_deposit_application_claim_atomic', {
      request_id: 'gap009-claim-h-1',
      deposit_id: depositOffice,
      claim_kind: 'DAMAGE',
      allocation_amount: 10,
      evidence_uri: 'evidence://gap009/claim-h',
    });
    const claimId = String(claim.claim_id);
    await expect(
      rpc('apply_deposit_claim_atomic', {
        claim_id: claimId,
        request_id: 'gap009-apply-h-1',
        effective_date: '2026-07-14',
      }),
    ).rejects.toThrow(/APPROVED_CLAIM_REQUIRED/);
    expect(await gl('2200')).toBe(glBefore);
    expect((await depositRow(depositOffice))?.remaining_amount).toBe(200);
    await assert2200Reconciled('H');
  });

  it('J. cross-company claim creation and approval are rejected', async () => {
    await assumeIdentity(db, OUTSIDER, C2);
    await expect(
      rpc('create_deposit_application_claim_atomic', {
        request_id: 'gap009-claim-j-1',
        deposit_id: depositOffice,
        claim_kind: 'DAMAGE',
        allocation_amount: 10,
        evidence_uri: 'evidence://gap009/claim-j',
      }),
    ).rejects.toMatchObject({ code: '42501' });

    await assumeIdentity(db, MAKER, C1);
    const claim = await rpc('create_deposit_application_claim_atomic', {
      request_id: 'gap009-claim-j-2',
      deposit_id: depositOffice,
      claim_kind: 'DAMAGE',
      allocation_amount: 10,
      evidence_uri: 'evidence://gap009/claim-j2',
    });
    const claimId = String(claim.claim_id);
    await assumeIdentity(db, OUTSIDER, C2);
    await expect(
      rpc('approve_deposit_application_claim_atomic', { claim_id: claimId }),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      rpc('apply_deposit_claim_atomic', {
        claim_id: claimId,
        request_id: 'gap009-apply-j-1',
        effective_date: '2026-07-14',
      }),
    ).rejects.toMatchObject({ code: '42501' });
    await assumeIdentity(db, MAKER, C1);
  });

  it('K. application exceeding remaining deposit balance is rejected', async () => {
    await assumeIdentity(db, MAKER, C1);
    const claim = await rpc('create_deposit_application_claim_atomic', {
      request_id: 'gap009-claim-k-1',
      deposit_id: depositOffice, // remaining 200
      claim_kind: 'DAMAGE',
      allocation_amount: 250,
      evidence_uri: 'evidence://gap009/claim-k',
    });
    const claimId = String(claim.claim_id);
    await assumeIdentity(db, CHECKER, C1);
    await rpc('approve_deposit_application_claim_atomic', { claim_id: claimId });
    await assumeIdentity(db, MAKER, C1);
    await expect(
      rpc('apply_deposit_claim_atomic', {
        claim_id: claimId,
        request_id: 'gap009-apply-k-1',
        effective_date: '2026-07-14',
      }),
    ).rejects.toThrow(/EXCEEDS_REMAINING/);
  });

  it('L. application exceeding invoice outstanding is rejected (creation and stale apply)', async () => {
    await assumeIdentity(db, MAKER, C1);

    // Creation-time guard: allocation > outstanding.
    await expect(
      rpc('create_deposit_application_claim_atomic', {
        request_id: 'gap009-claim-l-1',
        deposit_id: depositOffice,
        claim_kind: 'INVOICE_ARREARS',
        invoice_id: INV_OFFICE,
        allocation_amount: 1001,
        evidence_uri: 'evidence://gap009/claim-l1',
      }),
    ).rejects.toThrow(/EXCEEDS_OUTSTANDING/);

    // Stale-apply guard: claim approved at 300 against a fresh 500 deposit,
    // invoice partially settled afterwards (simulated server-side payment) →
    // apply must fail closed on the invoice, not on the deposit balance.
    const depL = await rpc('create_deposit_atomic', {
      contract_id: C_OFFICE,
      amount: 500,
      received_date: '2026-07-02',
      request_id: 'gap009-dep-l-1',
    });
    const claim = await rpc('create_deposit_application_claim_atomic', {
      request_id: 'gap009-claim-l-2',
      deposit_id: String(depL.deposit_id),
      claim_kind: 'INVOICE_ARREARS',
      invoice_id: INV_OFFICE,
      allocation_amount: 300,
      evidence_uri: 'evidence://gap009/claim-l2',
    });
    const claimId = String(claim.claim_id);
    await assumeIdentity(db, CHECKER, C1);
    await rpc('approve_deposit_application_claim_atomic', { claim_id: claimId });
    await assumeIdentity(db, MAKER, C1);

    await db.query(
      `update public.invoices set paid_amount = 800, updated_at = now()
        where id::text = $1 and company_id = $2::uuid`,
      [INV_OFFICE, C1],
    );
    await expect(
      rpc('apply_deposit_claim_atomic', {
        claim_id: claimId,
        request_id: 'gap009-apply-l-1',
        effective_date: '2026-07-14',
      }),
    ).rejects.toThrow(/NO_LONGER_ELIGIBLE/);
    await db.query(
      `update public.invoices set paid_amount = 0, updated_at = now()
        where id::text = $1 and company_id = $2::uuid`,
      [INV_OFFICE, C1],
    );
  });

  it('M. same-request replay is idempotent across create/apply/refund with a single economic effect', async () => {
    await assumeIdentity(db, MAKER, C1);

    const created1 = await rpc('create_deposit_atomic', {
      contract_id: C_DMG_OFFICE,
      amount: 300,
      received_date: '2026-07-07',
      request_id: 'gap009-replay-create-1',
    });
    const created2 = await rpc('create_deposit_atomic', {
      contract_id: C_DMG_OFFICE,
      amount: 300,
      received_date: '2026-07-07',
      request_id: 'gap009-replay-create-1',
    });
    expect(created2.idempotent).toBe(true);
    expect(created2.deposit_id).toBe(created1.deposit_id);
    const depId = String(created1.deposit_id);

    const claim = await rpc('create_deposit_application_claim_atomic', {
      request_id: 'gap009-replay-claim-1',
      deposit_id: depId,
      claim_kind: 'DAMAGE',
      allocation_amount: 100,
      evidence_uri: 'evidence://gap009/replay',
    });
    const claim2 = await rpc('create_deposit_application_claim_atomic', {
      request_id: 'gap009-replay-claim-1',
      deposit_id: depId,
      claim_kind: 'DAMAGE',
      allocation_amount: 100,
      evidence_uri: 'evidence://gap009/replay',
    });
    expect(claim2.idempotent).toBe(true);
    expect(claim2.claim_id).toBe(claim.claim_id);
    const claimId = String(claim.claim_id);

    await assumeIdentity(db, CHECKER, C1);
    await rpc('approve_deposit_application_claim_atomic', { claim_id: claimId });
    await assumeIdentity(db, MAKER, C1);
    const applied1 = await rpc('apply_deposit_claim_atomic', {
      claim_id: claimId,
      request_id: 'gap009-replay-apply-1',
      effective_date: '2026-07-15',
    });
    const applied2 = await rpc('apply_deposit_claim_atomic', {
      claim_id: claimId,
      request_id: 'gap009-replay-apply-1',
      effective_date: '2026-07-15',
    });
    expect(applied2.idempotent).toBe(true);
    expect(applied2.batch_id).toBe(applied1.batch_id);
    expect((await depositRow(depId))?.remaining_amount).toBe(200);

    const refund1 = await rpc('refund_deposit_governed_atomic', {
      deposit_id: depId,
      amount: 50,
      refund_date: '2026-07-16',
      payment_method: 'bank_transfer',
      request_id: 'gap009-replay-refund-1',
    });
    const refund2 = await rpc('refund_deposit_governed_atomic', {
      deposit_id: depId,
      amount: 50,
      refund_date: '2026-07-16',
      payment_method: 'bank_transfer',
      request_id: 'gap009-replay-refund-1',
    });
    expect(refund2.idempotent).toBe(true);
    expect(refund2.refund_event_id).toBe(refund1.refund_event_id);
    expect((await depositRow(depId))?.remaining_amount).toBe(150);
    expect((await depositRow(depId))?.refunded_amount).toBe(50);
    await assert2200Reconciled('M');
  });

  it('N. reused request key with a different payload fails closed', async () => {
    await assumeIdentity(db, MAKER, C1);
    await rpc('create_deposit_application_claim_atomic', {
      request_id: 'gap009-reuse-1',
      deposit_id: depositOffice,
      claim_kind: 'DAMAGE',
      allocation_amount: 10,
      evidence_uri: 'evidence://gap009/reuse',
    });
    await expect(
      rpc('create_deposit_application_claim_atomic', {
        request_id: 'gap009-reuse-1',
        deposit_id: depositOffice,
        claim_kind: 'DAMAGE',
        allocation_amount: 999,
        evidence_uri: 'evidence://gap009/reuse',
      }),
    ).rejects.toThrow(/IDEMPOTENCY_CONFLICT/);
  });

  it('O/P. partial then full governed refunds produce correct 2200/cash/subledger terminal state', async () => {
    await assumeIdentity(db, MAKER, C1);
    const created = await rpc('create_deposit_atomic', {
      contract_id: C_DMG_OFFICE,
      amount: 300,
      received_date: '2026-07-08',
      request_id: 'gap009-refund-dep-1',
    });
    const depId = String(created.deposit_id);

    const glBefore = await gl('2200');
    const partial = await rpc('refund_deposit_governed_atomic', {
      deposit_id: depId,
      amount: 100,
      refund_date: '2026-07-17',
      payment_method: 'cash',
      request_id: 'gap009-refund-1',
    });
    expect(partial.refunded).toBe(100);
    expect(partial.remaining).toBe(200);
    expect((await depositRow(depId))?.status).toBe('partially_refunded');
    expect(await gl('2200')).toBe(glBefore - 100);

    // Cash refund: Dr 2200 / Cr 1111.
    const { rows } = await db.query<{ no: string }>(
      `select a.no from public.journal_lines l
         join public.journal_batches b on b.id = l.batch_id
         join public.accounts a on a.id = l.account_id
        where b.source_type = 'pm_deposit_refund' and b.company_id = $1::uuid
          and b.effective_date = date '2026-07-17'`,
      [C1],
    );
    const accounts = rows.map((r) => r.no).sort();
    expect(accounts).toEqual(['1111', '2200']);

    const full = await rpc('refund_deposit_governed_atomic', {
      deposit_id: depId,
      amount: 200,
      refund_date: '2026-07-18',
      payment_method: 'bank_transfer',
      request_id: 'gap009-refund-2',
    });
    expect(full.refunded).toBe(300);
    expect(full.remaining).toBe(0);
    const dep = await depositRow(depId);
    expect(dep?.status).toBe('refunded');
    expect(dep?.remaining_amount).toBe(0);
    await assert2200Reconciled('O/P');
  });

  it('Q. refund reversal restores 2200, cash and subledger totals (compensating, never destructive)', async () => {
    await assumeIdentity(db, MAKER, C1);
    const { rows } = await db.query<{ id: string; amount: string }>(
      `select id::text as id, amount::text as amount from public.deposit_refund_events
        where company_id = $1::uuid order by effective_date, created_at`,
      [C1],
    );
    // The two events of the O/P deposit (amounts 100 and 200) are the last two.
    const glBefore = await gl('2200');
    const first = rows[rows.length - 2]!;
    const second = rows[rows.length - 1]!;
    expect([Number(first.amount), Number(second.amount)].sort((a, b) => a - b)).toEqual([100, 200]);

    const rev1 = await rpc('reverse_deposit_refund_atomic', {
      refund_event_id: second.id,
      request_id: 'gap009-refund-rev-2',
      reason: 'refund reversal test',
    });
    expect(rev1.status).toBe('REVERSED');
    expect(await gl('2200')).toBe(glBefore + Number(second.amount));

    const rev2 = await rpc('reverse_deposit_refund_atomic', {
      refund_event_id: first.id,
      request_id: 'gap009-refund-rev-1',
      reason: 'refund reversal test',
    });
    expect(rev2.status).toBe('REVERSED');
    expect(await gl('2200')).toBe(glBefore + Number(second.amount) + Number(first.amount));

    // The O/P deposit itself is restored to fully held:
    const { rows: depRow } = await db.query<{ remaining: string; refunded: string; status: string }>(
      `select remaining_amount::text as remaining, refunded_amount::text as refunded, status
         from public.tenant_deposits
        where request_id = 'gap009-refund-dep-1' and company_id = $1::uuid`,
      [C1],
    );
    expect(Number(depRow[0]?.remaining)).toBe(300);
    expect(Number(depRow[0]?.refunded)).toBe(0);
    expect(depRow[0]?.status).toBe('held');
    await assert2200Reconciled('Q');
  });

  it('S. canonical period resolution: OPEN contains date; SOFT/HARD closed redirect to first OPEN period; no open period fails closed', async () => {
    await assumeIdentity(db, MAKER, C1);

    // Normal open-period resolution (claim on C_PERIOD, effective 2026-06-15 → June is HARD_CLOSED, redirects to July OPEN).
    const created = await rpc('create_deposit_atomic', {
      contract_id: C_PERIOD,
      amount: 400,
      received_date: '2026-06-10',
      request_id: 'gap009-period-dep-1',
    });
    const depId = String(created.deposit_id);
    const claim = await rpc('create_deposit_application_claim_atomic', {
      request_id: 'gap009-period-claim-1',
      deposit_id: depId,
      claim_kind: 'INVOICE_ARREARS',
      invoice_id: INV_PERIOD,
      allocation_amount: 300,
      evidence_uri: 'evidence://gap009/period',
    });
    const claimId = String(claim.claim_id);
    await assumeIdentity(db, CHECKER, C1);
    await rpc('approve_deposit_application_claim_atomic', { claim_id: claimId });
    await assumeIdentity(db, MAKER, C1);

    const applied = await rpc('apply_deposit_claim_atomic', {
      claim_id: claimId,
      request_id: 'gap009-period-apply-1',
      effective_date: '2026-06-15',
    });
    expect(applied.status).toBe('APPLIED');

    const { rows } = await db.query<{ reason: string; period: string }>(
      `select b.period_resolution_reason as reason, p.name as period
         from public.journal_batches b
         join public.accounting_periods p on p.id = b.accounting_period_id
        where b.id = $1::uuid`,
      [String(applied.batch_id)],
    );
    expect(rows[0]?.reason).toBe('redirected_earliest_open_period');
    expect(rows[0]?.period).toBe('2026 Jul open');

    // No open period at all → fail closed (rolled back so the suite continues).
    const claim2 = await rpc('create_deposit_application_claim_atomic', {
      request_id: 'gap009-period-claim-2',
      deposit_id: depId,
      claim_kind: 'DAMAGE',
      allocation_amount: 50,
      evidence_uri: 'evidence://gap009/period2',
    });
    const claimId2 = String(claim2.claim_id);
    await assumeIdentity(db, CHECKER, C1);
    await rpc('approve_deposit_application_claim_atomic', { claim_id: claimId2 });
    await assumeIdentity(db, MAKER, C1);

    const { rows: julPeriod } = await db.query<{ id: string }>(
      `select id::text as id from public.accounting_periods
        where company_id = $1::uuid and name = '2026 Jul open'`,
      [C1],
    );
    await db.exec('begin;');
    try {
      await rpc('update_accounting_period_status', {
        period_id: julPeriod[0]!.id,
        status: 'SOFT_CLOSED',
        reason: 'gap009 period test',
      });
      await expect(
        rpc('apply_deposit_claim_atomic', {
          claim_id: claimId2,
          request_id: 'gap009-period-apply-2',
          effective_date: '2026-06-20',
        }),
      ).rejects.toThrow(/NO_ELIGIBLE_OPEN_ACCOUNTING_PERIOD/);
    } finally {
      await db.exec('rollback;');
    }
  });

  it('T. legacy deduct/refund bypasses are revoked; governed tables deny direct authenticated writes', async () => {
    const { rows } = await db.query<{ name: string; auth: boolean; service: boolean }>(
      `select p.proname as name,
              has_function_privilege('authenticated', 'public.' || p.proname || '(jsonb)', 'EXECUTE') as auth,
              has_function_privilege('service_role', 'public.' || p.proname || '(jsonb)', 'EXECUTE') as service
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('deduct_deposit_atomic','refund_deposit_atomic',
                            'gl_pm_post_deposit_application','gl_pm_post_deposit_refund')`,
    );
    for (const r of rows) {
      expect(r.auth, `${r.name} authenticated execute`).toBe(false);
      expect(r.service, `${r.name} service_role execute`).toBe(false);
    }

    const { rows: privs } = await db.query<{ table: string; ins: boolean; upd: boolean; del: boolean }>(
      `select 'deposit_application_claims' as table,
              has_table_privilege('authenticated', 'public.deposit_application_claims', 'INSERT') as ins,
              has_table_privilege('authenticated', 'public.deposit_application_claims', 'UPDATE') as upd,
              has_table_privilege('authenticated', 'public.deposit_application_claims', 'DELETE') as del
       union all
       select 'deposit_refund_events',
              has_table_privilege('authenticated', 'public.deposit_refund_events', 'INSERT'),
              has_table_privilege('authenticated', 'public.deposit_refund_events', 'UPDATE'),
              has_table_privilege('authenticated', 'public.deposit_refund_events', 'DELETE')
       union all
       select 'deposit_transactions',
              has_table_privilege('authenticated', 'public.deposit_transactions', 'INSERT'),
              has_table_privilege('authenticated', 'public.deposit_transactions', 'UPDATE'),
              has_table_privilege('authenticated', 'public.deposit_transactions', 'DELETE')`,
    );
    for (const r of privs) {
      expect(r.ins, `${r.table} authenticated INSERT`).toBe(false);
      expect(r.upd, `${r.table} authenticated UPDATE`).toBe(false);
      expect(r.del, `${r.table} authenticated DELETE`).toBe(false);
    }
  });

  it('U. OMR 3dp authority is exact for fractional baisa applications and refunds', async () => {
    await assumeIdentity(db, MAKER, C1);
    const created = await rpc('create_deposit_atomic', {
      contract_id: C_DMG_OFFICE,
      amount: 10.123,
      received_date: '2026-07-09',
      request_id: 'gap009-precision-dep-1',
    });
    const depId = String(created.deposit_id);

    const claim = await rpc('create_deposit_application_claim_atomic', {
      request_id: 'gap009-precision-claim-1',
      deposit_id: depId,
      claim_kind: 'DAMAGE',
      allocation_amount: 0.001,
      evidence_uri: 'evidence://gap009/precision',
    });
    const claimId = String(claim.claim_id);
    await assumeIdentity(db, CHECKER, C1);
    await rpc('approve_deposit_application_claim_atomic', { claim_id: claimId });
    await assumeIdentity(db, MAKER, C1);
    await rpc('apply_deposit_claim_atomic', {
      claim_id: claimId,
      request_id: 'gap009-precision-apply-1',
      effective_date: '2026-07-19',
    });
    const depAfterApply = await depositRow(depId);
    expect(depAfterApply?.remaining_amount).toBe(10.122);

    const refund = await rpc('refund_deposit_governed_atomic', {
      deposit_id: depId,
      amount: 10.122,
      refund_date: '2026-07-20',
      payment_method: 'bank_transfer',
      request_id: 'gap009-precision-refund-1',
    });
    expect(refund.remaining).toBe(0);
    const depAfterRefund = await depositRow(depId);
    expect(depAfterRefund?.remaining_amount).toBe(0);
    expect(depAfterRefund?.refunded_amount).toBe(10.122);
    await assert2200Reconciled('U');
  });

  it('V. full-lifecycle control reconciliation: deposit subledger ≡ GL 2200 at OMR 3dp', async () => {
    const { subledger, control } = await assert2200Reconciled('V', 0.001);

    // WP-05 deterministic reconciliation reports PASS for the 2200 class.
    const { rows } = await db.query<{ status: string; variance: string }>(
      `select reconciliation_status as status, variance::text as variance
         from public.wp05_reconcile_all(p_as_of := current_date)
        where account_no = '2200'`,
    );
    expect(rows[0]?.status).toBe('PASS');
    expect(Math.abs(Number(rows[0]?.variance))).toBeLessThanOrEqual(0.001);
    expect(subledger).toBeGreaterThan(0);
    expect(control).toBeGreaterThan(0);
  });
});
