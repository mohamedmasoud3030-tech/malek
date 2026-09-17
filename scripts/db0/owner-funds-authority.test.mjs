/**
 * Owner funds held — evidence authority, verified against real PostgreSQL.
 *
 * The owner financial-position report used to publish
 * `owner_funds.held = coalesce(sum(<owner_funds_events>), 0)`. On a register
 * with no rows that expression returns a confident `0`, and the report rendered
 * a definite balance for an owner whose held funds were simply unknown.
 *
 * Migration `20260917000002_owner_funds_held_authority.sql` gates the figure on
 * evidence. These tests prove the gate on a real database, exercising the whole
 * authorization path the production RPC requires — an active company member
 * with an active membership row — so the contract is asserted where it is
 * actually enforced, not through a stub.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDatabase, listMigrations, replay } from './lib/replay.mjs';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = '99999999-9999-4999-8999-999999999999';

let sharedDatabase;
async function database() {
  if (!sharedDatabase) {
    sharedDatabase = (async () => {
      const db = await createDatabase();
      await replay(db, { files: await listMigrations(), stopOnError: true });

      await db.query(`insert into public.companies (id, name, slug) values ($1, 'Test Co', 'test-co')`, [COMPANY_ID]);
      await db.query(`insert into auth.users (id, email) values ($1, 'qa@example.test')`, [USER_ID]);
      await db.query(
        `insert into public.users (id, email, name, role, status, is_active)
         values ($1, 'qa@example.test', 'QA User', 'MANAGER', 'ACTIVE', true)`,
        [USER_ID],
      );
      await db.query(
        `insert into public.company_members (company_id, user_id, role, is_active)
         values ($1, $2, 'MANAGER', true)`,
        [COMPANY_ID, USER_ID],
      );
      await db.query(
        `insert into public.owners (id, company_id, full_name, name)
         values ($1, $2, 'Owner One', 'Owner One')`,
        [OWNER_ID, COMPANY_ID],
      );

      // The RPC authorizes through auth.uid() + company membership, so the
      // session has to look like a real signed-in manager.
      await db.query(`select set_config('request.jwt.claims', $1, false)`, [
        JSON.stringify({ sub: USER_ID, role: 'authenticated', app_metadata: { company_id: COMPANY_ID } }),
      ]);
      const { rows } = await db.query(`select public.is_app_user() as ok`);
      assert.equal(rows[0].ok, true, 'the fixture must be an authorized app user, or these tests prove nothing');
      return db;
    })();
  }
  return sharedDatabase;
}

function ownerFunds(position) {
  return position?.owner_funds;
}

async function position(db) {
  const { rows } = await db.query(
    `select public.rpt_owner_financial_position($1::uuid, '2026-01-01'::date, '2026-12-31'::date) as pos`,
    [OWNER_ID],
  );
  return rows[0].pos;
}

test('an empty register is reported as a missing-evidence gap, never as a zero balance', async () => {
  const db = await database();
  const funds = ownerFunds(await position(db));

  assert.equal(funds.held, null, 'an unproven balance must not be published as a number');
  assert.equal(funds.held_evidence_missing_count, 1, 'the gap must be flagged');
  assert.equal(funds.held_proven_total, 0, 'the (empty) proven total is still reported');
}, { timeout: 180_000 });

test('a held balance backed by register events is published exactly', async () => {
  const db = await database();
  await db.query(
    `insert into public.owner_funds_events
       (company_id, owner_id, source_type, source_id, event_id, amount_delta, effective_date)
     values ($1, $2, 'OWNER_COLLECTION', '11111111-1111-4111-8111-000000000001', 'E1', 1928.250, '2026-03-01')`,
    [COMPANY_ID, OWNER_ID],
  );

  const funds = ownerFunds(await position(db));
  assert.equal(funds.held, 1928.25, 'a proven balance is a real figure, not a suppressed one');
  assert.equal(funds.held_proven_total, 1928.25);
  assert.equal(funds.held_evidence_missing_count, 0);
  assert.equal(funds.events.length, 1, 'the evidence stays visible alongside the derived figure');
}, { timeout: 180_000 });

test('the published contract is exactly what the app parser requires', async () => {
  const db = await database();
  const funds = ownerFunds(await position(db));

  // `parseOwnerFunds()` in owner-financial-authority-service.ts rejects a
  // response whose fields disagree, so the shape itself is part of the fix.
  for (const field of ['held', 'held_proven_total', 'held_evidence_missing_count']) {
    assert.ok(field in funds, `owner_funds must expose ${field}`);
  }
  assert.ok([0, 1].includes(funds.held_evidence_missing_count), 'the gap flag is a boolean-like 0/1');
  assert.equal(
    funds.held === null,
    funds.held_evidence_missing_count === 1,
    'held is null exactly when evidence is missing',
  );
  assert.equal(
    funds.held === null ? 0 : funds.held_proven_total,
    funds.held ?? 0,
    'the published balance must equal the proven total whenever it is published at all',
  );
}, { timeout: 180_000 });
