import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../p1/replay-bootstrap';

const COMPANY = 'c4020000-0000-4000-8000-000000000001';
const MAKER = 'a4020000-0000-4000-8000-000000000001';
const CHECKER = 'a4020000-0000-4000-8000-000000000002';
const OWNER = '04020000-0000-4000-8000-000000000001';
const PROPERTY = '04020000-0000-4000-8000-000000000002';
const AGREEMENT = '04020000-0000-4000-8000-000000000003';
const UNIT = '04020000-0000-4000-8000-000000000004';
const TENANT = '04020000-0000-4000-8000-000000000005';
const CONTRACT = '04020000-0000-4000-8000-000000000006';
const INVOICE = '04020000-0000-4000-8000-000000000007';

let db: PGlite;
let receiptId = '';

async function rpc(name: string, payload: Record<string, unknown>) {
  const { rows } = await db.query<{ value: string }>(
    `select public.${name}($1::jsonb)::text as value`,
    [JSON.stringify(payload)],
  );
  return JSON.parse(rows[0]?.value ?? '{}') as Record<string, unknown>;
}

async function balance(accountNo: string) {
  const { rows } = await db.query<{ value: string }>(
    `select coalesce(sum(l.debit - l.credit), 0)::text as value
       from public.journal_lines l
       join public.journal_batches b on b.id = l.batch_id
       join public.accounts a on a.id = l.account_id
      where b.company_id = $1::uuid
        -- Reversed originals remain immutable financial history. Include both
        -- the original REVERSED batch and its POSTED compensating batch when
        -- asserting the net economic balance after governed VOID.
        and b.status in ('POSTED', 'REVERSED')
        and a.no = $2`,
    [COMPANY, accountNo],
  );
  return Number(rows[0]?.value ?? 0);
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug)
    values ('${COMPANY}', 'WP02 Company', 'wp02-company');

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MAKER}', 'maker@wp02.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${CHECKER}', 'checker@wp02.test', '{"company_id":"${COMPANY}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${MAKER}', 'maker@wp02.test', 'Maker', 'ADMIN', 'ACTIVE', true),
      ('${CHECKER}', 'checker@wp02.test', 'Checker', 'ADMIN', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${MAKER}', 'ADMIN'),
      ('${COMPANY}', '${CHECKER}', 'ADMIN');

    insert into public.owners (id, full_name, name, company_id)
    values ('${OWNER}', 'WP02 Owner', 'WP02 Owner', '${COMPANY}');

    insert into public.properties (id, title, name, type, address, company_id)
    values ('${PROPERTY}', 'WP02 Property', 'WP02 Property', 'residential', 'Muscat', '${COMPANY}');

    insert into public.property_owners
      (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
    values ('${PROPERTY}', '${OWNER}', 100, true, date '2026-01-01', '${COMPANY}');

    insert into public.owner_agreements
      (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id)
    values ('${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE', 10, date '2026-01-01', '${COMPANY}');

    insert into public.units (id, property_id, name, unit_number, company_id)
    values ('${UNIT}', '${PROPERTY}', 'WP02 Unit', 'W-1', '${COMPANY}');

    insert into public.people (id, full_name, type, company_id)
    values ('${TENANT}', 'WP02 Tenant', 'tenant', '${COMPANY}');

    insert into public.contracts
      (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id)
    values (
      '${CONTRACT}', '${PROPERTY}', '${UNIT}', '${TENANT}', '${AGREEMENT}',
      date '2026-01-01', date '2026-12-31', 1000, 'active', '${COMPANY}'
    );

    insert into public.invoices
      (id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, tax_rate, status, company_id)
    values (
      '${INVOICE}', '${CONTRACT}', date '2026-08-01', date '2026-08-31',
      1000, 0, 0, 0, 'UNPAID', '${COMPANY}'
    );
  `);

  await assumeIdentity(db, MAKER, COMPANY);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('WP-02 actual collection → RATE fee wiring', () => {
  it('preserves the hardened 42501 contract for unauthenticated payment calls', async () => {
    await assumeIdentity(db, null, null);

    await expect(
      db.query(`select public.record_invoice_payment_atomic('{}'::jsonb)`),
    ).rejects.toMatchObject({ code: '42501' });

    await assumeIdentity(db, MAKER, COMPANY);
  });

  it('derives 10% from the frozen agreement and posts 1000/100/900 in one reversible receipt batch', async () => {
    const result = await rpc('record_invoice_payment_atomic', {
      invoice_id: INVOICE,
      amount: 1000,
      method: 'bank',
      date: '2026-08-13',
      reference: 'WP02-RATE-1000',
      request_id: 'wp02-rate-collection-1',
    });

    receiptId = String(result.receipt_id);
    expect(result.accounting_model).toBe('OWNER_AGENCY');
    expect(result.collection_role).toBe('OWNER_IS_CREDITOR');
    expect(result.management_fee_net).toBe(100);

    expect(await balance('1111')).toBe(1000);
    expect(await balance('1201')).toBe(0);
    expect(await balance('2000')).toBe(-900);
    expect(await balance('4100')).toBe(-100);

    const { rows } = await db.query<{ lines: number }>(
      `select count(*)::int as lines
         from public.journal_lines l
         join public.journal_batches b on b.id = l.batch_id
        where b.company_id = $1::uuid
          and b.source_type = 'receipt'
          and b.source_id = $2`,
      [COMPANY, receiptId],
    );
    expect(rows[0]?.lines).toBe(4);
  });

  it('reverses collection and fee together through governed receipt VOID', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    const request = await rpc('request_receipt_void_atomic', {
      receipt_id: receiptId,
      reason: 'WP02 reversal parity',
      request_id: 'wp02-rate-void-request-1',
    });

    await assumeIdentity(db, CHECKER, COMPANY);
    await rpc('approve_receipt_void_atomic', {
      void_request_id: request.void_request_id,
      request_id: 'wp02-rate-void-approval-1',
    });

    expect(await balance('1111')).toBe(0);
    expect(await balance('2000')).toBe(0);
    expect(await balance('4100')).toBe(0);
  });
});
