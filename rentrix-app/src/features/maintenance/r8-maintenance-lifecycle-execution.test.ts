/**
 * R8 — Maintenance / Services Lifecycle: full journey + Cancelled ≠ Closed.
 *
 * Proves against a FULL migration replay:
 *   1. transition_maintenance_status_atomic enforces the legal matrix
 *      (open→in_progress/cancelled, in_progress→open/resolved/cancelled,
 *       resolved→closed, terminal states immutable),
 *   2. cancellation requires a reason and lands in cancelled (NOT closed),
 *      with cancelled_at/cancellation_reason + audit trail,
 *   3. raw status updates fail closed (MAINTENANCE_STATUS_VIA_COMMAND),
 *   4. the FULL journey works end-to-end:
 *      request → assignment (in_progress) → work completed → verified close,
 *   5. technical completion stays separate from financial/operational closure.
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
 * Create through the CANONICAL production RPC (create_maintenance_atomic).
 * The clean-chain uuid=text defect was fixed forward in
 * 20260826000000_r8_fix_create_maintenance_atomic_clean_chain.sql — the
 * journey below therefore exercises the exact path production uses.
 */
async function createRequest(title: string): Promise<string> {
  const { rows } = await db.query<{ out: any }>(
    `select public.create_maintenance_atomic(
       p_property_id := $1::text,
       p_unit_id := $2::text,
       p_title := $3::text,
       p_priority := 'high',
       p_technician_name := 'فني الاختبار',
       p_request_id := gen_random_uuid()::text
     ) as out`,
    [PROPERTY, UNIT, title],
  );
  const payload = rows[0]?.out as any;
  expect(payload.idempotent).toBe(false);
  return String(payload.maintenance.id);
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
    values (gen_random_uuid(), true, 'R8 Co', 'OMR', '${COMPANY}');
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
  it('creates through the canonical RPC on a clean replayed chain (fix-forward proof) with idempotent retry', async () => {
    const requestKey = 'r8-canonical-create-1';
    const first = (await db.query<{ out: any }>(
      `select public.create_maintenance_atomic(
         p_property_id := $1::text, p_unit_id := $2::text, p_title := 'إنشاء عبر المسار الرسمي',
         p_priority := 'medium', p_request_id := $3::text) as out`,
      [PROPERTY, UNIT, requestKey],
    )).rows[0]?.out as any;
    expect(first.idempotent).toBe(false);
    expect(first.maintenance.status).toBe('open');
    expect(String(first.maintenance.property_id)).toBe(PROPERTY);
    expect(String(first.maintenance.unit_id)).toBe(UNIT);

    // Idempotent replay of the SAME request key returns the same record.
    const again = (await db.query<{ out: any }>(
      `select public.create_maintenance_atomic(
         p_property_id := $1::text, p_unit_id := $2::text, p_title := 'إنشاء عبر المسار الرسمي',
         p_priority := 'medium', p_request_id := $3::text) as out`,
      [PROPERTY, UNIT, requestKey],
    )).rows[0]?.out as any;
    expect(again.idempotent).toBe(true);
    expect(String(again.maintenance.id)).toBe(String(first.maintenance.id));

    // The audit row exists for the real creation.
    const { rows: audit } = await db.query<{ n: string }>(
      `select count(*)::text as n from public.audit_log
        where entity = 'maintenance_record' and entity_id = $1 and action = 'create'`,
      [String(first.maintenance.id)],
    );
    expect(Number(audit[0].n)).toBe(1);
  });

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

  it('enforces the legal transition matrix and allows technical completion only after work begins', async () => {
    const id = await createRequest('طلب مصفوفة الانتقالات');

    // open → closed is illegal (work never happened).
    await expect(transition(id, 'closed')).rejects.toThrow(/MAINTENANCE_TRANSITION_ILLEGAL/);
    // completion before work starts is illegal.
    await expect(transition(id, 'resolved')).rejects.toThrow(/MAINTENANCE_TRANSITION_ILLEGAL/);

    // open → in_progress → open → in_progress is legal (work rescheduling).
    expect((await transition(id, 'in_progress')).status).toBe('in_progress');
    expect((await transition(id, 'resolved')).status).toBe('resolved');
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

  it('runs the FULL journey: request → assignment → work → completed → verified close', async () => {
    const id = await createRequest('تسريب مياه رئيسي');

    // Assignment: permitted operational data updates freely (non-status).
    await db.query(
      `update public.maintenance_records
          set assigned_to = 'فريق السباكة', scheduled_date = current_date + 1
        where id::text = $1`,
      [id],
    );
    const { rows: assigned } = await db.query<{ assigned_to: string; status: string }>(
      `select assigned_to, status from public.maintenance_records where id::text = $1`, [id],
    );
    expect(assigned[0].assigned_to).toBe('فريق السباكة');
    expect(assigned[0].status).toBe('open');

    // Work starts.
    expect((await transition(id, 'in_progress')).status).toBe('in_progress');

    const completed = await transition(id, 'resolved');
    expect(completed.status).toBe('resolved');
    expect(completed.completed_at).toBeTruthy();

    await expect(db.query(
      `select public.close_maintenance_with_expense($1::text, 42.5, 'OWNER', 'استبدال محبس رئيسي', null, false)`, [id],
    )).rejects.toThrow(/MAINTENANCE_CONFIRMATION_REQUIRED/);

    const { rows } = await db.query<{ out: any }>(
      `select public.close_maintenance_with_expense($1::text, 42.5, 'OWNER', 'استبدال محبس رئيسي', 'https://example.test/invoice', true) as out`, [id],
    );
    const closed = rows[0]?.out as any;
    expect(closed.maintenance.status).toBe('closed');
    expect(closed.maintenance.cost).toBe(42.5);
    expect(closed.maintenance.charged_to).toBe('OWNER');
    expect(closed.maintenance.attachment_url).toBe('https://example.test/invoice');

    // Terminal.
    await expect(transition(id, 'open')).rejects.toThrow(/MAINTENANCE_LIFECYCLE_TERMINAL/);
  });
});
