/**
 * PHASE 1 — Canonical Financial Posting Convergence: OMR 3dp + live-path proof.
 *
 * Proves against a full migration replay that the real application-facing RPC
 * chain (generate_invoices_from_active_contracts -> record_invoice_payment_atomic)
 * converges on the canonical ledger (journal_batches / journal_lines) with exact
 * OMR 3-decimal precision and that the AR subledger reconciles to the 1201
 * control account. See docs/audits/FINANCIAL_HARDENING_AUDIT_20260815.md (F10, F34).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'a1000000-0000-4000-8000-000000000001';
const MAKER = 'a1000000-0000-4000-8000-000000000011';
const OTHER = 'a1000000-0000-4000-8000-000000000012';
const OTHER_COMPANY = 'a1000000-0000-4000-8000-000000000002';
const OWNER = 'a1000000-0000-4000-8000-000000000021';
const PROPERTY = 'a1000000-0000-4000-8000-000000000031';
const UNIT = 'a1000000-0000-4000-8000-000000000041';
const TENANT = 'a1000000-0000-4000-8000-000000000051';
const CONTRACT = 'a1000000-0000-4000-8000-000000000061';
const AGREEMENT = 'a1000000-0000-4000-8000-000000000071';

const RENT = 1234.567; // 3-decimal OMR rent (must survive exactly)
const VAT_RATE = 5;
const TAX = Math.round(RENT * VAT_RATE / 100 * 1000) / 1000; // 61.728
const TOTAL = Math.round((RENT + TAX) * 1000) / 1000; // 1296.295

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

async function invoiceOutstanding(inv: string): Promise<number> {
  const { rows } = await db.query<{ value: string }>(
    `select (amount + coalesce(tax_amount,0) - paid_amount)::text as value
       from public.invoices where id::text = $1`,
    [inv],
  );
  return Number(rows[0]?.value ?? 0);
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY}', 'Phase1 Co', 'phase1-co'),
      ('${OTHER_COMPANY}', 'Other Co', 'phase1-other');

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MAKER}', 'maker@phase1.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${OTHER}', 'other@phase1.test', '{"company_id":"${OTHER_COMPANY}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${MAKER}', 'maker@phase1.test', 'Maker', 'ADMIN', 'ACTIVE', true),
      ('${OTHER}', 'other@phase1.test', 'Other', 'ADMIN', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${MAKER}', 'ADMIN'),
      ('${OTHER_COMPANY}', '${OTHER}', 'ADMIN');

    -- singleton_key is globally unique (default true row already exists), so a
    -- company-scoped settings row must use a distinct non-true singleton_key.
    insert into public.company_settings
      (id, singleton_key, company_name, currency, invoice_prefix, contract_prefix, receipt_prefix,
       default_vat_rate, vat_enabled, vat_rate, company_id)
    values
      (gen_random_uuid(), false, 'Phase1 Co', 'OMR', 'INV', 'CON', 'REC', ${VAT_RATE}, true, ${VAT_RATE}, '${COMPANY}');

    -- Rate authority is the effective versioned profile, not company_settings.vat_rate.
    insert into public.company_tax_profiles
      (id, company_id, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
    values
      ('a1000000-0000-4000-8000-000000000081', '${COMPANY}', 1, 'VAT', ${VAT_RATE}, date '2020-01-01', 'ACTIVE', '${MAKER}', '${OTHER}', now());

    insert into public.owners (id, full_name, name, company_id)
    values ('${OWNER}', 'P1 Owner', 'P1 Owner', '${COMPANY}');

    insert into public.properties (id, title, name, type, address, company_id)
    values ('${PROPERTY}', 'P1 Property', 'P1 Property', 'residential', 'Muscat', '${COMPANY}');

    insert into public.property_owners
      (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('${PROPERTY}', '${OWNER}', 100, true, date '2026-01-01', '${COMPANY}');

    -- commission_value = 0 keeps the collection math exact (no management fee).
    insert into public.owner_agreements
      (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 0, date '2026-01-01', '${COMPANY}');

    -- This phase proves the OFFICE_IS_CREDITOR AR path. Replace the initial
    -- default version before the contract freezes its immutable snapshot.
    update public.owner_agreement_versions
       set effective_to = date '2025-12-31', superseded_at = now()
     where owner_agreement_id = '${AGREEMENT}'::uuid and superseded_at is null;
    insert into public.owner_agreement_versions
      (id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
       commission_type, commission_value, commission_recognition_basis, offset_allowed,
       reserve_amount, effective_from, created_by)
    values
      ('a1000000-0000-4000-8000-000000000082', '${AGREEMENT}', '${COMPANY}', 2,
       'OWNER_AGENCY', 'OFFICE_IS_CREDITOR', 'RATE', 0, 'ON_COLLECTION', false, 0,
       date '2026-01-01', '${MAKER}');
    update public.owner_agreements
       set current_version_id = 'a1000000-0000-4000-8000-000000000082'::uuid
     where id = '${AGREEMENT}'::uuid;

    insert into public.units (id, property_id, name, unit_number, company_id)
    values ('${UNIT}', '${PROPERTY}', 'P1 Unit', 'P1-1', '${COMPANY}');

    insert into public.people (id, full_name, type, company_id)
    values ('${TENANT}', 'P1 Tenant', 'tenant', '${COMPANY}');

    insert into public.contracts
      (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
    values (
      '${CONTRACT}', '${PROPERTY}', '${UNIT}', '${TENANT}', '${AGREEMENT}',
      date '2026-01-01', date '2026-12-31', ${RENT}, 'active', '${COMPANY}'
    );
  `);

  await assumeIdentity(db, MAKER, COMPANY);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('PHASE 1 — OMR 3dp precision and live-path canonical convergence', () => {
  it('generates an invoice with 3-decimal tax and posts it to the canonical ledger', async () => {
    const gen = await db.query<{ count: string }>(
      'select public.generate_invoices_from_active_contracts()::text as count',
    );
    expect(Number(gen.rows[0].count)).toBe(1);

    const { rows } = await db.query<{ id: string; amount: string; tax_amount: string }>(
      `select id, amount::text, tax_amount::text from public.invoices
        where contract_id::text = $1 and deleted_at is null`,
      [CONTRACT],
    );
    expect(rows.length).toBe(1);
    invoiceId = rows[0].id;
    expect(Number(rows[0].amount)).toBe(RENT);
    expect(Number(rows[0].tax_amount)).toBe(TAX);

    // The invoice journal must live in the canonical ledger (journal_batches).
    const { rows: batches } = await db.query<{ source_type: string; source_id: string }>(
      `select source_type, source_id from public.journal_batches
        where company_id = $1 and source_id::text = $2 and status = 'POSTED'`,
      [COMPANY, invoiceId],
    );
    expect(batches.length).toBeGreaterThanOrEqual(1);

    // AR subledger reconciles to the 1201 control account.
    expect(await glBalance('1201')).toBe(TOTAL);
    expect(await invoiceOutstanding(invoiceId)).toBe(TOTAL);
  });

  it('preserves an exact 3-decimal partial payment in the canonical ledger', async () => {
    const tiny = 0.125;
    await rpc('record_invoice_payment_atomic', {
      invoice_id: invoiceId,
      amount: tiny,
      method: 'bank_transfer',
      date: '2026-08-13',
      reference: 'P1-3DP-0125',
      request_id: 'phase1-3dp-payment-1',
    });

    // paid_amount updated to exactly 0.125 (no silent 2dp truncation).
    const { rows } = await db.query<{ paid_amount: string }>(
      `select paid_amount::text from public.invoices where id::text = $1`,
      [invoiceId],
    );
    expect(Number(rows[0].paid_amount)).toBe(tiny);

    // The bank-transfer collection lands in Bank exactly (no fee in this fixture).
    expect(await glBalance('1120')).toBe(tiny);

    // The collection created a canonical receipt batch in journal_batches.
    const { rows: batches } = await db.query<{ count: number }>(
      `select count(*)::int as count from public.journal_batches
        where company_id = $1 and source_type = 'receipt' and status = 'POSTED'`,
      [COMPANY],
    );
    expect(batches[0].count).toBeGreaterThanOrEqual(1);

    // The receipt collection batch is balanced (debits = credits).
    const { rows: bal } = await db.query<{ diff: string }>(
      `select (sum(l.debit) - sum(l.credit))::text as diff
         from public.journal_lines l
         join public.journal_batches b on b.id = l.batch_id
        where b.company_id = $1 and b.source_type = 'receipt' and b.status = 'POSTED'`,
      [COMPANY],
    );
    expect(Number(bal[0].diff)).toBe(0);
  });

  it('rejects a cross-company collection attempt (company isolation)', async () => {
    await assumeIdentity(db, OTHER, OTHER_COMPANY);
    await expect(
      db.query(`select public.record_invoice_payment_atomic('{"invoice_id":"${invoiceId}","amount":10,"request_id":"x-iso"}'::jsonb)`),
    ).rejects.toThrow();
    await assumeIdentity(db, MAKER, COMPANY);
  });

  it('keeps the invoice journal batch balanced (debits = credits)', async () => {
    const { rows } = await db.query<{ diff: string }>(
      `select (sum(l.debit) - sum(l.credit))::text as diff
         from public.journal_lines l
         join public.journal_batches b on b.id = l.batch_id
        where b.company_id = $1 and b.source_id::text = $2`,
      [COMPANY, invoiceId],
    );
    expect(Number(rows[0].diff)).toBe(0);
  });
});
