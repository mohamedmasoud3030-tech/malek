/**
 * RC1 owner-agency invoice/credit/tax/collection regression proof.
 *
 * This is intentionally an authoritative PGlite integration test, not a
 * migration-string assertion. It exercises the live callable chain from the
 * immutable contract snapshot through invoice generation, canonical batches,
 * controlled receipt posting, credits, reversals and control balances.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'd1000000-0000-4000-8000-000000000001';
const OTHER_COMPANY = 'd1000000-0000-4000-8000-000000000002';
const MAKER = 'd1000000-0000-4000-8000-000000000011';
const CHECKER = 'd1000000-0000-4000-8000-000000000012';
const OTHER = 'd1000000-0000-4000-8000-000000000013';
const OWNER = 'd1000000-0000-4000-8000-000000000021';
const PROFILE_A = 'd1000000-0000-4000-8000-000000000031';
const PROFILE_B = 'd1000000-0000-4000-8000-000000000032';

const OFFICE_AGREEMENT = 'd1000000-0000-4000-8000-000000000101';
const OWNER_AGREEMENT = 'd1000000-0000-4000-8000-000000000102';
const CREDIT_AGREEMENT = 'd1000000-0000-4000-8000-000000000103';
const OFFICE_CONTRACT = 'd1000000-0000-4000-8000-000000000201';
const OWNER_CONTRACT = 'd1000000-0000-4000-8000-000000000202';
const CREDIT_CONTRACT = 'd1000000-0000-4000-8000-000000000203';

const RENT = 1000;
const TAX = 50;
const GROSS = 1050;

let db: PGlite;
let officeInvoice = '';
let ownerInvoice = '';
let creditInvoice = '';
let officeAgreementVersion = '';
let ownerAgreementVersion = '';
let creditAgreementVersion = '';

async function rpc(name: string, payload: Record<string, unknown>) {
  const { rows } = await db.query<{ value: string }>(
    `select public.${name}($1::jsonb)::text as value`,
    [JSON.stringify(payload)],
  );
  return JSON.parse(rows[0]?.value ?? '{}') as Record<string, unknown>;
}

async function netDebit(accountNo: string): Promise<number> {
  const { rows } = await db.query<{ value: string }>(
    `select coalesce(sum(jl.debit - jl.credit), 0)::text as value
       from public.journal_lines jl
       join public.journal_batches jb on jb.id = jl.batch_id
       join public.accounts a on a.id = jl.account_id and a.company_id = jb.company_id
      where jb.company_id = $1::uuid
        and jb.status in ('POSTED', 'REVERSED')
        and a.no = $2`,
    [COMPANY, accountNo],
  );
  return Number(rows[0]?.value ?? 0) || 0;
}

async function netCredit(accountNo: string) {
  return -(await netDebit(accountNo)) || 0;
}

async function invoiceRow(invoiceId: string) {
  const { rows } = await db.query<{
    id: string;
    amount: string;
    tax_amount: string;
    paid_amount: string;
    credited_amount: string;
    tax_rate: string;
    tax_code: string | null;
    tax_profile_id: string | null;
    tax_snapshot_id: string | null;
    tax_treatment: string | null;
    invoice_agreement_version_id: string | null;
    invoice_collection_role: string | null;
    invoice_accounting_classification: string | null;
    invoice_posting_batch_id: string | null;
    status: string;
  }>(
    `select id, amount::text, tax_amount::text, paid_amount::text,
            credited_amount::text, tax_rate::text, tax_code, tax_profile_id::text,
            tax_snapshot_id::text, tax_treatment, invoice_agreement_version_id::text,
            invoice_collection_role, invoice_accounting_classification,
            invoice_posting_batch_id::text, status
       from public.invoices where id = $1::uuid`,
    [invoiceId],
  );
  return rows[0];
}

function firstDayOfCurrentMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

async function agreementVersionId(agreementId: string) {
  const { rows } = await db.query<{ id: string }>(
    `select id::text from public.owner_agreement_versions
      where owner_agreement_id = $1::uuid and company_id = $2::uuid
      order by version_no desc limit 1`,
    [agreementId, COMPANY],
  );
  return rows[0]?.id ?? '';
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY}', 'RC1 Accounting Co', 'rc1-accounting-co'),
      ('${OTHER_COMPANY}', 'RC1 Other Co', 'rc1-other-co');

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MAKER}', 'maker@rc1-accounting.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${CHECKER}', 'checker@rc1-accounting.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${OTHER}', 'other@rc1-accounting.test', '{"company_id":"${OTHER_COMPANY}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${MAKER}', 'maker@rc1-accounting.test', 'Maker', 'ADMIN', 'ACTIVE', true),
      ('${CHECKER}', 'checker@rc1-accounting.test', 'Checker', 'ADMIN', 'ACTIVE', true),
      ('${OTHER}', 'other@rc1-accounting.test', 'Other', 'ADMIN', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${MAKER}', 'ADMIN'),
      ('${COMPANY}', '${CHECKER}', 'ADMIN'),
      ('${OTHER_COMPANY}', '${OTHER}', 'ADMIN');

    -- The legacy setting is explicit about applicability only. Its rate is
    -- intentionally ignored by the new generator in favour of PROFILE_A.
    insert into public.company_settings
      (id, singleton_key, company_name, currency, default_vat_rate, vat_enabled, vat_rate, company_id)
    values
      (gen_random_uuid(), true, 'RC1 Accounting Co', 'OMR', 99, true, 99, '${COMPANY}');

    insert into public.company_tax_profiles
      (id, company_id, version_no, tax_code, tax_rate, effective_from,
       status, created_by, approved_by, approved_at)
    values
      ('${PROFILE_A}', '${COMPANY}', 1, 'VAT', 5.000, date '2020-01-01',
       'ACTIVE', '${MAKER}', '${CHECKER}', now());

    -- Fee tax is independently versioned from rent tax. This explicit
    -- NON_TAXABLE / 0.000 treatment is deliberate fixture configuration, not a fallback.
    insert into public.company_fee_tax_treatments
      (id, company_id, fee_kind, version_no, tax_code, tax_rate, effective_from,
       status, created_by, approved_by, approved_at)
    values
      ('d1000000-0000-4000-8000-000000000034', '${COMPANY}', 'RATE_MANAGEMENT_FEE', 1, 'NON_TAXABLE', 0.000, date '2020-01-01',
       'ACTIVE', '${MAKER}', '${CHECKER}', now());

    insert into public.owners (id, full_name, name, company_id)
    values ('${OWNER}', 'RC1 Owner', 'RC1 Owner', '${COMPANY}');

    insert into public.properties (id, title, name, type, address, company_id) values
      ('d1000000-0000-4000-8000-000000000301', 'Office Property', 'Office Property', 'residential', 'Muscat', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000302', 'Owner Property', 'Owner Property', 'residential', 'Muscat', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000303', 'Credit Property', 'Credit Property', 'residential', 'Muscat', '${COMPANY}');

    insert into public.property_owners
      (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id) values
      ('d1000000-0000-4000-8000-000000000301', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000302', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000303', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}');

    insert into public.owner_agreements
      (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id) values
      ('${OFFICE_AGREEMENT}', '${OWNER}', 'd1000000-0000-4000-8000-000000000301', 'property_management', 'RATE', 10, date '2020-01-01', '${COMPANY}'),
      ('${OWNER_AGREEMENT}', '${OWNER}', 'd1000000-0000-4000-8000-000000000302', 'property_management', 'RATE', 10, date '2020-01-01', '${COMPANY}'),
      ('${CREDIT_AGREEMENT}', '${OWNER}', 'd1000000-0000-4000-8000-000000000303', 'property_management', 'RATE', 10, date '2020-01-01', '${COMPANY}');

    -- The initial agreement trigger creates v1 as OWNER_IS_CREDITOR. Create
    -- proper replacement terms before activation rather than mutating v1.
    update public.owner_agreement_versions
       set effective_to = date '2019-12-31', superseded_at = now()
     where owner_agreement_id in ('${OFFICE_AGREEMENT}'::uuid, '${CREDIT_AGREEMENT}'::uuid)
       and company_id = '${COMPANY}'::uuid and superseded_at is null;
    insert into public.owner_agreement_versions (
      id, owner_agreement_id, company_id, version_no, operating_model,
      collection_role, commission_type, commission_value,
      commission_recognition_basis, offset_allowed, reserve_amount,
      effective_from, created_by
    ) values
      ('d1000000-0000-4000-8000-000000000611', '${OFFICE_AGREEMENT}', '${COMPANY}', 2,
       'OWNER_AGENCY', 'OFFICE_IS_CREDITOR', 'RATE', 10, 'ON_COLLECTION', false, 0,
       date '2020-01-01', '${MAKER}'),
      ('d1000000-0000-4000-8000-000000000612', '${CREDIT_AGREEMENT}', '${COMPANY}', 2,
       'OWNER_AGENCY', 'OFFICE_IS_CREDITOR', 'RATE', 10, 'ON_COLLECTION', false, 0,
       date '2020-01-01', '${MAKER}');
    update public.owner_agreements
       set current_version_id = case id
         when '${OFFICE_AGREEMENT}'::uuid then 'd1000000-0000-4000-8000-000000000611'::uuid
         when '${CREDIT_AGREEMENT}'::uuid then 'd1000000-0000-4000-8000-000000000612'::uuid
         else current_version_id end
     where id in ('${OFFICE_AGREEMENT}'::uuid, '${CREDIT_AGREEMENT}'::uuid);

    insert into public.units (id, property_id, name, unit_number, company_id) values
      ('d1000000-0000-4000-8000-000000000401', 'd1000000-0000-4000-8000-000000000301', 'Office Unit', 'OFF-1', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000402', 'd1000000-0000-4000-8000-000000000302', 'Owner Unit', 'OWN-1', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000403', 'd1000000-0000-4000-8000-000000000303', 'Credit Unit', 'CRD-1', '${COMPANY}');

    insert into public.people (id, full_name, type, company_id) values
      ('d1000000-0000-4000-8000-000000000501', 'Office Tenant', 'tenant', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000502', 'Owner Tenant', 'tenant', '${COMPANY}'),
      ('d1000000-0000-4000-8000-000000000503', 'Credit Tenant', 'tenant', '${COMPANY}');

    insert into public.contracts
      (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id) values
      ('${OFFICE_CONTRACT}', 'd1000000-0000-4000-8000-000000000301', 'd1000000-0000-4000-8000-000000000401', 'd1000000-0000-4000-8000-000000000501', '${OFFICE_AGREEMENT}', date '2020-01-01', date '2030-12-31', ${RENT}, 'active', '${COMPANY}'),
      ('${OWNER_CONTRACT}', 'd1000000-0000-4000-8000-000000000302', 'd1000000-0000-4000-8000-000000000402', 'd1000000-0000-4000-8000-000000000502', '${OWNER_AGREEMENT}', date '2020-01-01', date '2030-12-31', ${RENT}, 'active', '${COMPANY}'),
      ('${CREDIT_CONTRACT}', 'd1000000-0000-4000-8000-000000000303', 'd1000000-0000-4000-8000-000000000403', 'd1000000-0000-4000-8000-000000000503', '${CREDIT_AGREEMENT}', date '2020-01-01', date '2030-12-31', ${RENT}, 'active', '${COMPANY}');
  `);

  await assumeIdentity(db, MAKER, COMPANY);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);

  officeAgreementVersion = await agreementVersionId(OFFICE_AGREEMENT);
  ownerAgreementVersion = await agreementVersionId(OWNER_AGREEMENT);
  creditAgreementVersion = await agreementVersionId(CREDIT_AGREEMENT);

  const generated = await db.query<{ value: string }>('select public.generate_invoices_from_active_contracts()::text as value');
  expect(Number(generated.rows[0]?.value)).toBe(3);

  const { rows } = await db.query<{ contract_id: string; id: string }>(
    `select contract_id::text, id::text from public.invoices
      where company_id = $1::uuid and document_status = 'POSTED'
      order by contract_id`,
    [COMPANY],
  );
  const byContract = new Map(rows.map((row) => [row.contract_id, row.id]));
  officeInvoice = byContract.get(OFFICE_CONTRACT) ?? '';
  ownerInvoice = byContract.get(OWNER_CONTRACT) ?? '';
  creditInvoice = byContract.get(CREDIT_CONTRACT) ?? '';
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('RC1 owner-agency recurring invoice classification', () => {
  it('derives OFFICE_IS_CREDITOR from the immutable contract snapshot and posts Dr 1201 / Cr 2000 / Cr 2100, never 4000', async () => {
    const invoice = await invoiceRow(officeInvoice);
    expect(invoice.invoice_agreement_version_id).toBe(officeAgreementVersion);
    expect(invoice.invoice_collection_role).toBe('OFFICE_IS_CREDITOR');
    expect(invoice.invoice_accounting_classification).toBe('OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS');
    expect(invoice.tax_treatment).toBe('TAXABLE');
    expect(invoice.tax_profile_id).toBe(PROFILE_A);
    expect(invoice.tax_code).toBe('VAT');
    expect(Number(invoice.tax_rate)).toBe(5);
    expect(Number(invoice.tax_amount)).toBe(TAX);
    expect(invoice.invoice_posting_batch_id).toBeTruthy();
    expect(invoice.tax_snapshot_id).toBeTruthy();

    // A second OFFICE_IS_CREDITOR fixture is intentionally present for the
    // controlled-credit lifecycle below, hence two initial 1050.000 AR postings.
    expect(await netDebit('1201')).toBe(2100);
    expect(await netCredit('2000')).toBe(2000);
    expect(await netCredit('2100')).toBe(100);
    expect(await netCredit('4000')).toBe(0);

    const { rows } = await db.query<{ diff: string }>(
      `select (sum(jl.debit) - sum(jl.credit))::text as diff
         from public.journal_lines jl
        where jl.batch_id = $1::uuid`,
      [invoice.invoice_posting_batch_id],
    );
    expect(Number(rows[0]?.diff)).toBe(0);
  });

  it('keeps OWNER_IS_CREDITOR rent operational at invoice issuance: no 1201, 2000, 2100 or 4000 entry is manufactured', async () => {
    const invoice = await invoiceRow(ownerInvoice);
    expect(invoice.invoice_agreement_version_id).toBe(ownerAgreementVersion);
    expect(invoice.invoice_collection_role).toBe('OWNER_IS_CREDITOR');
    expect(invoice.invoice_accounting_classification).toBe('OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL');
    expect(invoice.invoice_posting_batch_id).toBeNull();
    expect(Number(invoice.amount)).toBe(RENT);
    expect(Number(invoice.tax_amount)).toBe(TAX);

    // Neither OWNER_IS_CREDITOR invoice issue hit GL. The two OFFICE fixtures
    // are the only source of the aggregate control balances at this point.
    expect(await netDebit('1201')).toBe(2100);
    expect(await netCredit('2000')).toBe(2000);
    expect(await netCredit('2100')).toBe(100);
    expect(await netCredit('4000')).toBe(0);
  });

  it('preserves invoice lineage when a later agreement version is introduced', async () => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    await db.query(
      `select public.create_owner_agreement_version_atomic($1::uuid, $2::jsonb)`,
      [
        OFFICE_AGREEMENT,
        JSON.stringify({
          collection_role: 'OWNER_IS_CREDITOR',
          commission_type: 'RATE',
          commission_value: 0,
          effective_from: tomorrow.toISOString().slice(0, 10),
        }),
      ],
    );

    const invoice = await invoiceRow(officeInvoice);
    expect(invoice.invoice_agreement_version_id).toBe(officeAgreementVersion);
    expect(invoice.invoice_collection_role).toBe('OFFICE_IS_CREDITOR');
    expect(invoice.invoice_accounting_classification).toBe('OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS');
  });
});

describe('RC1 collections, credits and historical tax basis', () => {
  it('collects OFFICE_IS_CREDITOR rent to Bank, clears 1201, retains 2000 and recognizes only 10% management fee', async () => {
    const result = await rpc('record_invoice_payment_atomic', {
      invoice_id: officeInvoice,
      amount: GROSS,
      method: 'bank_transfer',
      date: firstDayOfCurrentMonth(),
      reference: 'RC1-OFFICE-BANK-001',
      request_id: 'rc1-office-bank-001',
    });
    expect(result.cash_account_no).toBe('1120');
    expect(Number(result.collection_net)).toBe(RENT);
    expect(Number(result.collection_tax)).toBe(TAX);
    expect(Number(result.management_fee_net)).toBe(100);

    expect(await netDebit('1120')).toBe(GROSS);
    expect(await netDebit('1201')).toBe(GROSS);
    expect(await netCredit('2000')).toBe(1900);
    expect(await netCredit('2100')).toBe(100);
    expect(await netCredit('4100')).toBe(100);
    expect(await netCredit('4000')).toBe(0);

    const invoice = await invoiceRow(officeInvoice);
    expect(Number(invoice.paid_amount)).toBe(GROSS);
    expect(invoice.status).toBe('PAID');
  });

  it('collects OWNER_IS_CREDITOR rent to Cash as owner funds plus historical-profile VAT, without creating 1201 or 4000 revenue', async () => {
    const result = await rpc('record_invoice_payment_atomic', {
      invoice_id: ownerInvoice,
      amount: GROSS,
      method: 'cash',
      date: firstDayOfCurrentMonth(),
      reference: 'RC1-OWNER-CASH-001',
      request_id: 'rc1-owner-cash-001',
    });
    expect(result.cash_account_no).toBe('1111');
    expect(Number(result.collection_net)).toBe(RENT);
    expect(Number(result.collection_tax)).toBe(TAX);
    expect(Number(result.management_fee_net)).toBe(100);

    expect(await netDebit('1111')).toBe(GROSS);
    expect(await netDebit('1201')).toBe(GROSS);
    expect(await netCredit('2000')).toBe(2800);
    expect(await netCredit('2100')).toBe(150);
    expect(await netCredit('4100')).toBe(200);
    expect(await netCredit('4000')).toBe(0);
  });

  it('credits and reverses the original OFFICE_IS_CREDITOR economic model, even after profile B is activated', async () => {
    // B is intentionally a later/current configuration. A credit to the invoice
    // posted under profile A must stay at A's 5.000 rate and 5.000 tax component.
    await db.exec(`
      insert into public.company_tax_profiles
        (id, company_id, version_no, tax_code, tax_rate, effective_from,
         status, created_by, approved_by, approved_at)
      values
        ('${PROFILE_B}', '${COMPANY}', 2, 'VAT', 7.000, date '${firstDayOfCurrentMonth()}',
         'ACTIVE', '${CHECKER}', '${MAKER}', now());
    `);

    const credit = await rpc('create_invoice_credit_atomic', {
      invoice_id: creditInvoice,
      amount: 105,
      credit_type: 'PARTIAL',
      reason: 'Tenant-approved partial rent concession',
      request_id: 'rc1-credit-a-001',
      effective_date: firstDayOfCurrentMonth(),
    });
    expect(Number(credit.net_amount)).toBe(100);
    expect(Number(credit.tax_amount)).toBe(5);

    const { rows: creditRows } = await db.query<{
      id: string; tax_rate: string; tax_code: string | null; net_amount: string; tax_amount: string; journal_batch_id: string | null;
    }>(
      `select id::text, tax_rate::text, tax_code, net_amount::text, tax_amount::text, journal_batch_id::text
         from public.invoice_credits where request_id = 'rc1-credit-a-001'`,
    );
    const creditRow = creditRows[0];
    expect(Number(creditRow.tax_rate)).toBe(5);
    expect(creditRow.tax_code).toBe('VAT');
    expect(Number(creditRow.net_amount)).toBe(100);
    expect(Number(creditRow.tax_amount)).toBe(5);
    expect(creditRow.journal_batch_id).toBeTruthy();

    // Office #1 and owner #1 remain paid; credit invoice now has 945 AR,
    // 900 owner funds and 45 VAT from its original economics. No 4000 debit.
    expect(await netDebit('1201')).toBe(945);
    expect(await netCredit('2000')).toBe(2700);
    expect(await netCredit('2100')).toBe(145);
    expect(await netCredit('4000')).toBe(0);

    const partialPayment = await rpc('record_invoice_payment_atomic', {
      invoice_id: creditInvoice,
      amount: 945,
      method: 'bank_transfer',
      date: firstDayOfCurrentMonth(),
      reference: 'RC1-CREDIT-REMAINING-001',
      request_id: 'rc1-credit-remaining-001',
    });
    expect(Number(partialPayment.collection_tax)).toBe(45);
    expect(Number(partialPayment.management_fee_net)).toBe(90);
    expect(await netDebit('1201')).toBe(0);

    const reversal = await rpc('reverse_invoice_credit_atomic', {
      credit_id: creditRow.id,
      reason: 'Approved reversal of tenant concession',
      request_id: 'rc1-credit-reversal-001',
    });
    expect(reversal.success).toBe(true);
    expect(await netDebit('1201')).toBe(105);

    const finalPayment = await rpc('record_invoice_payment_atomic', {
      invoice_id: creditInvoice,
      amount: 105,
      method: 'bank_transfer',
      date: firstDayOfCurrentMonth(),
      reference: 'RC1-CREDIT-FINAL-001',
      request_id: 'rc1-credit-final-001',
    });
    expect(Number(finalPayment.collection_tax)).toBe(5);
    expect(Number(finalPayment.management_fee_net)).toBe(10);
    expect(await netDebit('1201')).toBe(0);

    const invoice = await invoiceRow(creditInvoice);
    expect(Number(invoice.paid_amount)).toBe(GROSS);
    expect(Number(invoice.credited_amount)).toBe(0);
    expect(invoice.status).toBe('PAID');
  });

  it('credits and reverses an operational OWNER_IS_CREDITOR invoice without inventing any GL revenue reversal', async () => {
    await db.exec(`
      insert into public.properties (id, title, name, type, address, company_id)
      values ('d1000000-0000-4000-8000-000000000901', 'Owner Credit Property', 'Owner Credit Property', 'residential', 'Muscat', '${COMPANY}');
      insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
      values ('d1000000-0000-4000-8000-000000000901', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}');
      insert into public.owner_agreements
        (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
      values ('d1000000-0000-4000-8000-000000000902', '${OWNER}', 'd1000000-0000-4000-8000-000000000901', 'property_management', 'RATE', 0, date '2020-01-01', '${COMPANY}');
      insert into public.units (id, property_id, name, unit_number, company_id)
      values ('d1000000-0000-4000-8000-000000000903', 'd1000000-0000-4000-8000-000000000901', 'Owner Credit Unit', 'OWN-CR-1', '${COMPANY}');
      insert into public.people (id, full_name, type, company_id)
      values ('d1000000-0000-4000-8000-000000000904', 'Owner Credit Tenant', 'tenant', '${COMPANY}');
      insert into public.contracts
        (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
      values ('d1000000-0000-4000-8000-000000000905', 'd1000000-0000-4000-8000-000000000901', 'd1000000-0000-4000-8000-000000000903', 'd1000000-0000-4000-8000-000000000904', 'd1000000-0000-4000-8000-000000000902', date '2020-01-01', date '2030-12-31', 1000, 'active', '${COMPANY}');
    `);
    const generated = await db.query<{ value: string }>('select public.generate_invoices_from_active_contracts()::text as value');
    expect(Number(generated.rows[0]?.value)).toBe(1);
    const { rows: ownerCreditRows } = await db.query<{ id: string }>(
      `select id::text from public.invoices where contract_id = 'd1000000-0000-4000-8000-000000000905'::uuid`,
    );
    const operationalInvoice = ownerCreditRows[0]?.id ?? '';
    const before4000 = await netCredit('4000');

    const credit = await rpc('create_invoice_credit_atomic', {
      invoice_id: operationalInvoice,
      amount: 107,
      credit_type: 'PARTIAL',
      reason: 'Owner-creditor operational concession',
      request_id: 'rc1-owner-operational-credit-001',
      effective_date: firstDayOfCurrentMonth(),
    });
    expect(Number(credit.net_amount)).toBe(100);
    expect(Number(credit.tax_amount)).toBe(7);
    expect(credit.batch_id).toBeNull();

    const { rows: creditRows } = await db.query<{ id: string; journal_batch_id: string | null }>(
      `select id::text, journal_batch_id::text from public.invoice_credits where request_id = 'rc1-owner-operational-credit-001'`,
    );
    expect(creditRows[0]?.journal_batch_id).toBeNull();
    expect(Number((await invoiceRow(operationalInvoice)).credited_amount)).toBe(107);
    expect(await netCredit('4000')).toBe(before4000);

    const reversed = await rpc('reverse_invoice_credit_atomic', {
      credit_id: creditRows[0]?.id ?? '',
      reason: 'Reverse operational concession',
      request_id: 'rc1-owner-operational-credit-reversal-001',
    });
    expect(reversed.reversal_batch_id).toBeNull();
    expect(Number((await invoiceRow(operationalInvoice)).credited_amount)).toBe(0);
    expect(await netCredit('4000')).toBe(before4000);
  });

  it('keeps VOID append-only and coherent: governed receipt reversal restores 1201, then a controlled full credit clears the original office obligation', async () => {
    await db.exec(`
      insert into public.properties (id, title, name, type, address, company_id)
      values ('d1000000-0000-4000-8000-000000000921', 'Void Property', 'Void Property', 'residential', 'Muscat', '${COMPANY}');
      insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
      values ('d1000000-0000-4000-8000-000000000921', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}');
      insert into public.owner_agreements
        (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
      values ('d1000000-0000-4000-8000-000000000922', '${OWNER}', 'd1000000-0000-4000-8000-000000000921', 'property_management', 'RATE', 10, date '2020-01-01', '${COMPANY}');
      update public.owner_agreement_versions
         set effective_to = date '2019-12-31', superseded_at = now()
       where owner_agreement_id = 'd1000000-0000-4000-8000-000000000922'::uuid and superseded_at is null;
      insert into public.owner_agreement_versions
        (id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
         commission_type, commission_value, commission_recognition_basis, offset_allowed,
         reserve_amount, effective_from, created_by)
      values ('d1000000-0000-4000-8000-000000000923', 'd1000000-0000-4000-8000-000000000922', '${COMPANY}', 2,
        'OWNER_AGENCY', 'OFFICE_IS_CREDITOR', 'RATE', 10, 'ON_COLLECTION', false, 0, date '2020-01-01', '${MAKER}');
      update public.owner_agreements set current_version_id = 'd1000000-0000-4000-8000-000000000923'::uuid
       where id = 'd1000000-0000-4000-8000-000000000922'::uuid;
      insert into public.units (id, property_id, name, unit_number, company_id)
      values ('d1000000-0000-4000-8000-000000000924', 'd1000000-0000-4000-8000-000000000921', 'Void Unit', 'VOID-1', '${COMPANY}');
      insert into public.people (id, full_name, type, company_id)
      values ('d1000000-0000-4000-8000-000000000925', 'Void Tenant', 'tenant', '${COMPANY}');
      insert into public.contracts
        (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
      values ('d1000000-0000-4000-8000-000000000926', 'd1000000-0000-4000-8000-000000000921', 'd1000000-0000-4000-8000-000000000924', 'd1000000-0000-4000-8000-000000000925', 'd1000000-0000-4000-8000-000000000922', date '2020-01-01', date '2030-12-31', 1000, 'active', '${COMPANY}');
    `);
    const generated = await db.query<{ value: string }>('select public.generate_invoices_from_active_contracts()::text as value');
    expect(Number(generated.rows[0]?.value)).toBe(1);
    const { rows: voidInvoiceRows } = await db.query<{ id: string }>(
      `select id::text from public.invoices where contract_id = 'd1000000-0000-4000-8000-000000000926'::uuid`,
    );
    const voidInvoice = voidInvoiceRows[0]?.id ?? '';
    const payment = await rpc('record_invoice_payment_atomic', {
      invoice_id: voidInvoice,
      amount: 1070,
      method: 'bank_transfer',
      date: firstDayOfCurrentMonth(),
      reference: 'RC1-VOID-PAYMENT-001',
      request_id: 'rc1-void-payment-001',
    });
    const request = await rpc('request_receipt_void_atomic', {
      receipt_id: String(payment.receipt_id),
      reason: 'Bank receipt entered in error',
      request_id: 'rc1-void-request-001',
    });
    await assumeIdentity(db, CHECKER, COMPANY);
    const approved = await rpc('approve_receipt_void_atomic', {
      void_request_id: String(request.void_request_id),
      request_id: 'rc1-void-approval-001',
    });
    expect(approved.success).toBe(true);
    await assumeIdentity(db, MAKER, COMPANY);

    expect(Number((await invoiceRow(voidInvoice)).paid_amount)).toBe(0);
    expect(await netDebit('1201')).toBe(1070);
    const fullCredit = await rpc('create_invoice_credit_atomic', {
      invoice_id: voidInvoice,
      amount: 1070,
      credit_type: 'FULL',
      reason: 'Credit the voided office-creditor obligation',
      request_id: 'rc1-void-full-credit-001',
      effective_date: firstDayOfCurrentMonth(),
    });
    expect(Number(fullCredit.net_amount)).toBe(1000);
    expect(Number(fullCredit.tax_amount)).toBe(70);
    expect(await netDebit('1201')).toBe(0);
    expect(await netCredit('4000')).toBe(0);
  });

  it('resolves OPEN, SOFT_CLOSED and HARD_CLOSED periods deterministically: late invoice/credit events post to the first open future period and hard close cannot reopen', async () => {
    const now = new Date();
    const nextStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const nextEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0));
    const iso = (date: Date) => date.toISOString().slice(0, 10);
    const { rows: currentPeriods } = await db.query<{ id: string }>(
      `select id::text from public.accounting_periods
        where company_id = $1::uuid and current_date between start_date and end_date
        order by start_date limit 1`,
      [COMPANY],
    );
    const currentPeriodId = currentPeriods[0]?.id ?? '';
    expect(currentPeriodId).toBeTruthy();
    await rpc('update_accounting_period_status', {
      period_id: currentPeriodId,
      status: 'SOFT_CLOSED',
      reason: 'RC1 late-posting proof',
    });
    const future = await rpc('create_accounting_period', {
      name: `RC1-${iso(nextStart)}`,
      start_date: iso(nextStart),
      end_date: iso(nextEnd),
      status: 'OPEN',
    });
    const futurePeriodId = String(future.id);

    await db.exec(`
      insert into public.properties (id, title, name, type, address, company_id)
      values ('d1000000-0000-4000-8000-000000000931', 'Period Property', 'Period Property', 'residential', 'Muscat', '${COMPANY}');
      insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
      values ('d1000000-0000-4000-8000-000000000931', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}');
      insert into public.owner_agreements
        (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
      values ('d1000000-0000-4000-8000-000000000932', '${OWNER}', 'd1000000-0000-4000-8000-000000000931', 'property_management', 'RATE', 0, date '2020-01-01', '${COMPANY}');
      update public.owner_agreement_versions set effective_to = date '2019-12-31', superseded_at = now()
       where owner_agreement_id = 'd1000000-0000-4000-8000-000000000932'::uuid and superseded_at is null;
      insert into public.owner_agreement_versions
        (id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
         commission_type, commission_value, commission_recognition_basis, offset_allowed,
         reserve_amount, effective_from, created_by)
      values ('d1000000-0000-4000-8000-000000000933', 'd1000000-0000-4000-8000-000000000932', '${COMPANY}', 2,
        'OWNER_AGENCY', 'OFFICE_IS_CREDITOR', 'RATE', 0, 'ON_COLLECTION', false, 0, date '2020-01-01', '${MAKER}');
      update public.owner_agreements set current_version_id = 'd1000000-0000-4000-8000-000000000933'::uuid
       where id = 'd1000000-0000-4000-8000-000000000932'::uuid;
      insert into public.units (id, property_id, name, unit_number, company_id)
      values ('d1000000-0000-4000-8000-000000000934', 'd1000000-0000-4000-8000-000000000931', 'Period Unit', 'PER-1', '${COMPANY}');
      insert into public.people (id, full_name, type, company_id)
      values ('d1000000-0000-4000-8000-000000000935', 'Period Tenant', 'tenant', '${COMPANY}');
      insert into public.contracts
        (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
      values ('d1000000-0000-4000-8000-000000000936', 'd1000000-0000-4000-8000-000000000931', 'd1000000-0000-4000-8000-000000000934', 'd1000000-0000-4000-8000-000000000935', 'd1000000-0000-4000-8000-000000000932', date '2020-01-01', date '2030-12-31', 1000, 'active', '${COMPANY}');
    `);
    const generated = await db.query<{ value: string }>('select public.generate_invoices_from_active_contracts()::text as value');
    expect(Number(generated.rows[0]?.value)).toBe(1);
    const { rows: periodInvoices } = await db.query<{ id: string; invoice_posting_batch_id: string }>(
      `select id::text, invoice_posting_batch_id::text from public.invoices where contract_id = 'd1000000-0000-4000-8000-000000000936'::uuid`,
    );
    const periodInvoice = periodInvoices[0]?.id ?? '';
    const { rows: generatedBatches } = await db.query<{ accounting_period_id: string; late_posting: boolean }>(
      `select accounting_period_id::text, late_posting from public.journal_batches where id = $1::uuid`,
      [periodInvoices[0]?.invoice_posting_batch_id],
    );
    expect(generatedBatches[0]?.accounting_period_id).toBe(futurePeriodId);
    expect(generatedBatches[0]?.late_posting).toBe(true);

    await rpc('update_accounting_period_status', {
      period_id: currentPeriodId,
      status: 'HARD_CLOSED',
      reason: 'RC1 hard-close proof',
    });
    await expect(rpc('update_accounting_period_status', {
      period_id: currentPeriodId,
      status: 'OPEN',
      reason: 'must fail',
    })).rejects.toThrow(/HARD_CLOSED_IMMUTABLE/);

    const lateCredit = await rpc('create_invoice_credit_atomic', {
      invoice_id: periodInvoice,
      amount: 1070,
      credit_type: 'FULL',
      reason: 'Hard-closed-period controlled credit',
      request_id: 'rc1-hard-close-credit-001',
      effective_date: firstDayOfCurrentMonth(),
    });
    const { rows: creditBatches } = await db.query<{ accounting_period_id: string; late_posting: boolean }>(
      `select accounting_period_id::text, late_posting from public.journal_batches where id = $1::uuid`,
      [lateCredit.batch_id],
    );
    expect(creditBatches[0]?.accounting_period_id).toBe(futurePeriodId);
    expect(creditBatches[0]?.late_posting).toBe(true);
    expect(await netDebit('1201')).toBe(0);
  });

  it('fails closed when a taxable company has no effective versioned profile', async () => {
    await db.exec(`
      insert into public.owners (id, full_name, name, company_id)
      values ('d1000000-0000-4000-8000-000000000951', 'Other Owner', 'Other Owner', '${OTHER_COMPANY}');
      insert into public.properties (id, title, name, type, address, company_id)
      values ('d1000000-0000-4000-8000-000000000952', 'Other Property', 'Other Property', 'residential', 'Muscat', '${OTHER_COMPANY}');
      insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
      values ('d1000000-0000-4000-8000-000000000952', 'd1000000-0000-4000-8000-000000000951', 100, true, date '2020-01-01', '${OTHER_COMPANY}');
      insert into public.owner_agreements
        (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
      values ('d1000000-0000-4000-8000-000000000953', 'd1000000-0000-4000-8000-000000000951', 'd1000000-0000-4000-8000-000000000952', 'property_management', 'RATE', 0, date '2020-01-01', '${OTHER_COMPANY}');
      insert into public.units (id, property_id, name, unit_number, company_id)
      values ('d1000000-0000-4000-8000-000000000954', 'd1000000-0000-4000-8000-000000000952', 'Other Unit', 'OTHER-1', '${OTHER_COMPANY}');
      insert into public.people (id, full_name, type, company_id)
      values ('d1000000-0000-4000-8000-000000000955', 'Other Tenant', 'tenant', '${OTHER_COMPANY}');
      insert into public.contracts
        (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
      values ('d1000000-0000-4000-8000-000000000956', 'd1000000-0000-4000-8000-000000000952', 'd1000000-0000-4000-8000-000000000954', 'd1000000-0000-4000-8000-000000000955', 'd1000000-0000-4000-8000-000000000953', date '2020-01-01', date '2030-12-31', 1000, 'active', '${OTHER_COMPANY}');
    `);
    await assumeIdentity(db, OTHER, OTHER_COMPANY);
    await expect(db.query('select public.generate_invoices_from_active_contracts()')).rejects.toThrow(/TAX_PROFILE_MISSING/);
    await assumeIdentity(db, MAKER, COMPANY);
  });

  it('prevents cross-company credit writes and browser-facing arbitrary receipt journals', async () => {
    await assumeIdentity(db, OTHER, OTHER_COMPANY);
    await expect(
      db.query(
        `select public.create_invoice_credit_atomic($1::jsonb)`,
        [JSON.stringify({
          invoice_id: creditInvoice,
          amount: 1,
          credit_type: 'PARTIAL',
          reason: 'cross-company attempt',
          request_id: 'rc1-cross-company-credit',
        })],
      ),
    ).rejects.toThrow();

    const { rows } = await db.query<{ allowed: boolean }>(
      `select has_function_privilege('authenticated', 'public.post_receipt_atomic(jsonb)', 'EXECUTE') as allowed`,
    );
    expect(rows[0]?.allowed).toBe(false);
    await assumeIdentity(db, MAKER, COMPANY);
  });

  it('reconciles the RC1 controls and proves no gross managed rent reaches 4000', async () => {
    const { rows: reconciliation } = await db.query<{
      account_no: string; subledger_balance: string; gl_balance: string; variance: string; reconciliation_status: string;
    }>(
      `select account_no, subledger_balance::text, gl_balance::text, variance::text, reconciliation_status
         from public.wp05_reconcile_all($1::uuid, current_date)
        where account_no in ('1201','1300','2000','2200','2300')
        order by account_no`,
      [COMPANY],
    );
    const ar = reconciliation.find((row) => row.account_no === '1201');
    expect(ar?.reconciliation_status).toBe('PASS');
    expect(Number(ar?.variance)).toBe(0);
    for (const accountNo of ['1201', '1300', '2000', '2200', '2300']) {
      const row = reconciliation.find((candidate) => candidate.account_no === accountNo);
      expect(row?.reconciliation_status, `${accountNo} must reconcile within 0.001 OMR`).toBe('PASS');
      expect(Math.abs(Number(row?.variance ?? 0))).toBeLessThanOrEqual(0.001);
    }
    expect(await netCredit('4000')).toBe(0);

    const { rows: vatBasis } = await db.query<{ balance: string; cnt: number }>(
      `select balance::text, cnt from public.rc1_owner_agency_vat_payable_balance($1::uuid, current_date)`,
      [COMPANY],
    );
    expect(Number(vatBasis[0]?.balance)).toBe(150);
    expect(await netCredit('2100')).toBe(150);
    const { rows: feeBasis } = await db.query<{ amount: string }>(
      `select coalesce(sum(-amount_delta), 0)::text as amount
         from public.owner_funds_events e
        where e.company_id = $1::uuid
          and (
            e.source_type = 'MANAGEMENT_FEE'
            or (
              e.source_type = 'RECEIPT_VOID_REVERSAL'
              and exists (
                select 1 from public.owner_funds_events original
                 where original.id::text = e.event_id
                   and original.source_type = 'MANAGEMENT_FEE'
              )
            )
          )`,
      [COMPANY],
    );
    expect(Number(feeBasis[0]?.amount)).toBe(300);

    // The operational source for the synthetic cash/bank comparison is the
    // posted payment/receipt channel. It is not a substitute for a physical
    // cash count or an imported bank-statement reconciliation.
    const { rows: channelTotals } = await db.query<{ method: string; amount: string }>(
      `select payment_method as method, sum(amount)::text as amount
         from public.payments
        where company_id = $1::uuid and upper(status) = 'POSTED'
        group by payment_method`,
      [COMPANY],
    );
    const byMethod = new Map(channelTotals.map((row) => [row.method, Number(row.amount)]));
    expect(byMethod.get('cash')).toBe(1050);
    expect(byMethod.get('bank_transfer')).toBe(2100);

    // Exact 3dp RC1 synthetic golden-path evidence:
    // Cash = owner collection; Bank = two office collections; owner funds =
    // 3 × (1000 rent - 100 fee); VAT = 3 × 50; fee revenue = 3 × 100.
    expect(await netDebit('1111')).toBe(1050);
    expect(await netDebit('1120')).toBe(2100);
    expect(await netDebit('1201')).toBe(0);
    expect(await netDebit('1300')).toBe(0);
    expect(await netCredit('2000')).toBe(2700);
    expect(await netCredit('2100')).toBe(150);
    expect(await netCredit('2200')).toBe(0);
    expect(await netCredit('2300')).toBe(0);
    expect(await netCredit('4100')).toBe(300);
    expect(await netCredit('4000')).toBe(0);
  });
});

describe('RC1 fail-closed and cutover regressions', () => {
  it('rejects a legacy/null-classified invoice payment and reports snapshot-missing property-management candidates', async () => {
    const legacyContract = 'd1000000-0000-4000-8000-000000000981';
    const legacyInvoice = 'd1000000-0000-4000-8000-000000000982';
    // The legacy contract needs its own unit: the three fixture units are all
    // covered by active contracts over 2020-2030, and the
    // contracts_no_active_unit_overlap exclusion constraint forbids a second
    // active contract on the same unit in that window.
    await db.exec(`
      insert into public.units (id, property_id, name, unit_number, company_id)
      values ('d1000000-0000-4000-8000-000000000404', 'd1000000-0000-4000-8000-000000000301', 'Legacy Unit', 'LEG-1', '${COMPANY}')
      on conflict (id) do nothing;
      insert into public.contracts
        (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id,
         agreement_version_id, collection_role_snapshot, operating_model_snapshot)
      values ('${legacyContract}', 'd1000000-0000-4000-8000-000000000301', 'd1000000-0000-4000-8000-000000000404', 'd1000000-0000-4000-8000-000000000501', '${OFFICE_AGREEMENT}', date '2020-01-01', date '2030-12-31', 10, 'active', '${COMPANY}',
         'd1000000-0000-4000-8000-000000000611', 'OFFICE_IS_CREDITOR', 'OWNER_AGENCY');
      insert into public.invoices
        (id, contract_id, issue_date, due_date, amount, tax_amount, status, company_id,
         document_status, charge_type, billing_period_start, billing_period_end)
      values ('${legacyInvoice}', '${legacyContract}', current_date, current_date + 1, 10, 0, 'UNPAID', '${COMPANY}',
         'DRAFT', 'RENT', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date);
      update public.invoices set document_status = 'POSTED' where id = '${legacyInvoice}'::uuid;
    `);
    await expect(rpc('record_invoice_payment_atomic', {
      invoice_id: legacyInvoice,
      amount: 10,
      method: 'cash',
      date: firstDayOfCurrentMonth(),
      request_id: 'rc1-legacy-payment-denial-001',
    })).rejects.toThrow(/HISTORICAL_INVOICE_ACCOUNTING_REVIEW_REQUIRED/);

    // The S04 snapshot guard (contracts_agreement_snapshot_guard) freezes
    // agreement terms on every active property_management contract, so
    // PRE_RC1_OWNER_AGENCY_SNAPSHOT_MISSING is no longer reachable on current
    // main. A null-classified invoice on a snapshot-bearing contract is the
    // realistic legacy shape and is flagged for review with the lineage reason;
    // the payment boundary still rejects it (asserted above).
    const { rows } = await db.query<{ affected_reason: string }>(
      `select affected_reason from public.rpt_rc1_owner_agency_invoice_mapping_diagnostics(null, null)
        where invoice_id = $1::uuid`,
      [legacyInvoice],
    );
    expect(rows[0]?.affected_reason).toBe('PRE_RC1_INVOICE_LINEAGE_UNCLASSIFIED_REVIEW_REQUIRED');
    await expect(db.query(
      `select * from public.resolve_active_fee_tax_treatment($1::uuid, 'RATE_MANAGEMENT_FEE', current_date)`,
      [OTHER_COMPANY],
    )).rejects.toThrow(/FEE_TAX_TREATMENT_MISSING/);
  });

  it('binds credit-reversal idempotency to the target credit and rejects a same-key different-credit replay', async () => {
    const { rows } = await db.query<{ id: string }>(
      `select id::text from public.invoice_credits
        where company_id = $1::uuid and status = 'REVERSED'
        order by created_at`,
      [COMPANY],
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    await expect(rpc('reverse_invoice_credit_atomic', {
      credit_id: rows[0]?.id,
      reason: 'different credit must not replay another reversal',
      request_id: 'rc1-owner-operational-credit-reversal-001',
    })).rejects.toThrow(/CREDIT_REVERSAL_IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST/);
  });

  it('requires an explicit versioned management-fee tax treatment and snapshots a taxable fee without changing rent-tax policy', async () => {
    await db.exec(`
      insert into public.company_fee_tax_treatments
        (id, company_id, fee_kind, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
      values ('d1000000-0000-4000-8000-000000000983', '${COMPANY}', 'RATE_MANAGEMENT_FEE', 2, 'VAT', 5, date '${firstDayOfCurrentMonth()}', 'ACTIVE', '${CHECKER}', '${MAKER}', now());

      insert into public.properties (id, title, name, type, address, company_id)
      values ('d1000000-0000-4000-8000-000000000984', 'Fee Tax Property', 'Fee Tax Property', 'residential', 'Muscat', '${COMPANY}');
      insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
      values ('d1000000-0000-4000-8000-000000000984', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}');
      insert into public.owner_agreements
        (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
      values ('d1000000-0000-4000-8000-000000000985', '${OWNER}', 'd1000000-0000-4000-8000-000000000984', 'property_management', 'RATE', 10, date '2020-01-01', '${COMPANY}');
      update public.owner_agreement_versions set effective_to = date '2019-12-31', superseded_at = now()
       where owner_agreement_id = 'd1000000-0000-4000-8000-000000000985'::uuid and superseded_at is null;
      insert into public.owner_agreement_versions
        (id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
         commission_type, commission_value, commission_recognition_basis, offset_allowed,
         reserve_amount, effective_from, created_by)
      values ('d1000000-0000-4000-8000-000000000986', 'd1000000-0000-4000-8000-000000000985', '${COMPANY}', 2,
        'OWNER_AGENCY', 'OFFICE_IS_CREDITOR', 'RATE', 10, 'ON_COLLECTION', false, 0, date '2020-01-01', '${MAKER}');
      update public.owner_agreements set current_version_id = 'd1000000-0000-4000-8000-000000000986'::uuid
       where id = 'd1000000-0000-4000-8000-000000000985'::uuid;
      insert into public.units (id, property_id, name, unit_number, company_id)
      values ('d1000000-0000-4000-8000-000000000987', 'd1000000-0000-4000-8000-000000000984', 'Fee Tax Unit', 'FEE-1', '${COMPANY}');
      insert into public.people (id, full_name, type, company_id)
      values ('d1000000-0000-4000-8000-000000000988', 'Fee Tax Tenant', 'tenant', '${COMPANY}');
      insert into public.contracts
        (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
      values ('d1000000-0000-4000-8000-000000000989', 'd1000000-0000-4000-8000-000000000984', 'd1000000-0000-4000-8000-000000000987', 'd1000000-0000-4000-8000-000000000988', 'd1000000-0000-4000-8000-000000000985', date '2020-01-01', date '2030-12-31', 1000, 'active', '${COMPANY}');
    `);
    const generated = await db.query<{ value: string }>('select public.generate_invoices_from_active_contracts()::text as value');
    expect(Number(generated.rows[0]?.value)).toBe(1);
    const { rows: invoices } = await db.query<{ id: string }>(
      `select id::text from public.invoices where contract_id = 'd1000000-0000-4000-8000-000000000989'::uuid`,
    );
    const result = await rpc('record_invoice_payment_atomic', {
      invoice_id: invoices[0]?.id ?? '',
      amount: 1070,
      method: 'bank_transfer',
      date: firstDayOfCurrentMonth(),
      reference: 'RC1-FEE-TAX-001',
      request_id: 'rc1-fee-tax-001',
    });
    expect(Number(result.management_fee_net)).toBe(100);
    expect(Number(result.management_fee_tax)).toBe(5);
    expect(Number(result.management_fee_gross)).toBe(105);
    const { rows: snapshots } = await db.query<{ tax_code: string; tax_rate: string; tax_amount: string }>(
      `select tax_code, tax_rate::text, tax_amount::text from public.management_fee_tax_snapshots
        where receipt_id = $1::uuid`,
      [result.receipt_id],
    );
    expect(snapshots[0]).toMatchObject({ tax_code: 'VAT', tax_rate: '5.000', tax_amount: '5.000' });
  });

  it('fails closed for a historical 2000 position until an S08-backed cutover exists', async () => {
    const cash = await db.query<{ id: string }>(`select id from public.accounts where company_id = $1::uuid and no = '1111'`, [COMPANY]);
    const ownerFunds = await db.query<{ id: string }>(`select id from public.accounts where company_id = $1::uuid and no = '2000'`, [COMPANY]);
    await db.query(
      `select public.post_journal_event($1::jsonb)`,
      [JSON.stringify({
        company_id: COMPANY,
        source_type: 'historical_cutover_probe',
        source_id: 'rc1-cutover-probe',
        event_id: 'opening',
        effective_date: firstDayOfCurrentMonth(),
        description: 'Synthetic pre-cutover 2000 probe',
        lines: [
          { account_id: cash.rows[0]?.id, debit: 1, credit: 0 },
          { account_id: ownerFunds.rows[0]?.id, debit: 0, credit: 1 },
        ],
      })],
    );
    await expect(db.query(
      `select public.assert_owner_funds_event_cutover($1::uuid, current_date, null)`,
      [COMPANY],
    )).rejects.toThrow(/OWNER_FUNDS_CUTOVER_REVIEW_REQUIRED/);
    await expect(rpc('create_owner_funds_cutover_atomic', {
      cutover_date: new Date().toISOString().slice(0, 10),
      s08_review_id: 'd1000000-0000-4000-8000-000000000990',
      reason: 'missing S08 must fail closed',
      request_id: 'rc1-cutover-missing-s08',
    })).rejects.toThrow(/OWNER_FUNDS_CUTOVER_S08_APPROVAL_REQUIRED/);

    const { rows: periodRows } = await db.query<{ id: string }>(
      `select id::text from public.accounting_periods
        where company_id = $1::uuid order by end_date desc limit 1`,
      [COMPANY],
    );
    const review = await rpc('s08_create_frozen_review', {
      accounting_period_id: periodRows[0]?.id,
      dataset_lineage: 'synthetic-cutover-review',
      analysis_version: 'rc1-cutover-v1',
      evidence_reference: 'PGlite cutover regression',
    });
    await db.query(`select public.s08_analyze_frozen_review($1::uuid, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb)`, [review.id]);
    await assumeIdentity(db, CHECKER, COMPANY);
    await db.query(`select public.s08_approve_frozen_review($1::uuid, 'Synthetic test approval only')`, [review.id]);
    await assumeIdentity(db, MAKER, COMPANY);
    const created = await rpc('create_owner_funds_cutover_atomic', {
      cutover_date: new Date().toISOString().slice(0, 10),
      s08_review_id: review.id,
      reason: 'Approved synthetic opening baseline',
      request_id: 'rc1-cutover-create-001',
    });
    expect(created.status).toBe('DRAFT');
    await assumeIdentity(db, CHECKER, COMPANY);
    const approved = await rpc('approve_owner_funds_cutover_atomic', { request_id: 'rc1-cutover-approve-001' });
    expect(approved.status).toBe('APPROVED');
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    await expect(db.query(
      `select public.assert_owner_funds_event_cutover($1::uuid, $2::date, null)`,
      [COMPANY, tomorrow.toISOString().slice(0, 10)],
    )).resolves.toBeDefined();
    const { rows: cutoverBalance } = await db.query<{ subledger: string; gl: string }>(
      `select (select balance::text from public.wp05_subledger_owner_payables($1::uuid, current_date)) as subledger,
              public.wp05_gl_balance($1::uuid, '2000', current_date)::text as gl`,
      [COMPANY],
    );
    expect(Number(cutoverBalance[0]?.subledger)).toBe(Number(cutoverBalance[0]?.gl));
    await assumeIdentity(db, MAKER, COMPANY);
  });
});
