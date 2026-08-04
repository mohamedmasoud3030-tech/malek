/**
 * PR-C — commissions direct-write hardening regression suite.
 *
 * Runs on a clean PGlite replay of the full migration chain and proves:
 * - direct authenticated INSERT/UPDATE/DELETE is closed;
 * - create/update/cancel run only through trusted, company-scoped RPCs;
 * - create is server-stamped pending and cannot accept ownership/payment fields;
 * - paid/cancelled states cannot be edited through the operational RPC;
 * - cross-company identifiers do not become a write path;
 * - request idempotency is stable and payload-sensitive.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from './replay-bootstrap';

const COMPANY_1 = 'c1000000-0000-4000-8000-000000000011';
const COMPANY_2 = 'c2000000-0000-4000-8000-000000000022';
const ADMIN_1 = 'a1000000-0000-4000-8000-000000000011';
const ADMIN_2 = 'a2000000-0000-4000-8000-000000000022';
const OTHER_COMMISSION = 'commission-company-2';

let db: PGlite;

async function rpc(name: string, payload: Record<string, unknown>) {
  const { rows } = await db.query<{ out: any }>(
    `select public.${name}($1::jsonb) as out`,
    [JSON.stringify(payload)],
  );
  return rows[0]?.out;
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase();
  expect(replay.failed, JSON.stringify(replay.failed).slice(0, 1000)).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY_1}', 'شركة عمولات 1', 'commission-company-1'),
      ('${COMPANY_2}', 'شركة عمولات 2', 'commission-company-2');

    insert into auth.users (id, email) values
      ('${ADMIN_1}', 'commission-admin-1@test.invalid'),
      ('${ADMIN_2}', 'commission-admin-2@test.invalid');

    insert into public.users (id, email, name, role, status, is_active) values
      ('${ADMIN_1}', 'commission-admin-1@test.invalid', 'مدير 1', 'ADMIN', 'ACTIVE', true),
      ('${ADMIN_2}', 'commission-admin-2@test.invalid', 'مدير 2', 'ADMIN', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY_1}', '${ADMIN_1}', 'ADMIN'),
      ('${COMPANY_2}', '${ADMIN_2}', 'ADMIN');

    insert into public.commissions (
      id, staff_name, type, status, amount, company_id, created_at, updated_at
    ) values (
      '${OTHER_COMMISSION}', 'وسيط الشركة الثانية', 'contract', 'pending', 40,
      '${COMPANY_2}', now(), now()
    );
  `);
}, 300_000);

afterAll(async () => {
  await db.close();
});

describe('PR-C commission write hardening', () => {
  it('creates pending commission server-side and is idempotent for the same request', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const payload = {
      request_id: 'commission-create-1',
      staff_name: ' وسيط أول ',
      type: 'contract',
      source_id: 'contract-1',
      deal_value: 1000,
      percentage: 2.5,
      amount: null,
      status: 'paid',
      company_id: COMPANY_2,
      paid_at: 1,
      expense_id: '00000000-0000-4000-8000-000000000001',
    };

    const first = await rpc('create_commission_atomic', payload);
    const second = await rpc('create_commission_atomic', payload);

    expect(first.success).toBe(true);
    expect(first.status).toBe('pending');
    expect(Number(first.commission.amount)).toBe(25);
    expect(first.commission.company_id).toBe(COMPANY_1);
    expect(first.commission.paid_at).toBeNull();
    expect(first.commission.expense_id).toBeNull();
    expect(second.commission_id).toBe(first.commission_id);
    expect(second.idempotent).toBe(true);
  });

  it('rejects reuse of an idempotency key with a different payload', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    await rpc('create_commission_atomic', {
      request_id: 'commission-create-conflict',
      staff_name: 'وسيط',
      type: 'contract',
      amount: 10,
    });

    await expect(
      rpc('create_commission_atomic', {
        request_id: 'commission-create-conflict',
        staff_name: 'وسيط',
        type: 'contract',
        amount: 11,
      }),
    ).rejects.toThrow('IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST');
  });

  it('updates operational fields and pending/approved status through the RPC', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const created = await rpc('create_commission_atomic', {
      request_id: 'commission-update-create',
      staff_name: 'وسيط تعديل',
      type: 'lead',
      amount: 30,
    });

    const updated = await rpc('update_commission_atomic', {
      request_id: 'commission-update-1',
      commission_id: created.commission_id,
      staff_name: 'وسيط معدل',
      type: 'lead',
      requested_status: 'approved',
      source_id: 'lead-1',
      amount: 35,
    });

    expect(updated.commission.staff_name).toBe('وسيط معدل');
    expect(updated.commission.status).toBe('approved');
    expect(Number(updated.commission.amount)).toBe(35);
  });

  it('cancels unpaid commission, stays idempotent, and blocks later edits', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    const created = await rpc('create_commission_atomic', {
      request_id: 'commission-cancel-create',
      staff_name: 'وسيط إلغاء',
      type: 'owner',
      amount: 20,
    });

    const cancelled = await rpc('cancel_commission_atomic', {
      request_id: 'commission-cancel-1',
      commission_id: created.commission_id,
    });
    const repeated = await rpc('cancel_commission_atomic', {
      request_id: 'commission-cancel-2',
      commission_id: created.commission_id,
    });

    expect(cancelled.status).toBe('cancelled');
    expect(repeated.already_cancelled).toBe(true);

    await expect(
      rpc('update_commission_atomic', {
        request_id: 'commission-cancel-edit',
        commission_id: created.commission_id,
        staff_name: 'لن يتغير',
        type: 'owner',
        requested_status: 'pending',
        amount: 20,
      }),
    ).rejects.toThrow('COMMISSION_CANCELLED_IMMUTABLE');
  });

  it('blocks cross-company update and cancel without changing the other company row', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);

    await expect(
      rpc('update_commission_atomic', {
        request_id: 'commission-cross-update',
        commission_id: OTHER_COMMISSION,
        staff_name: 'اختراق',
        type: 'contract',
        requested_status: 'approved',
        amount: 99,
      }),
    ).rejects.toThrow('COMMISSION_NOT_FOUND_OR_FORBIDDEN');

    await expect(
      rpc('cancel_commission_atomic', {
        request_id: 'commission-cross-cancel',
        commission_id: OTHER_COMMISSION,
      }),
    ).rejects.toThrow('COMMISSION_NOT_FOUND_OR_FORBIDDEN');

    const { rows } = await db.query<{ staff_name: string; status: string }>(
      `select staff_name, status from public.commissions where id=$1`,
      [OTHER_COMMISSION],
    );
    expect(rows[0]).toEqual({ staff_name: 'وسيط الشركة الثانية', status: 'pending' });
  });

  it('authenticated can read its company but cannot INSERT, UPDATE, or DELETE directly', async () => {
    await assumeIdentity(db, ADMIN_1, COMPANY_1);
    await db.exec('begin;');
    try {
      await db.exec('set local role authenticated;');

      const mine = await db.query<{ n: number }>(
        `select count(*)::int as n from public.commissions where company_id=$1`,
        [COMPANY_1],
      );
      const other = await db.query<{ n: number }>(
        `select count(*)::int as n from public.commissions where company_id=$1`,
        [COMPANY_2],
      );
      expect(Number(mine.rows[0]?.n)).toBeGreaterThan(0);
      expect(Number(other.rows[0]?.n)).toBe(0);

      await db.exec('savepoint direct_insert;');
      await expect(
        db.query(
          `insert into public.commissions (id, staff_name, type, status, amount, company_id)
           values ('direct-write', 'مباشر', 'contract', 'pending', 1, $1)`,
          [COMPANY_1],
        ),
      ).rejects.toThrow();
      await db.exec('rollback to savepoint direct_insert;');

      await db.exec('savepoint direct_update;');
      await expect(
        db.query(`update public.commissions set amount=999 where company_id=$1`, [COMPANY_1]),
      ).rejects.toThrow();
      await db.exec('rollback to savepoint direct_update;');

      await db.exec('savepoint direct_delete;');
      await expect(
        db.query(`delete from public.commissions where company_id=$1`, [COMPANY_1]),
      ).rejects.toThrow();
      await db.exec('rollback to savepoint direct_delete;');
    } finally {
      await db.exec('rollback;');
    }
  }, 60_000);
});
