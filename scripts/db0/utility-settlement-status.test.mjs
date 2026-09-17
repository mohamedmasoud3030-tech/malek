/**
 * Utility-bill settlement invariant — real PostgreSQL regression test.
 *
 * Applies the full canonical migration chain to a clean PGlite database, then
 * exercises the trigger added by
 * `20260917000003_utility_bill_settlement_status_authority.sql` against real
 * rows. This is the database half of the owner-report contradiction fix: the
 * report renders the status and the remaining balance side by side, and those
 * two must never disagree.
 *
 * The invariant asserted throughout is:
 *
 *     status = 'PAID'  ⟺  paid_amount >= amount
 *
 * with `OVERDUE` preserved as a distinct unsettled state that the amounts
 * cannot reconstruct.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDatabase, listMigrations, replay } from './lib/replay.mjs';

let sharedDatabase;
async function database() {
  if (!sharedDatabase) {
    sharedDatabase = (async () => {
      const db = await createDatabase();
      const result = await replay(db, { files: await listMigrations(), stopOnError: true });
      assert.equal(result.failures?.length ?? 0, 0, 'the canonical migration chain must apply cleanly');
      await db.query(`insert into public.companies (id, name, slug) values ($1, 'Test Co', 'test-co')`, [
        '11111111-1111-4111-8111-111111111111',
      ]);
      await db.query(
        `insert into public.properties (id, company_id, title, type, address, name)
         values ($1, $2, 'A-201', 'residential', 'Muscat', 'A-201')`,
        ['22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'],
      );
      return db;
    })();
  }
  return sharedDatabase;
}

let sequence = 0;
/** Inserts one bill and returns the status the database actually stored. */
async function insertBill(db, { amount, paidAmount, status }) {
  sequence += 1;
  const { rows } = await db.query(
    `insert into public.utility_bills
       (id, company_id, property_id, type, amount, due_date, status, paid_amount, reference_no)
     values ($1, $2, $3, 'meter_bill', $4, '2026-01-01', $5, $6, $7)
     returning status`,
    [
      `33333333-3333-4333-8333-${String(sequence).padStart(12, '0')}`,
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      amount,
      status,
      paidAmount,
      `UTL-${sequence}`,
    ],
  );
  return rows[0].status;
}

test('a paid flag the amounts do not support is refused and stored as UNPAID', async () => {
  const db = await database();
  // The exact reported contradiction: the register claims settlement while the
  // balance still shows the full amount outstanding.
  const stored = await insertBill(db, { amount: 360, paidAmount: 0, status: 'PAID' });
  assert.equal(stored, 'UNPAID');
}, { timeout: 180_000 });

test('a fully paid bill is stored as PAID', async () => {
  const db = await database();
  assert.equal(await insertBill(db, { amount: 360, paidAmount: 360, status: 'UNPAID' }), 'PAID');
  assert.equal(await insertBill(db, { amount: 360, paidAmount: 360, status: 'OVERDUE' }), 'PAID');
  assert.equal(await insertBill(db, { amount: 360, paidAmount: 400, status: 'UNPAID' }), 'PAID');
}, { timeout: 180_000 });

test('an unsettled overdue bill keeps its overdue state', async () => {
  const db = await database();
  // OVERDUE is real business state the amounts cannot rebuild; only the
  // settled/unsettled contradiction is repaired.
  assert.equal(await insertBill(db, { amount: 360, paidAmount: 0, status: 'OVERDUE' }), 'OVERDUE');
  assert.equal(await insertBill(db, { amount: 360, paidAmount: 100, status: 'OVERDUE' }), 'OVERDUE');
}, { timeout: 180_000 });

test('editing paid_amount alone leaves the stored status agreeing with the balance', async () => {
  const db = await database();
  const id = '44444444-4444-4444-8444-444444444444';
  await db.query(
    `insert into public.utility_bills (id, company_id, property_id, type, amount, due_date, status, paid_amount, reference_no)
     values ($1, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
             'meter_bill', 360, '2026-01-01', 'UNPAID', 0, 'UTL-EDIT')`,
    [id],
  );

  // Settle it by editing only the recorded payment — the path that used to
  // leave the flag behind.
  const settled = await db.query(`update public.utility_bills set paid_amount = 360 where id = $1 returning status`, [id]);
  assert.equal(settled.rows[0].status, 'PAID');

  // Un-settle it again.
  const reopened = await db.query(`update public.utility_bills set paid_amount = 100 where id = $1 returning status`, [id]);
  assert.equal(reopened.rows[0].status, 'UNPAID');
}, { timeout: 180_000 });

test('every stored row satisfies status = PAID ⟺ paid_amount >= amount', async () => {
  const db = await database();
  const { rows } = await db.query(`
    select id::text as id, status::text as status, amount, paid_amount
    from public.utility_bills
    where coalesce(amount, 0) > 0
      and (status = 'PAID') <> (coalesce(paid_amount, 0) >= coalesce(amount, 0))
  `);
  assert.deepEqual(rows, [], `rows whose flag contradicts their balance: ${JSON.stringify(rows)}`);
}, { timeout: 180_000 });
