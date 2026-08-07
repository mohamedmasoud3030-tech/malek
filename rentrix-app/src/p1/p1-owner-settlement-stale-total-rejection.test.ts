/**
 * S02-T05 / D-002 — owner settlement stale-total rejection.
 *
 * Replays the full migration chain and proves that changing a reserved payment
 * after draft creation cannot be approved or paid with the old stored tuple.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase, assumeIdentity } from './replay-bootstrap';

const COMPANY = 'c3100000-0000-4000-8000-000000000001';
const ADMIN = 'a3100000-0000-4000-8000-000000000001';
const OWNER = 'b3100000-0000-4000-8000-000000000001';
const PROPERTY = 'd3100000-0000-4000-8000-000000000001';
const UNIT = 'e3100000-0000-4000-8000-000000000001';
const TENANT = 'f3100000-0000-4000-8000-000000000001';
const AGREEMENT = 'aa310000-0000-4000-8000-000000000001';
const CONTRACT = 'cc310000-0000-4000-8000-000000000001';
const INVOICE = 'dd310000-0000-4000-8000-000000000001';
const PAYMENT = 'ab310000-0000-4000-8000-000000000001';
const REQ_CREATE = '41000000-0000-4000-8000-000000000001';
const REQ_APPROVE = '41000000-0000-4000-8000-000000000002';
const REQ_PAY = '41000000-0000-4000-8000-000000000003';

let db: PGlite;
let settlementId = '';

beforeAll(async () => {
  const replay = await createFullReplayedDatabase();
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug)
    values ('${COMPANY}', 'S02 stale total company', 's02-stale-total');

    insert into auth.users (id, email)
    values ('${ADMIN}', 's02-stale-total@example.test');

    insert into public.users (id, email, name, role, status)
    values ('${ADMIN}', 's02-stale-total@example.test', 'S02 Admin', 'ADMIN', 'ACTIVE');

    insert into public.company_members (company_id, user_id, role)
    values ('${COMPANY}', '${ADMIN}', 'ADMIN');

    insert into public.owners (id, full_name, name, company_id)
    values ('${OWNER}', 'مالك اختبار D-002', 'مالك اختبار D-002', '${COMPANY}');

    insert into public.properties (id, title, name, type, address, company_id)
    values ('${PROPERTY}', 'عقار D-002', 'عقار D-002', 'سكني', 'مسقط', '${COMPANY}');

    insert into public.property_owners (
      property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id
    ) values (
      '${PROPERTY}', '${OWNER}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY}'
    );

    insert into public.owner_agreements (
      id, owner_id, property_id, agreement_type, commission_type,
      commission_value, starts_on, ends_on, company_id
    ) values (
      '${AGREEMENT}', '${OWNER}', '${PROPERTY}', 'property_management', 'RATE',
      10, date '2026-01-01', date '2027-12-31', '${COMPANY}'
    );

    insert into public.units (id, property_id, unit_number, company_id)
    values ('${UNIT}', '${PROPERTY}', 'U-D002', '${COMPANY}');

    insert into public.people (id, full_name, type, company_id)
    values ('${TENANT}', 'مستأجر D-002', 'tenant', '${COMPANY}');

    insert into public.contracts (
      id, property_id, unit_id, tenant_id, start_date, end_date,
      rent_amount, status, agreement_id, company_id
    ) values (
      '${CONTRACT}', '${PROPERTY}', '${UNIT}', '${TENANT}', '2026-01-01', '2026-12-31',
      12000, 'active', '${AGREEMENT}', '${COMPANY}'
    );

    insert into public.invoices (
      id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, status, company_id
    ) values (
      '${INVOICE}', '${CONTRACT}', '2026-07-01', '2026-07-05', 1000, 1000, 0, 'PAID', '${COMPANY}'
    );

    insert into public.receipts (id, amount, status, company_id)
    values ('${PAYMENT}', 1000, 'POSTED', '${COMPANY}');

    insert into public.payments (
      id, invoice_id, contract_id, amount, payment_method, payment_date,
      status, receipt_id, company_id
    ) values (
      '${PAYMENT}', '${INVOICE}', '${CONTRACT}', 1000, 'cash', date '2026-07-05',
      'POSTED', '${PAYMENT}', '${COMPANY}'
    );

    update public.receipts set payment_id = id where id = '${PAYMENT}';
  `);

  await assumeIdentity(db, ADMIN, COMPANY);

  const created = await db.query<{ out: any }>(
    `select public.create_owner_settlement_draft_atomic($1::jsonb) as out`,
    [JSON.stringify({
      request_id: REQ_CREATE,
      owner_id: OWNER,
      property_id: PROPERTY,
      period_start: '2026-07-01',
      period_end: '2026-07-31',
    })],
  );

  settlementId = String(created.rows[0]?.out?.settlement_id ?? '');
  expect(settlementId).toBeTruthy();
  expect(Number(created.rows[0]?.out?.net_payable)).toBe(900);
}, 300000);

afterAll(async () => {
  await db?.close();
});

describe('S02-T05 — stale owner-settlement totals fail closed', () => {
  it('rejects approval after the smallest currently representable payment tamper and leaves the settlement DRAFT', async () => {
    await db.exec('begin;');
    try {
      // payments.amount is currently numeric(14,2), so 0.010 is the smallest
      // positive persisted delta. The guard itself remains 0.001-sensitive so
      // it is already compatible with a future 3dp monetary-column migration.
      await db.exec(`update public.payments set amount = 1000.01 where id = '${PAYMENT}';`);

      const persisted = await db.query<{ amount: string }>(
        `select amount::text as amount from public.payments where id = $1`,
        [PAYMENT],
      );
      expect(Number(persisted.rows[0]?.amount)).toBe(1000.01);

      await db.exec('savepoint stale_approve;');
      await expect(
        db.query(`select public.approve_owner_settlement_atomic($1::jsonb)`, [
          JSON.stringify({ settlement_id: settlementId, request_id: REQ_APPROVE }),
        ]),
      ).rejects.toThrow(/OWNER_SETTLEMENT_STALE_TOTALS/);
      await db.exec('rollback to savepoint stale_approve;');

      const state = await db.query<{ status: string; approved_at: string | null }>(
        `select status, approved_at from public.owner_settlements where id = $1`,
        [settlementId],
      );
      expect(state.rows[0]?.status).toBe('DRAFT');
      expect(state.rows[0]?.approved_at).toBeNull();
    } finally {
      await db.exec('rollback;');
    }
  }, 60000);

  it('approves when sources still match, then rejects stale payment before any PAY journal/status effect', async () => {
    await db.exec('begin;');
    try {
      await db.exec(`update public.payments set amount = 1000 where id = '${PAYMENT}';`);

      const approved = await db.query<{ out: any }>(
        `select public.approve_owner_settlement_atomic($1::jsonb) as out`,
        [JSON.stringify({ settlement_id: settlementId, request_id: REQ_APPROVE })],
      );
      expect(approved.rows[0]?.out?.status).toBe('APPROVED');

      // Tamper after approval. The pay wrapper must detect this before the
      // preserved FA-003 implementation can leave a journal or PAID status.
      await db.exec(`update public.payments set amount = 1100 where id = '${PAYMENT}';`);

      await db.exec('savepoint stale_pay;');
      await expect(
        db.query(`select public.pay_owner_settlement_atomic($1::jsonb)`, [
          JSON.stringify({
            settlement_id: settlementId,
            request_id: REQ_PAY,
            method: 'bank_transfer',
            payment_reference: 'D002-TAMPER',
          }),
        ]),
      ).rejects.toThrow(/OWNER_SETTLEMENT_STALE_TOTALS/);
      await db.exec('rollback to savepoint stale_pay;');

      const state = await db.query<{ status: string; paid_at: string | null }>(
        `select status, paid_at from public.owner_settlements where id = $1`,
        [settlementId],
      );
      expect(state.rows[0]?.status).toBe('APPROVED');
      expect(state.rows[0]?.paid_at).toBeNull();

      const journals = await db.query<{ n: number }>(
        `select count(*)::int as n
           from public.journal_entries
          where entity_type = 'owner_settlement_payment'
            and entity_id = $1`,
        [settlementId],
      );
      expect(Number(journals.rows[0]?.n ?? -1)).toBe(0);
    } finally {
      await db.exec('rollback;');
    }
  }, 60000);
});