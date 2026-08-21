/**
 * PHASE 3 — Credit / Reversal / AR Allocation Integrity.
 *
 * Proves against a full migration replay that invoice credits and their
 * reversals:
 *   - leave the original posted invoice immutable,
 *   - reduce the derived outstanding balance and reconcile to the 1201 AR
 *     control account,
 *   - post balanced, canonical journal batches,
 *   - enforce credit ceilings, duplicate-reversal rejection and idempotency,
 *   - reject cross-company credits,
 *   - drive derived invoice status (UNPAID / PARTIALLY_PAID / PAID).
 * See docs/audits/FINANCIAL_HARDENING_AUDIT_20260815.md (F05, F06, F11, F12, F29).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'c2000000-0000-4000-8000-000000000001';
const MAKER = 'c2000000-0000-4000-8000-000000000011';
const OTHER = 'c2000000-0000-4000-8000-000000000012';
const OTHER_COMPANY = 'c2000000-0000-4000-8000-000000000002';
const OWNER = 'c2000000-0000-4000-8000-000000000021';
const PROPERTY = 'c2000000-0000-4000-8000-000000000031';
const UNIT = 'c2000000-0000-4000-8000-000000000041';
const TENANT = 'c2000000-0000-4000-8000-000000000051';
const CONTRACT = 'c2000000-0000-4000-8000-000000000061';
const AGREEMENT = 'c2000000-0000-4000-8000-000000000071';

const RENT = 1000;

let db: PGlite;
let invoiceId = '';

async function rpc(name: string, payload: Record<string, unknown>) {
  const { rows } = await db.query<{ value: string }>(
    `select public.${name}($1::jsonb)::text as value`,
    [JSON.stringify(payload)],
  );
  return JSON.parse(rows[0]?.value ?? '{}') as Record<string, unknown>;
}

async function glBalance(accountNo: string): Promise<number> {
  const { rows } = await db.query<{ value: string }>(
    `select coalesce(sum(l.debit - l.credit), 0)::text as value
       from public.journal_lines l
       join public.journal_batches b on b.id = l.batch_id
       join public.accounts a on a.id = l.account_id
      where b.company_id = $1::uuid
        and b.status in ('POSTED', 'REVERSED')
        and a.no = $2`,
    [COMPANY, accountNo],
  );
  return Number(rows[0]?.value ?? 0);
}

async function invoiceState() {
  const { rows } = await db.query<{ amount: string; tax_amount: string; paid_amount: string; credited_amount: string; status: string; issue_date: string; due_date: string }>(
    `select amount::text as amount, tax_amount::text as tax_amount,
            paid_amount::text as paid_amount, credited_amount::text as credited_amount,
            status, issue_date::text as issue_date, due_date::text as due_date
       from public.invoices where id::text = $1`,
    [invoiceId],
  );
  return rows[0];
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY}', 'Phase3 Co', 'phase3-co'),
      ('${OTHER_COMPANY}', 'Other Co', 'phase3-other');

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MAKER}', 'maker@phase3.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${OTHER}', 'other@phase3.test', '{"company_id":"${OTHER_COMPANY}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${MAKER}', 'maker@phase3.test', 'Maker', 'ADMIN', 'ACTIVE', true),
      ('${OTHER}', 'other@phase3.test', 'Other', 'ADMIN', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${MAKER}', 'ADMIN'),
      ('${OTHER_COMPANY}', '${OTHER}', 'ADMIN');

    -- vat_rate 0 keeps the credit split exact (rent only).
    insert into public.company_settings
      (id, singleton_key, company_name, currency, default_vat_rate, vat_enabled, vat_rate, company_id)
    values (gen_random_uuid(), true, 'Phase3 Co', 'OMR', 0, false, 0, '${COMPANY}');
    insert into public.company_tax_profiles
      (id, company_id, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
    values
      ('c2000000-0000-4000-8000-000000000082', '${COMPANY}', 1, 'NON_TAXABLE', 0, date '2020-01-01', 'ACTIVE', '${MAKER}', '${OTHER}', now());

    insert into public.owners (id, full_name, name, company_id)
    values ('${OWNER}', 'P3 Owner', 'P3 Owner', '${COMPANY}');
    insert into public.properties (id, title, name, type, address, company_id)
    values ('${PROPERTY}', 'P3 Property', 'P3 Property', 'residential', 'Muscat', '${COMPANY}');
    insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('${PROPERTY}', '${OWNER}', 100, true, date '2026-01-01', '${COMPANY}');
    insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 0, date '2026-01-01', '${COMPANY}');
    -- This credit/reversal suite is the OFFICE_IS_CREDITOR AR model; create a
    -- successor version before the contract freezes its source terms.
    update public.owner_agreement_versions
       set effective_to = date '2025-12-31', superseded_at = now()
     where owner_agreement_id = '${AGREEMENT}'::uuid and superseded_at is null;
    insert into public.owner_agreement_versions
      (id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
       commission_type, commission_value, commission_recognition_basis, offset_allowed,
       reserve_amount, effective_from, created_by)
    values
      ('c2000000-0000-4000-8000-000000000081', '${AGREEMENT}', '${COMPANY}', 2,
       'OWNER_AGENCY', 'OFFICE_IS_CREDITOR', 'RATE', 0, 'ON_COLLECTION', false, 0,
       date '2026-01-01', '${MAKER}');
    update public.owner_agreements
       set current_version_id = 'c2000000-0000-4000-8000-000000000081'::uuid
     where id = '${AGREEMENT}'::uuid;
    insert into public.units (id, property_id, name, unit_number, company_id)
    values ('${UNIT}', '${PROPERTY}', 'P3 Unit', 'P3-1', '${COMPANY}');
    insert into public.people (id, full_name, type, company_id)
    values ('${TENANT}', 'P3 Tenant', 'tenant', '${COMPANY}');
    insert into public.contracts (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
    values ('${CONTRACT}', '${PROPERTY}', '${UNIT}', '${TENANT}', '${AGREEMENT}',
            date '2026-01-01', date '2026-12-31', ${RENT}, 'active', '${COMPANY}');
  `);

  await assumeIdentity(db, MAKER, COMPANY);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);
  const gen = await db.query<{ count: string }>('select public.generate_invoices_from_active_contracts()::text as count');
  expect(Number(gen.rows[0].count)).toBe(1);
  const { rows } = await db.query<{ id: string }>(
    `select id from public.invoices where contract_id::text = $1 and deleted_at is null limit 1`, [CONTRACT],
  );
  invoiceId = rows[0].id;
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('PHASE 3 — credit / reversal / AR allocation integrity', () => {
  it('posting the invoice creates AR and a canonical balanced journal', async () => {
    expect(await glBalance('1201')).toBe(RENT);
    const st = await invoiceState();
    expect(Number(st.amount)).toBe(RENT);
    expect(Number(st.tax_amount)).toBe(0);
    expect(Number(st.credited_amount)).toBe(0);
    expect(st.status).toBe('UNPAID');
  });

  it('a partial credit reduces outstanding, reconciles AR, and leaves the original immutable', async () => {
    const credit = await rpc('create_invoice_credit_atomic', {
      invoice_id: invoiceId,
      amount: 250,
      credit_type: 'PARTIAL',
      reason: 'Agreed concession on August rent',
      request_id: 'p3-credit-1',
    });
    expect(credit.success).toBe(true);
    expect(credit.outstanding_after).toBe(String(750));

    const st = await invoiceState();
    expect(Number(st.credited_amount)).toBe(250);
    expect(st.status).toBe('PARTIALLY_PAID');
    // Original invoice financial fields unchanged.
    expect(Number(st.amount)).toBe(RENT);
    expect(Number(st.tax_amount)).toBe(0);
    // AR control account reconciles to the derived outstanding (1000 - 250).
    expect(await glBalance('1201')).toBe(750);

    // Canonical balanced credit journal exists.
    const { rows } = await db.query<{ diff: string }>(
      `select (sum(l.debit) - sum(l.credit))::text as diff
         from public.journal_lines l join public.journal_batches b on b.id = l.batch_id
        where b.company_id = $1 and b.source_type = 'invoice_credit' and b.status = 'POSTED'`,
      [COMPANY],
    );
    expect(Number(rows[0].diff)).toBe(0);
  });

  it('is idempotent under replay of the same request', async () => {
    const again = await rpc('create_invoice_credit_atomic', {
      invoice_id: invoiceId,
      amount: 250,
      credit_type: 'PARTIAL',
      reason: 'Agreed concession on August rent',
      request_id: 'p3-credit-1',
    });
    expect(again.success).toBe(true);
    expect(String(again.credit_id)).toBeDefined();
    // credited_amount must not double-count.
    expect(Number((await invoiceState()).credited_amount)).toBe(250);
  });

  it('rejects a credit exceeding the eligible outstanding (ceiling)', async () => {
    await expect(
      db.query(`select public.create_invoice_credit_atomic('{"invoice_id":"${invoiceId}","amount":99999,"credit_type":"PARTIAL","reason":"too much","request_id":"p3-credit-over"}'::jsonb)`),
    ).rejects.toThrow(/CREDIT_EXCEEDS_OUTSTANDING/);
  });

  it('rejects a cross-company credit (isolation)', async () => {
    await assumeIdentity(db, OTHER, OTHER_COMPANY);
    await expect(
      db.query(`select public.create_invoice_credit_atomic('{"invoice_id":"${invoiceId}","amount":100,"credit_type":"PARTIAL","reason":"x","request_id":"p3-credit-x-iso"}'::jsonb)`),
    ).rejects.toThrow(/CREDIT_INVOICE_NOT_FOUND_OR_FORBIDDEN|42501/);
    await assumeIdentity(db, MAKER, COMPANY);
  });

  it('a credit that fully clears the invoice drives status PAID and AR to zero', async () => {
    const credit = await rpc('create_invoice_credit_atomic', {
      invoice_id: invoiceId,
      amount: 750,
      credit_type: 'FULL',
      reason: 'Full concession for the period',
      request_id: 'p3-credit-2',
    });
    expect(credit.success).toBe(true);
    expect(Number((await invoiceState()).credited_amount)).toBe(1000);
    expect((await invoiceState()).status).toBe('PAID');
    expect(await glBalance('1201')).toBe(0);
  });

  it('reverses a posted credit (compensating) and restores AR', async () => {
    // Reverse the 250 credit.
    const { rows: credits } = await db.query<{ id: string }>(
      `select id from public.invoice_credits where company_id=$1 and status='POSTED' order by created_at limit 1`, [COMPANY],
    );
    const creditId = credits[0].id;
    const rev = await rpc('reverse_invoice_credit_atomic', {
      credit_id: creditId,
      reason: 'Credit entered in error',
      request_id: 'p3-rev-1',
    });
    expect(rev.success).toBe(true);
    // credited_amount 1000 -> 750, AR 0 -> 250, status PARTIALLY_PAID.
    expect(Number((await invoiceState()).credited_amount)).toBe(750);
    expect((await invoiceState()).status).toBe('PARTIALLY_PAID');
    expect(await glBalance('1201')).toBe(250);
  });

  it('rejects reversing the same credit twice (duplicate reversal)', async () => {
    const { rows: credits } = await db.query<{ id: string }>(
      `select id from public.invoice_credits where company_id=$1 and status='REVERSED' order by created_at limit 1`, [COMPANY],
    );
    await expect(
      db.query(`select public.reverse_invoice_credit_atomic('{"credit_id":"${credits[0].id}","reason":"again","request_id":"p3-rev-dup"}'::jsonb)`),
    ).rejects.toThrow(/CREDIT_ALREADY_REVERSED/);
  });

  it('keeps AR reconciliation consistent after credits and reversals', async () => {
    // After reversal: credited 750, outstanding 250, AR 250. Subledger (via
    // wp05) equals AR control account.
    const { rows } = await db.query<{ balance: string }>(
      `select balance::text as balance from public.wp05_subledger_tenant_receivables($1::uuid, current_date)`, [COMPANY],
    );
    expect(Number(rows[0].balance)).toBe(250);
    expect(await glBalance('1201')).toBe(250);
  });
});
