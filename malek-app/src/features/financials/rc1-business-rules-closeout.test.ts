/**
 * RC1 business rules closeout — deterministic PGlite proof.
 *
 * Proves, against the live replayed schema (including migration
 * 20260901000031_rc1_business_rules_closeout.sql):
 *
 *  - Rule 1: an owner-agency invoice journal crediting 4000 is rejected at the
 *    database level, while a legitimate master-lease posting credits 4000.
 *  - Rule 3: fixed monthly rent posts in full for the billing period with no
 *    daily proration (regression coverage).
 *  - Rule 4: 'payment' is rejected as a commission source type at the DB level
 *    (CHECK) and the RPC level (create/update), while commission approval,
 *    financial payment and reversal keep working for canonical types.
 *  - Rule 5: LATE_FEE invoice charge types and automation jobs are rejected
 *    on insert and update (fail-closed), while bank reconciliation matching
 *    of a posted manual_adjustment journal batch still succeeds.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'e1000000-0000-4000-8000-000000000001';
const MAKER = 'e1000000-0000-4000-8000-000000000011';
const CHECKER = 'e1000000-0000-4000-8000-000000000012';
const OWNER = 'e1000000-0000-4000-8000-000000000021';
const PROFILE = 'e1000000-0000-4000-8000-000000000031';
const PROPERTY = 'e1000000-0000-4000-8000-000000000301';
const ML_PROPERTY = 'e1000000-0000-4000-8000-000000000302';
const UNIT = 'e1000000-0000-4000-8000-000000000401';
const ML_UNIT = 'e1000000-0000-4000-8000-000000000402';
const TENANT = 'e1000000-0000-4000-8000-000000000501';
const AGREEMENT = 'e1000000-0000-4000-8000-000000000101';
const AGREEMENT_V2 = 'e1000000-0000-4000-8000-000000000611';
const ML_AGREEMENT = 'e1000000-0000-4000-8000-000000000102';
const CONTRACT = 'e1000000-0000-4000-8000-000000000201';
const ML_CONTRACT = 'e1000000-0000-4000-8000-000000000202';
const BANK_ACCOUNT = 'e1000000-0000-4000-8000-000000000701';
const STATEMENT_LINE = 'e1000000-0000-4000-8000-000000000702';

const RENT = 1000;

let db: PGlite;
let rentInvoiceId = '';
let commissionId = '';

async function rpc(name: string, payload: Record<string, unknown>) {
  const { rows } = await db.query<{ value: string }>(
    `select public.${name}($1::jsonb)::text as value`,
    [JSON.stringify(payload)],
  );
  return JSON.parse(rows[0]?.value ?? '{}') as Record<string, unknown>;
}

function accountId(accountNo: string) {
  return `coa:${COMPANY}:${accountNo}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function netCredit(accountNo: string): Promise<number> {
  const { rows } = await db.query<{ value: string }>(
    `select coalesce(sum(jl.credit - jl.debit), 0)::text as value
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

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug)
      values ('${COMPANY}', 'RC1 Closeout Co', 'rc1-closeout-co');

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MAKER}', 'maker@rc1-closeout.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${CHECKER}', 'checker@rc1-closeout.test', '{"company_id":"${COMPANY}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${MAKER}', 'maker@rc1-closeout.test', 'Maker', 'ADMIN', 'ACTIVE', true),
      ('${CHECKER}', 'checker@rc1-closeout.test', 'Checker', 'ADMIN', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${MAKER}', 'ADMIN'),
      ('${COMPANY}', '${CHECKER}', 'ADMIN');

    insert into public.company_settings
      (id, singleton_key, company_name, currency, default_vat_rate, vat_enabled, vat_rate, company_id)
    values
      (gen_random_uuid(), true, 'RC1 Closeout Co', 'OMR', 0, false, 0, '${COMPANY}');

    insert into public.company_tax_profiles
      (id, company_id, version_no, tax_code, tax_rate, effective_from,
       status, created_by, approved_by, approved_at)
    values
      ('${PROFILE}', '${COMPANY}', 1, 'NON_TAXABLE', 0.000, date '2020-01-01',
       'ACTIVE', '${MAKER}', '${CHECKER}', now());

    insert into public.owners (id, full_name, name, company_id)
      values ('${OWNER}', 'RC1 Closeout Owner', 'RC1 Closeout Owner', '${COMPANY}');

    insert into public.properties (id, title, name, type, address, company_id)
      values ('${PROPERTY}', 'Closeout Property', 'Closeout Property', 'residential', 'Muscat', '${COMPANY}'),
             ('${ML_PROPERTY}', 'Closeout Master Lease Property', 'Closeout Master Lease Property', 'residential', 'Muscat', '${COMPANY}');

    insert into public.property_owners
      (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values
      ('${PROPERTY}', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}'),
      ('${ML_PROPERTY}', '${OWNER}', 100, true, date '2020-01-01', '${COMPANY}');

    -- owner_agreements carries a per-property daterange exclusion, so the
    -- master-lease agreement lives on its own property.
    insert into public.owner_agreements
      (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values
      ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 10, date '2020-01-01', '${COMPANY}'),
      ('${ML_AGREEMENT}', '${OWNER}', '${ML_PROPERTY}', 'master_lease', 'FIXED_MONTHLY', 0, date '2020-01-01', '${COMPANY}');

    -- The initial agreement trigger creates v1 as OWNER_IS_CREDITOR; create
    -- proper replacement terms before the contract snapshot is taken.
    update public.owner_agreement_versions
       set effective_to = date '2019-12-31', superseded_at = now()
     where owner_agreement_id = '${AGREEMENT}'::uuid
       and company_id = '${COMPANY}'::uuid
       and superseded_at is null;
    insert into public.owner_agreement_versions (
      id, owner_agreement_id, company_id, version_no, operating_model,
      collection_role, commission_type, commission_value,
      commission_recognition_basis, offset_allowed, reserve_amount,
      effective_from, created_by
    ) values
      ('${AGREEMENT_V2}', '${AGREEMENT}', '${COMPANY}', 2,
       'OWNER_AGENCY', 'OFFICE_IS_CREDITOR', 'RATE', 10, 'ON_COLLECTION', false, 0,
       date '2020-01-01', '${MAKER}');
    update public.owner_agreements
       set current_version_id = '${AGREEMENT_V2}'::uuid
     where id = '${AGREEMENT}'::uuid;

    insert into public.units (id, property_id, name, unit_number, company_id)
      values ('${UNIT}', '${PROPERTY}', 'Closeout Unit', 'CLO-1', '${COMPANY}'),
             ('${ML_UNIT}', '${ML_PROPERTY}', 'Closeout ML Unit', 'CLO-ML-1', '${COMPANY}');

    insert into public.people (id, full_name, type, company_id)
      values ('${TENANT}', 'Closeout Tenant', 'tenant', '${COMPANY}');

    -- Active owner-agency contract: the contract trigger freezes the v2
    -- OFFICE_IS_CREDITOR snapshot. The master-lease contract stays DRAFT —
    -- MASTER_LEASE is excluded from the RC1 recurring generator scope (it is
    -- posted through the gl_ml_* kernels) and must not enter the generator.
    insert into public.contracts
      (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
    values
      ('${CONTRACT}', '${PROPERTY}', '${UNIT}', '${TENANT}', '${AGREEMENT}', date '2020-01-01', date '2030-12-31', ${RENT}, 'active', '${COMPANY}'),
      ('${ML_CONTRACT}', '${ML_PROPERTY}', '${ML_UNIT}', '${TENANT}', '${ML_AGREEMENT}', date '2020-01-01', date '2030-12-31', ${RENT}, 'draft', '${COMPANY}');

    insert into public.bank_accounts (id, company_id, account_name, account_code)
      values ('${BANK_ACCOUNT}', '${COMPANY}', 'Closeout Bank', 'BANK-CLO-1');

    insert into public.bank_statement_lines
      (id, company_id, bank_account_id, transaction_date, description, amount, status)
    values
      ('${STATEMENT_LINE}', '${COMPANY}', '${BANK_ACCOUNT}', '${today()}', 'Manual adjustment sweep', -50.000, 'unmatched');
  `);

  await assumeIdentity(db, MAKER, COMPANY);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);
  await db.query('select public.gl_ensure_initial_open_period($1::uuid, $2::date)', [COMPANY, today()]);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('RC1 Rule 1 — 4000 is master-lease revenue only', () => {
  it('rejects an owner-agency invoice journal crediting 4000 at the database level', async () => {
    await expect(
      rpc('post_journal_event', {
        company_id: COMPANY,
        source_type: 'invoice',
        source_id: 'rc1-guard-owner-agency-4000',
        event_id: 'issue',
        effective_date: today(),
        description: 'attempt to manufacture owner-agency revenue in 4000',
        lines: [
          { account_id: accountId('1201'), debit: RENT, credit: 0 },
          { account_id: accountId('4000'), debit: 0, credit: RENT },
        ],
      }),
    ).rejects.toThrow('RC1_4000_NON_MASTER_LEASE_CREDIT_BLOCKED');

    const { rows } = await db.query<{ count: number }>(
      `select count(*)::int as count from public.journal_batches
        where company_id = $1::uuid and source_id = 'rc1-guard-owner-agency-4000'`,
      [COMPANY],
    );
    expect(rows[0]?.count).toBe(0);
  });

  it('also rejects the legacy journal_entries compatibility path crediting 4000', async () => {
    await expect(
      db.query(
        `insert into public.journal_entries
           (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, company_id)
         values
           (gen_random_uuid()::text, 'RC1-GUARD-4000', $1::text, $2, 250, 'CREDIT',
            'rc1-guard-legacy-4000', 'manual_adjustment', 'rc1-guard-legacy-4000', $3::uuid)`,
        [today(), accountId('4000'), COMPANY],
      ),
    ).rejects.toThrow('RC1_4000_NON_MASTER_LEASE_CREDIT_BLOCKED');
  });

  it('allows a legitimate master-lease sublease receipt to credit 4000', async () => {
    const result = await rpc('gl_ml_post_sublease_receipt', {
      company_id: COMPANY,
      contract_id: ML_CONTRACT,
      source_id: 'rc1-ml-sublease-1',
      amount: 750,
      effective_date: today(),
      cash_account_no: '1120',
    });
    const batchId = (result.batch as { batch_id: string }).batch_id;
    expect(batchId).toBeTruthy();

    const { rows } = await db.query<{ status: string; no: string; debit: string; credit: string }>(
      `select jb.status, a.no, jl.debit::text, jl.credit::text
         from public.journal_lines jl
         join public.journal_batches jb on jb.id = jl.batch_id
         join public.accounts a on a.id = jl.account_id and a.company_id = jb.company_id
        where jl.batch_id = $1::uuid
        order by a.no`,
      [batchId],
    );
    expect(rows.map((row) => row.status)).toEqual(['POSTED', 'POSTED']);
    expect(rows.map((row) => `${row.no}:${row.debit}>${row.credit}`)).toEqual([
      '1120:750.000>0.000',
      '4000:0.000>750.000',
    ]);
    expect(await netCredit('4000')).toBe(750);
  });
});

describe('RC1 Rule 3 — fixed monthly rent posts in full, no daily proration', () => {
  it('generates the current-period rent invoice at the full fixed monthly amount', async () => {
    const generated = await db.query<{ value: string }>(
      'select public.generate_invoices_from_active_contracts()::text as value',
    );
    expect(Number(generated.rows[0]?.value)).toBe(1);

    const { rows } = await db.query<{
      id: string;
      amount: string;
      tax_amount: string;
      charge_type: string;
      invoice_collection_role: string;
      invoice_posting_batch_id: string | null;
    }>(
      `select id::text, amount::text, tax_amount::text, charge_type,
              invoice_collection_role, invoice_posting_batch_id::text
         from public.invoices
        where company_id = $1::uuid and contract_id = $2::uuid and deleted_at is null
        order by created_at desc limit 1`,
      [COMPANY, CONTRACT],
    );
    expect(rows).toHaveLength(1);
    const invoice = rows[0];
    rentInvoiceId = invoice.id;

    // Fixed monthly rent: the full fixed amount for the billing period is
    // posted — never a day-count proration of the monthly figure.
    expect(invoice.charge_type).toBe('RENT');
    expect(Number(invoice.amount)).toBe(RENT);
    expect(Number(invoice.tax_amount)).toBe(0);

    const { rows: batchRows } = await db.query<{ no: string; debit: string; credit: string }>(
      `select a.no, jl.debit::text, jl.credit::text
         from public.journal_lines jl
         join public.journal_batches jb on jb.id = jl.batch_id
         join public.accounts a on a.id = jl.account_id and a.company_id = jb.company_id
        where jl.batch_id = $1::uuid
        order by a.no`,
      [invoice.invoice_posting_batch_id!],
    );
    expect(batchRows.map((row) => `${row.no}:${row.debit}>${row.credit}`)).toEqual([
      '1201:1000.000>0.000',
      '2000:0.000>1000.000',
    ]);
    // Owner-agency rent never lands in 4000.
    expect(await netCredit('4000')).toBe(750);
  });
});

describe('RC1 Rule 4 — commission source domain excludes payment', () => {
  it('rejects a payment-type commission at the DB level (CHECK constraint)', async () => {
    const constraint = await db.query<{ definition: string }>(
      `select pg_get_constraintdef(oid) as definition
         from pg_constraint
        where conrelid = 'public.commissions'::regclass
          and conname = 'commissions_type_check'`,
    );
    expect(constraint.rows).toHaveLength(1);
    expect(constraint.rows[0]?.definition).toContain("ARRAY['contract'::text, 'owner'::text, 'lead'::text, 'land'::text]");
    expect(constraint.rows[0]?.definition).not.toContain("'payment'::text");

    await expect(
      db.query(
        `insert into public.commissions (id, staff_name, type, status, amount, company_id)
         values (gen_random_uuid()::text, 'Guard Agent', 'payment', 'pending', 100, $1::uuid)`,
        [COMPANY],
      ),
    ).rejects.toThrow(/violates check constraint/);

    // Canonical source types remain writable.
    await db.query(
      `insert into public.commissions (id, staff_name, type, source_id, status, amount, company_id)
       values ('e1000000-0000-4000-8000-000000000901', 'Guard Agent', 'contract', $1::text, 'pending', 100, $2::uuid)`,
      [CONTRACT, COMPANY],
    );
  });

  it('rejects payment through create/update RPCs with a stable code', async () => {
    await expect(
      rpc('create_commission_atomic', {
        staff_name: 'Guard Agent',
        type: 'payment',
        amount: 100,
        request_id: 'rc1-comm-guard-create-payment',
      }),
    ).rejects.toThrow('COMMISSION_TYPE_PAYMENT_REMOVED');

    const seeded = await rpc('create_commission_atomic', {
      staff_name: 'Guard Agent Update',
      type: 'contract',
      source_id: CONTRACT,
      deal_value: 1000,
      percentage: 2.5,
      request_id: 'rc1-comm-guard-update-seed',
    });
    const seededCommission = seeded.commission;
    expect(seededCommission && typeof seededCommission === 'object' && !Array.isArray(seededCommission)).toBe(true);
    const seededCommissionId = (seededCommission as Record<string, unknown>).id;
    expect(typeof seededCommissionId).toBe('string');
    await expect(
      rpc('update_commission_atomic', {
        commission_id: seededCommissionId,
        staff_name: 'Guard Agent',
        type: 'payment',
        requested_status: 'approved',
        amount: 100,
        request_id: 'rc1-comm-guard-update-payment',
      }),
    ).rejects.toThrow('COMMISSION_TYPE_PAYMENT_REMOVED');

    const { rows } = await db.query<{ count: number }>(
      `select count(*)::int as count from public.financial_operation_idempotency
        where request_id in ('rc1-comm-guard-create-payment', 'rc1-comm-guard-update-payment')`,
    );
    expect(rows[0]?.count).toBe(0);
  });

  it('preserves approval, financial payment and reversal for a canonical commission', async () => {
    const created = await rpc('create_commission_atomic', {
      staff_name: 'Closeout Broker',
      type: 'contract',
      source_id: CONTRACT,
      deal_value: 1000,
      percentage: 2.5,
      request_id: 'rc1-comm-lifecycle-create',
    });
    commissionId = (created.commission as { id: string }).id;
    expect((created.commission as { status: string }).status).toBe('pending');

    const approved = await rpc('update_commission_atomic', {
      commission_id: commissionId,
      staff_name: 'Closeout Broker',
      type: 'contract',
      source_id: CONTRACT,
      deal_value: 1000,
      percentage: 2.5,
      requested_status: 'approved',
      request_id: 'rc1-comm-lifecycle-approve',
    });
    expect((approved.commission as { status: string }).status).toBe('approved');

    const paid = await rpc('pay_commission_atomic', {
      commission_id: commissionId,
      payment_date: today(),
      request_id: 'rc1-comm-lifecycle-pay',
    });
    expect(paid.success).toBe(true);

    const paidRow = await db.query<{ status: string; expense_id: string | null }>(
      `select status, expense_id::text from public.commissions where id = $1`,
      [commissionId],
    );
    expect(paidRow.rows[0]?.status).toBe('paid');
    expect(paidRow.rows[0]?.expense_id).toBeTruthy();

    const reversed = await rpc('reverse_commission_atomic', {
      commission_id: commissionId,
      reason: 'RC1 closeout lifecycle proof',
      request_id: 'rc1-comm-lifecycle-reverse',
    });
    expect(reversed.success).toBe(true);

    const reversedRow = await db.query<{ status: string }>(
      `select status from public.commissions where id = $1`,
      [commissionId],
    );
    expect(reversedRow.rows[0]?.status).toBe('cancelled');
  });
});

describe('RC1 Rule 5 — LATE_FEE is fail-closed without breaking bank reconciliation', () => {
  it('rejects LATE_FEE invoice inserts and updates', async () => {
    await expect(
      db.query(
        `insert into public.invoices
           (contract_id, issue_date, due_date, amount, charge_type, company_id)
         values ($1::uuid, $2::date, $2::date, 50, 'LATE_FEE', $3::uuid)`,
        [CONTRACT, today(), COMPANY],
      ),
    ).rejects.toThrow('RC1_LATE_FEE_FAIL_CLOSED');

    await expect(
      db.query(`update public.invoices set charge_type = 'LATE_FEE' where id = $1::uuid`, [rentInvoiceId]),
    ).rejects.toThrow('RC1_LATE_FEE_FAIL_CLOSED');

    const { rows } = await db.query<{ count: number }>(
      `select count(*)::int as count from public.invoices
        where company_id = $1::uuid and upper(charge_type) = 'LATE_FEE'`,
      [COMPANY],
    );
    expect(rows[0]?.count).toBe(0);
  });

  it('rejects LATE_FEE automation jobs on insert and update', async () => {
    await expect(
      db.query(`insert into public.automation_jobs (job_name, job_type) values ('late fee sweep', 'LATE_FEE')`),
    ).rejects.toThrow('RC1_LATE_FEE_JOB_FAIL_CLOSED');

    await db.query(`insert into public.automation_jobs (job_name, job_type) values ('overdue check', 'OVERDUE_CHECK')`);
    await expect(
      db.query(`update public.automation_jobs set job_type = 'LATE_FEE' where job_name = 'overdue check'`),
    ).rejects.toThrow('RC1_LATE_FEE_JOB_FAIL_CLOSED');
  });

  it('still matches a posted manual_adjustment journal batch in bank reconciliation', async () => {
    const posted = await rpc('post_journal_event', {
      company_id: COMPANY,
      source_type: 'manual_adjustment',
      source_id: 'rc1-closeout-manual-1',
      event_id: 'adjust',
      effective_date: today(),
      description: 'governed manual adjustment (operating expense vs cash)',
      lines: [
        { account_id: accountId('6100'), debit: 50, credit: 0 },
        { account_id: accountId('1111'), debit: 0, credit: 50 },
      ],
    });
    const batchId = posted.batch_id as string;
    expect(batchId).toBeTruthy();

    const match = await db.query<{ value: string }>(
      `select (public.process_bank_reconciliation_match_atomic($1::jsonb)).matched_entity_id::text as value`,
      [
        JSON.stringify({
          statement_line_id: STATEMENT_LINE,
          matched_entity_type: 'manual_adjustment',
          matched_entity_id: batchId,
          matched_amount: -50,
        }),
      ],
    );
    expect(match.rows[0]?.value).toBe(batchId);

    const { rows } = await db.query<{ status: string }>(
      `select status from public.bank_statement_lines where id = $1::uuid`,
      [STATEMENT_LINE],
    );
    expect(rows[0]?.status).toBe('matched');
  });
});
