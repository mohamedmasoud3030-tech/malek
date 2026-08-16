/**
 * R13 — Maintenance creation: race-safe idempotency proof.
 *
 * The pre-R13 create_maintenance_atomic implemented idempotency as
 * SELECT-then-INSERT. Under concurrent identical requests both callers could
 * SELECT "none", then one INSERT succeeded and the other raised a unique
 * violation instead of returning the canonical cached row — breaking the
 * advertised idempotency contract.
 *
 * The fix replaces the check-then-act with INSERT ... ON CONFLICT
 * (company_id, request_id) [partial unique index] DO NOTHING + reload of the
 * canonical row. This is atomic in PostgreSQL: under concurrency exactly one
 * writer inserts and the "loser" detects the conflict and returns the same
 * semantic result.
 *
 * PGlite is a single-connection engine, so a literal two-session interleaving
 * cannot be spawned here (the repo's own settlement-concurrency proof uses the
 * same standard: prove the unique index is the atomic gate even when the
 * pre-check is bypassed). This suite therefore proves, executably:
 *   1. the unique index is the atomic gate (a raw duplicate insert is rejected
 *      with a unique violation — no duplicate row is possible under any
 *      interleaving),
 *   2. the RPC's ON CONFLICT path returns the canonical row (idempotent=true)
 *      when the row already exists — the deterministic "loser" outcome — with
 *      no duplicate audit side effect,
 *   3. sequential idempotent replay returns the same record,
 *   4. different companies + same request_id are independent,
 *   5. cross-company references still fail closed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'c9000000-0000-4000-8000-000000000001';
const OTHER_COMPANY = 'c9000000-0000-4000-8000-000000000002';
const ADMIN = 'c9000000-0000-4000-8000-000000000011';
const OTHER_ADMIN = 'c9000000-0000-4000-8000-000000000012';
const PROPERTY = 'c9000000-0000-4000-8000-000000000031';
const UNIT = 'c9000000-0000-4000-8000-000000000041';
const OTHER_PROPERTY = 'c9000000-0000-4000-8000-000000000032';

let db: PGlite;

type CreateOut = { idempotent: boolean; maintenance: Record<string, any> };

async function create(requestId: string, property = PROPERTY, unit: string | null = UNIT): Promise<CreateOut> {
  const { rows } = await db.query<{ out: CreateOut }>(
    `select public.create_maintenance_atomic(
       p_property_id := $1::text,
       p_unit_id := $2::text,
       p_title := 'طلب صيانة متزامن',
       p_priority := 'high',
       p_request_id := $3::text
     ) as out`,
    [property, unit, requestId],
  );
  return rows[0]?.out;
}

async function auditCount(action: string, entityId: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `select count(*)::text as n from public.audit_log
      where entity = 'maintenance_record' and entity_id = $1 and action = $2`,
    [entityId, action],
  );
  return Number(rows[0].n);
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY}', 'R13 Maint Co', 'r13-maint-co'),
      ('${OTHER_COMPANY}', 'R13 Maint Other', 'r13-maint-other');

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${ADMIN}', 'admin@r13m.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${OTHER_ADMIN}', 'other@r13m.test', '{"company_id":"${OTHER_COMPANY}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${ADMIN}', 'admin@r13m.test', 'Admin', 'ADMIN', 'ACTIVE', true),
      ('${OTHER_ADMIN}', 'other@r13m.test', 'Other', 'ADMIN', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${ADMIN}', 'ADMIN'),
      ('${OTHER_COMPANY}', '${OTHER_ADMIN}', 'ADMIN');

    insert into public.properties (id, title, name, type, address, status, company_id) values
      ('${PROPERTY}', 'R13 Maint Property', 'R13 Maint Property', 'residential', 'Muscat', 'active', '${COMPANY}'),
      ('${OTHER_PROPERTY}', 'Other Property', 'Other Property', 'residential', 'Muscat', 'active', '${OTHER_COMPANY}');
    insert into public.units (id, property_id, unit_number, company_id)
    values ('${UNIT}', '${PROPERTY}', 'R13-1', '${COMPANY}');
  `);

  await assumeIdentity(db, ADMIN, COMPANY);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('R13 — create_maintenance_atomic race-safe idempotency', () => {
  it('sequential replay returns the same record with a single audit row', async () => {
    const first = await create('r13-maint-seq-1');
    expect(first.idempotent).toBe(false);
    const id = String(first.maintenance.id);

    const again = await create('r13-maint-seq-1');
    expect(again.idempotent).toBe(true);
    expect(String(again.maintenance.id)).toBe(id);

    expect(await auditCount('create', id)).toBe(1);
  });

  it('the unique index is the atomic gate: a raw duplicate insert is rejected', async () => {
    const first = await create('r13-maint-gate-1');
    const id = String(first.maintenance.id);

    // Bypass the RPC's own logic (as a truly-concurrent second writer would
    // appear to) — the partial unique index must stop a duplicate row.
    await expect(
      db.query(
        `insert into public.maintenance_records (company_id, property_id, unit_id, title, priority, status, request_id, request_date)
         values ($1, $2, $3, 'مكرر', 'high', 'open', 'r13-maint-gate-1', current_date)`,
        [COMPANY, PROPERTY, UNIT],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);

    const { rows } = await db.query<{ n: string }>(
      `select count(*)::text as n from public.maintenance_records where request_id = 'r13-maint-gate-1' and company_id = $1 and deleted_at is null`,
      [COMPANY],
    );
    expect(Number(rows[0].n)).toBe(1);
    expect(await auditCount('create', id)).toBe(1);
  });

  it('the ON CONFLICT path returns the canonical row (deterministic "loser" outcome) without a duplicate audit', async () => {
    // Simulate a committed concurrent winner: the row already exists.
    const first = await create('r13-maint-conflict-1');
    const id = String(first.maintenance.id);

    // A second identical request must NOT raise a unique violation; it returns
    // the canonical row idempotently (this is exactly the loser's path).
    const second = await create('r13-maint-conflict-1');
    expect(second.idempotent).toBe(true);
    expect(String(second.maintenance.id)).toBe(id);

    // No duplicate audit side effect.
    expect(await auditCount('create', id)).toBe(1);
  });

  it('different companies + same request_id are independent records', async () => {
    const first = await create('r13-maint-cross-1');
    expect(first.idempotent).toBe(false);

    await assumeIdentity(db, OTHER_ADMIN, OTHER_COMPANY);
    const second = await create('r13-maint-cross-1', OTHER_PROPERTY, null);
    expect(second.idempotent).toBe(false); // NOT a replay — a fresh record.
    expect(String(second.maintenance.id)).not.toBe(String(first.maintenance.id));

    await assumeIdentity(db, ADMIN, COMPANY);
  });

  it('cross-company references still fail closed (property of another company)', async () => {
    // A caller in COMPANY referencing OTHER_COMPANY's property must be refused.
    await expect(create('r13-maint-xc-1', OTHER_PROPERTY, UNIT)).rejects.toThrow(
      /العقار غير موجود|تابع لشركة أخرى|not found/i,
    );
  });

  it('preserves the security-definer + company-context contract', async () => {
    // Anonymous callers are rejected.
    await assumeIdentity(db, null, null);
    await expect(create('r13-maint-anon-1')).rejects.toThrow(/42501|تسجيل الدخول|required/i);
    await assumeIdentity(db, ADMIN, COMPANY);
  });
});
