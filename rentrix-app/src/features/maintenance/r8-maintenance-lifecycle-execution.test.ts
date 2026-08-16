/**
 * R8 — Maintenance / Services Lifecycle: full journey + Cancelled ≠ Closed.
 *
 * Proves against a FULL migration replay:
 *   1. transition_maintenance_status_atomic enforces the legal matrix
 *      (open→in_progress/cancelled, in_progress→open/cancelled,
 *       resolved→closed, terminal states immutable),
 *   2. cancellation requires a reason and lands in cancelled (NOT closed),
 *      with cancelled_at/cancellation_reason + audit trail,
 *   3. raw status updates fail closed (MAINTENANCE_STATUS_VIA_COMMAND),
 *   4. the FULL journey works end-to-end:
 *      request → assignment (in_progress) → work → cost → expense (via
 *      resolve_maintenance_with_expense) → close,
 *   5. resolution stays financially coupled: the transition command refuses
 *      'resolved' and points at the expense-coupled RPC.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../p1/replay-bootstrap';

const COMPANY = 'a8000000-0000-4000-8000-000000000001';
const ADMIN = 'a8000000-0000-4000-8000-000000000011';
const OWNER = 'a8000000-0000-4000-8000-000000000021';
const PROPERTY = 'a8000000-0000-4000-8000-000000000031';
const UNIT = 'a8000000-0000-4000-8000-000000000041';

let db: PGlite;

/**
 * Seed a request directly. create_maintenance_atomic has a PRE-EXISTING
 * uuid=text comparison incompatibility on the clean replay chain (live
 * schemas carry text ids) — that defect predates R8 and is out of its scope;
 * the authorities under test here are transition/resolve.
 */
async function createRequest(title: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.maintenance_records (property_id, unit_id, title, priority, status, technician_name, company_id)
     values ($1::uuid, $2::uuid, $3, 'high', 'open', 'فني الاختبار', $4::uuid)
     returning id::text as id`,
    [PROPERTY, UNIT, title, COMPANY],
  );
  return rows[0].id;
}

async function transition(id: string, status: string, reason: string | null = null) {
  const { rows } = await db.query<{ out: any }>(
    `select public.transition_maintenance_status_atomic($1::text, $2::text, $3::text) as out`,
    [id, status, reason],
  );
  return rows[0]?.out as any;
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values ('${COMPANY}', 'R8 Co', 'r8-co');
    insert into auth.users (id, email, raw_app_meta_data) values
      ('${ADMIN}', 'admin@r8.test', '{"company_id":"${COMPANY}"}'::jsonb);
    insert into public.users (id, email, name, role, status, is_active) values
      ('${ADMIN}', 'admin@r8.test', 'Admin', 'ADMIN', 'ACTIVE', true);
    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${ADMIN}', 'ADMIN');
    insert into public.company_settings (id, singleton_key, company_name, currency, company_id)
    values (gen_random_uuid(), false, 'R8 Co', 'OMR', '${COMPANY}');
    insert into public.owners (id, full_name, name, company_id)
    values ('${OWNER}', 'R8 Owner', 'R8 Owner', '${COMPANY}');
    insert into public.properties (id, title, name, type, address, status, company_id)
    values ('${PROPERTY}', 'R8 Property', 'R8 Property', 'residential', 'Muscat', 'active', '${COMPANY}');
    insert into public.units (id, property_id, unit_number, company_id)
    values ('${UNIT}', '${PROPERTY}', 'R8-1', '${COMPANY}');
  `);

  await assumeIdentity(db, ADMIN, COMPANY);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('R8 — maintenance lifecycle authority', () => {
  it('cancellation is a DISTINCT terminal state with a mandatory reason', async () => {
    const id = await createRequest('طلب سيُلغى');

    // Reason is mandatory.
    await expect(transition(id, 'cancelled')).rejects.toThrow(/MAINTENANCE_CANCELLATION_REASON_REQUIRED/);

    const cancelled = await transition(id, 'cancelled', 'اكتشفنا أن العطل من مسؤولية المستأجر');
    expect(cancelled.status).toBe('cancelled'); // NOT normalized to closed.
    expect(cancelled.cancelled_at).toBeTruthy();
    expect(cancelled.cancellation_reason).toContain('مسؤولية المستأجر');

    // Terminal: no resurrection.
    await expect(transition(id, 'open')).rejects.toThrow(/MAINTENANCE_LIFECYCLE_TERMINAL/);
    await expect(transition(id, 'in_progress')).rejects.toThrow(/MAINTENANCE_LIFECYCLE_TERMINAL/);

    // Audited.
    const { rows } = await db.query<{ n: string }>(
      `select count(*)::text as n from public.audit_log
        where entity = 'maintenance_records' and entity_id = $1 and action = 'STATUS_CANCELLED'`,
      [id],
    );
    expect(Number(rows[0].n)).toBe(1);
  });

  it('enforces the legal transition matrix and refuses resolved via transition', async () => {
    const id = await createRequest('طلب مصفوفة الانتقالات');

    // open → closed is illegal (work never happened).
    await expect(transition(id, 'closed')).rejects.toThrow(/MAINTENANCE_TRANSITION_ILLEGAL/);
    // resolution must go through the expense-coupled RPC.
    await expect(transition(id, 'resolved')).rejects.toThrow(/MAINTENANCE_RESOLVE_VIA_RPC/);

    // open → in_progress → open → in_progress is legal (work rescheduling).
    expect((await transition(id, 'in_progress')).status).toBe('in_progress');
    expect((await transition(id, 'open')).status).toBe('open');
    expect((await transition(id, 'in_progress')).status).toBe('in_progress');
  });

  it('raw status updates fail closed — transitions are server commands only', async () => {
    const id = await createRequest('طلب تحديث خام');
    await expect(
      db.query(`update public.maintenance_records set status = 'closed' where id::text = $1`, [id]),
    ).rejects.toThrow(/MAINTENANCE_STATUS_VIA_COMMAND/);
    // Non-status fields stay editable (raw notes update is fine).
    await db.query(`update public.maintenance_records set notes = 'ملاحظة تشغيلية' where id::text = $1`, [id]);
    const { rows } = await db.query<{ status: string; notes: string }>(
      `select status, notes from public.maintenance_records where id::text = $1`, [id],
    );
    expect(rows[0].status).toBe('open');
    expect(rows[0].notes).toBe('ملاحظة تشغيلية');
  });

  it('runs the FULL journey: request → assignment → work → cost → expense → close', async () => {
    const id = await createRequest('تسريب مياه رئيسي');

    // Assignment/work starts.
    expect((await transition(id, 'in_progress')).status).toBe('in_progress');

    // Work done with a cost → resolve couples the expense atomically.
    const { rows } = await db.query<{ out: any }>(
      `select public.resolve_maintenance_with_expense(
         p_request_id := $1::text, p_cost := 42.5, p_notes := 'استبدال محبس رئيسي'
       ) as out`,
      [id],
    );
    const resolved = rows[0]?.out as any;
    expect(resolved.maintenance.status).toBe('resolved');
    expect(resolved.expense_id).toBeTruthy();

    // The expense exists, is owner-agnostic here, and carries the cost.
    const { rows: expense } = await db.query<{ amount: string; deleted_at: string | null }>(
      `select amount::text, deleted_at from public.expenses where id::text = $1`,
      [String(resolved.expense_id)],
    );
    expect(Number(expense[0].amount)).toBe(42.5);
    expect(expense[0].deleted_at).toBeNull();

    // Close through the sanctioned command.
    const closed = await transition(id, 'closed');
    expect(closed.status).toBe('closed');
    expect(closed.resolved_at).toBeTruthy();

    // Terminal.
    await expect(transition(id, 'open')).rejects.toThrow(/MAINTENANCE_LIFECYCLE_TERMINAL/);
  });
});
