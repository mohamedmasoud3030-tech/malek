/**
 * Stage S04 — Property Management, Commissions, Expenses, Deposits,
 * Reconciliation and Diagnostics GL Lifecycle Tests (PGlite).
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase, assumeIdentity } from '../p1/replay-bootstrap';

let db: PGlite;

const COMPANY_A = 'c4000000-0000-4000-8000-000000000001';
const COMPANY_B = 'c4000000-0000-4000-8000-000000000002';
const ADMIN_A = 'a4000000-0000-4000-8000-000000000001';
const ADMIN_B = 'a4000000-0000-4000-8000-000000000002';
const OWNER_A = '0a040000-0000-4000-8000-000000000001';
const SETTLEMENT_1 = 'stl-pm-test-001';

async function rpc(dbh: PGlite, name: string, payload: Record<string, unknown>) {
  const { rows } = await dbh.query<{ res: string }>(
    `select public.${name}($1::jsonb)::text as res`,
    [JSON.stringify(payload)],
  );
  return JSON.parse(rows[0]?.res ?? '{}');
}

async function getAccountBalance(dbh: PGlite, companyId: string, accountNo: string) {
  const { rows } = await dbh.query<{ debit: string; credit: string }>(
    `select coalesce(sum(l.debit), 0)::text as debit,
            coalesce(sum(l.credit), 0)::text as credit
       from public.journal_lines l
       join public.journal_batches b on b.id = l.batch_id
       join public.accounts a on a.id = l.account_id
      where b.company_id = $1::uuid
        and b.status = 'POSTED'
        and a.no = $2`,
    [companyId, accountNo],
  );
  const d = Number(rows[0]?.debit ?? 0);
  const c = Number(rows[0]?.credit ?? 0);
  return { debit: d, credit: c, netDebit: d - c, netCredit: c - d };
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY_A}', 'Company A', 'co-a'),
      ('${COMPANY_B}', 'Company B', 'co-b')
    on conflict (id) do nothing;

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${ADMIN_A}', 'admin.a@test.invalid', '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${ADMIN_B}', 'admin.b@test.invalid', '{"company_id":"${COMPANY_B}"}'::jsonb)
    on conflict (id) do nothing;

    insert into public.users (id, email, name, role, status, is_active) values
      ('${ADMIN_A}', 'admin.a@test.invalid', 'Admin A', 'ADMIN', 'ACTIVE', true),
      ('${ADMIN_B}', 'admin.b@test.invalid', 'Admin B', 'ADMIN', 'ACTIVE', true)
    on conflict (id) do nothing;

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN'),
      ('${COMPANY_B}', '${ADMIN_B}', 'ADMIN')
    on conflict do nothing;

    insert into public.owners (id, full_name, name, company_id) values
      ('${OWNER_A}', 'Owner A', 'Owner A', '${COMPANY_A}')
    on conflict (id) do nothing;
  `);

  await assumeIdentity(db, ADMIN_A, COMPANY_A);
  await db.query(`select public.provision_company_chart_of_accounts($1::uuid)`, [COMPANY_A]);
  await assumeIdentity(db, ADMIN_B, COMPANY_B);
  await db.query(`select public.provision_company_chart_of_accounts($1::uuid)`, [COMPANY_B]);

  await assumeIdentity(db, ADMIN_A, COMPANY_A);
  await db.exec(`
    insert into public.accounting_periods (company_id, name, start_date, end_date, status) values
      ('${COMPANY_A}', '2026-08', date '2026-08-01', date '2026-08-31', 'OPEN'),
      ('${COMPANY_B}', '2026-08', date '2026-08-01', date '2026-08-31', 'OPEN')
    on conflict (company_id, name) do nothing;
  `);
}, 300_000);

afterAll(async () => {
  await db?.close();
});

describe('Stage S04 — Property Management Accounting Lifecycle', () => {
  it('executes the 1000 OMR collection / 10% fee / 900 owner payout acceptance scenario', async () => {
    const paymentId = '00000000-0000-4000-8000-000000001001';

    // Step 1: Collect 1000 OMR under OWNER_IS_CREDITOR with 10% (100 OMR) commission
    const collectRes = await rpc(db, 'gl_pm_post_collection_owner_is_creditor', {
      company_id: COMPANY_A,
      payment_id: paymentId,
      collected_amount: 1000,
      commission_net: 100,
      vat_amount: 0,
      effective_date: '2026-08-09',
    });
    expect(collectRes.model).toBe('OWNER_IS_CREDITOR');
    expect(collectRes.collected_amount).toBe(1000);
    expect(collectRes.commission_net).toBe(100);

    // After collection: Cash/Bank (1120) has +1000, OFP (2000) has net credit +900, MFR (4100) has net credit +100
    let bank = await getAccountBalance(db, COMPANY_A, '1120');
    let ofp = await getAccountBalance(db, COMPANY_A, '2000');
    let mfr = await getAccountBalance(db, COMPANY_A, '4100');

    expect(bank.netDebit).toBe(1000);
    expect(ofp.netCredit).toBe(900);
    expect(mfr.netCredit).toBe(100);

    // Step 2: this pre-existing APPROVED row is a historical GL fixture,
    // loaded through maintenance context rather than an authenticated user action.
    await assumeIdentity(db, null, null);
    await db.exec(`
      insert into public.owner_settlements (id, company_id, owner_id, status, period_start, period_end, gross_collected, office_fee, net_payable, approved_at, approved_by)
      values ('${SETTLEMENT_1}', '${COMPANY_A}', '${OWNER_A}', 'APPROVED', '2026-08-01', '2026-08-31', 1000, 100, 900, now(), '${ADMIN_A}')
      on conflict (id) do update set status = 'APPROVED', approved_at = now(), approved_by = '${ADMIN_A}';
    `);
    await assumeIdentity(db, ADMIN_A, COMPANY_A);

    const payRes = await rpc(db, 'gl_pm_post_owner_payment', {
      company_id: COMPANY_A,
      settlement_id: SETTLEMENT_1,
      net_payout: 900,
      effective_date: '2026-08-09',
    });
    expect(payRes.step).toBe('owner_payment');
    expect(payRes.net_payout).toBe(900);

    // Final state of acceptance scenario:
    // Cash/Bank remaining = 100
    // OFP balance = 0
    // Management fee revenue = 100
    bank = await getAccountBalance(db, COMPANY_A, '1120');
    ofp = await getAccountBalance(db, COMPANY_A, '2000');
    mfr = await getAccountBalance(db, COMPANY_A, '4100');

    expect(bank.netDebit).toBe(100);
    expect(ofp.netCredit).toBe(0);
    expect(mfr.netCredit).toBe(100);
  });

  it('rejects owner payout on a DRAFT settlement', async () => {
    const draftSettlement = 'stl-draft-reject';
    await db.exec(`
      insert into public.owner_settlements (id, company_id, owner_id, status, period_start, period_end, gross_collected, office_fee, net_payable)
      values ('${draftSettlement}', '${COMPANY_A}', '${OWNER_A}', 'DRAFT', '2026-08-01', '2026-08-31', 500, 50, 450)
      on conflict (id) do update set status = 'DRAFT';
    `);

    await expect(
      rpc(db, 'gl_pm_post_owner_payment', {
        company_id: COMPANY_A,
        settlement_id: draftSettlement,
        net_payout: 450,
        effective_date: '2026-08-09',
      }),
    ).rejects.toThrow(/cannot post payment for a DRAFT settlement/);
  });

  it('posts OFFICE_IS_CREDITOR invoice and collection accurately', async () => {
    const invoiceId = '00000000-0000-4000-8000-000000002001';
    const paymentId = '00000000-0000-4000-8000-000000002002';

    // 1. Invoice: Dr 1201 Tenant Receivable / Cr 2000 OFP
    const invRes = await rpc(db, 'gl_pm_post_invoice_office_is_creditor', {
      company_id: COMPANY_A,
      invoice_id: invoiceId,
      invoice_amount: 600,
      effective_date: '2026-08-09',
    });
    expect(invRes.model).toBe('OFFICE_IS_CREDITOR');

    let ar = await getAccountBalance(db, COMPANY_A, '1201');
    expect(ar.netDebit).toBe(600);

    // 2. Collection: Dr 1120 Bank / Cr 1201 Tenant Receivable + Commission split
    const collRes = await rpc(db, 'gl_pm_post_collection_office_is_creditor', {
      company_id: COMPANY_A,
      payment_id: paymentId,
      invoice_id: invoiceId,
      collected_amount: 600,
      commission_net: 60,
      vat_amount: 3,
      effective_date: '2026-08-09',
    });
    expect(collRes.step).toBe('collection');

    ar = await getAccountBalance(db, COMPANY_A, '1201');
    expect(ar.netDebit).toBe(0); // cleared

    const vat = await getAccountBalance(db, COMPANY_A, '2100');
    expect(vat.netCredit).toBe(3);
  });

  it('posts FIXED_MONTHLY daily fee accrual (Dr 1300 Due from Owners / Cr 4100 MFR)', async () => {
    const agreementId = '00000000-0000-4000-8000-000000003001';

    const res = await rpc(db, 'gl_pm_accrue_fixed_monthly_fee', {
      company_id: COMPANY_A,
      agreement_id: agreementId,
      accrual_period: '2026-08-01/2026-08-31',
      accrual_net: 80,
      vat_amount: 4,
      effective_date: '2026-08-09',
    });
    expect(res.model).toBe('FIXED_MONTHLY_DAILY_ACCRUAL');
    expect(res.accrual_gross).toBe(84);

    const due = await getAccountBalance(db, COMPANY_A, '1300');
    expect(due.netDebit).toBe(84);
  });

  it('posts Owner Expense correctly (Dr 1300 Due from Owners, NOT 6100 Operating Expense)', async () => {
    const expenseId = '00000000-0000-4000-8000-000000004001';

    const res = await rpc(db, 'gl_pm_post_owner_expense', {
      company_id: COMPANY_A,
      expense_id: expenseId,
      amount: 150,
      effective_date: '2026-08-09',
    });
    expect(res.model).toBe('OWNER_EXPENSE');
    expect(res.amount).toBe(150);

    const due = await getAccountBalance(db, COMPANY_A, '1300');
    // Previous 84 + 150 = 234
    expect(due.netDebit).toBe(234);

    // Verify company operating expense (6100) was NOT touched
    const opex = await getAccountBalance(db, COMPANY_A, '6100');
    expect(opex.netDebit).toBe(0);
  });

  it('derives a deposit damage recipient from the frozen agreement and updates the deposit ledger atomically', async () => {
    const propertyId = '00000000-0000-4000-8000-000000005010';
    const unitId = '00000000-0000-4000-8000-000000005011';
    const tenantId = '00000000-0000-4000-8000-000000005012';
    const agreementId = '00000000-0000-4000-8000-000000005013';
    const contractId = '00000000-0000-4000-8000-000000005014';
    const depositId = '00000000-0000-4000-8000-000000005001';

    await db.exec(`
      insert into public.properties (id, title, name, type, address, company_id)
      values ('${propertyId}', 'Deposit Property', 'Deposit Property', 'residential', 'Sohar', '${COMPANY_A}');

      insert into public.property_owners
        (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
      values ('${propertyId}', '${OWNER_A}', 100, true, date '2026-01-01', '${COMPANY_A}');

      insert into public.owner_agreements
        (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
      values ('${agreementId}', '${OWNER_A}', '${propertyId}', 'property_management', 'RATE', 10, date '2026-01-01', '${COMPANY_A}');

      insert into public.units (id, property_id, name, unit_number, company_id)
      values ('${unitId}', '${propertyId}', 'Deposit Unit', 'D-1', '${COMPANY_A}');

      insert into public.people (id, full_name, type, company_id)
      values ('${tenantId}', 'Deposit Tenant', 'tenant', '${COMPANY_A}');

      insert into public.contracts
        (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
      values (
        '${contractId}', '${propertyId}', '${unitId}', '${tenantId}', '${agreementId}',
        date '2026-01-01', date '2026-12-31', 1000, 'active', '${COMPANY_A}'
      );

      update public.owner_agreement_versions
         set deposit_beneficiary = 'OWNER'
       where owner_agreement_id = '${agreementId}'::uuid
         and company_id = '${COMPANY_A}'::uuid;

      insert into public.tenant_deposits
        (id, contract_id, tenant_id, property_id, unit_id, deposit_amount, remaining_amount, status, received_date, request_id, company_id)
      values (
        '${depositId}', '${contractId}', '${tenantId}', '${propertyId}', '${unitId}',
        300, 300, 'held', date '2026-08-09', 's04-deposit-seed', '${COMPANY_A}'
      );
    `);

    await rpc(db, 'gl_pm_post_deposit_receipt', {
      company_id: COMPANY_A,
      deposit_id: depositId,
      amount: 300,
      effective_date: '2026-08-09',
    });
    let dep = await getAccountBalance(db, COMPANY_A, '2200');
    expect(dep.netCredit).toBe(300);

    await rpc(db, 'gl_pm_post_deposit_refund', {
      company_id: COMPANY_A,
      deposit_id: depositId,
      amount: 100,
      effective_date: '2026-08-09',
    });
    dep = await getAccountBalance(db, COMPANY_A, '2200');
    expect(dep.netCredit).toBe(200);

    // OWNER is frozen as the damage beneficiary: the caller cannot redirect the
    // credit to office revenue 4300. It must increase Owner Funds Payable 2000.
    const applied = await rpc(db, 'gl_pm_post_deposit_application', {
      company_id: COMPANY_A,
      deposit_id: depositId,
      target_type: 'damage',
      amount: 200,
      effective_date: '2026-08-09',
    });
    expect(applied.target_account_no).toBe('2000');

    dep = await getAccountBalance(db, COMPANY_A, '2200');
    expect(dep.netCredit).toBe(0);
    const ofp = await getAccountBalance(db, COMPANY_A, '2000');
    expect(ofp.netCredit).toBe(737); // 537 from earlier OFC collection + 200 damage deposit
    const dmg = await getAccountBalance(db, COMPANY_A, '4300');
    expect(dmg.netCredit).toBe(0);

    const { rows } = await db.query<{ remaining_amount: string; refunded_amount: string; deducted_amount: string }>(
      `select remaining_amount::numeric::text as remaining_amount,
              refunded_amount::numeric::text as refunded_amount,
              deducted_amount::numeric::text as deducted_amount
         from public.tenant_deposits where id = $1`,
      [depositId],
    );
    expect(Number(rows[0]?.remaining_amount)).toBe(0);
    expect(Number(rows[0]?.refunded_amount)).toBe(100);
    expect(Number(rows[0]?.deducted_amount)).toBe(200);
  });

  it('posts Broker Commission approval and payout flows', async () => {
    const commId = '00000000-0000-4000-8000-000000006001';

    // 1. Approval: Dr 6110 Broker Commission Expense / Cr 2300 Broker Commissions Payable
    await rpc(db, 'gl_pm_post_broker_commission_approval', {
      company_id: COMPANY_A,
      commission_id: commId,
      amount: 250,
      effective_date: '2026-08-09',
    });
    let commExp = await getAccountBalance(db, COMPANY_A, '6110');
    let commPay = await getAccountBalance(db, COMPANY_A, '2300');
    expect(commExp.netDebit).toBe(250);
    expect(commPay.netCredit).toBe(250);

    // 2. Payment: Dr 2300 Broker Commissions Payable / Cr Bank
    await rpc(db, 'gl_pm_post_broker_commission_payment', {
      company_id: COMPANY_A,
      commission_id: commId,
      amount: 250,
      effective_date: '2026-08-09',
    });
    commPay = await getAccountBalance(db, COMPANY_A, '2300');
    expect(commPay.netCredit).toBe(0);
  });

  it('proves Company B is 100% isolated from Company A transactions', async () => {
    const { rows: bBatches } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.journal_batches where company_id = $1::uuid`,
      [COMPANY_B],
    );
    expect(bBatches[0]?.n).toBe(0);

    const ofpB = await getAccountBalance(db, COMPANY_B, '2000');
    expect(ofpB.netCredit).toBe(0);
  });

  it('executes subledger-to-GL reconciliation and historical diagnostics', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const { rows: recon } = await db.query(
      `select * from public.gl_reconcile_subledgers(current_date)`,
    );
    expect(recon.length).toBeGreaterThanOrEqual(5);

    const { rows: diag } = await db.query(
      `select * from public.gl_diagnose_historical_financial_integrity()`,
    );
    expect(Array.isArray(diag)).toBe(true);
  });
});
