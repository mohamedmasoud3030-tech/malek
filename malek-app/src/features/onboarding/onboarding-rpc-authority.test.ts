import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '@/p1/replay-bootstrap';

const COMPANY_A = '0a000000-0000-4000-8000-0000000000d1';
const COMPANY_B = '0b000000-0000-4000-8000-0000000000d1';
const ADMIN_A = '0a000000-0000-0000-0000-000000000dd1';
const MANAGER_A = '0a000000-0000-0000-0000-000000000dd2';
const ADMIN_B = '0b000000-0000-0000-0000-000000000dd1';

let db: PGlite;

async function rpc(sql: string): Promise<Record<string, unknown>> {
  const { rows } = await db.query<{ r: unknown }>(sql);
  return (rows[0]?.r ?? {}) as Record<string, unknown>;
}

const state = () => rpc(`select public.get_company_onboarding_state() as r`);
const waive = (code: string, reason: string, evidence?: string) =>
  rpc(`select public.waive_onboarding_requirement_atomic('${code}', '${reason}', ${evidence ? `'${evidence}'` : 'null'}) as r`);
const complete = () => rpc(`select public.complete_company_onboarding_atomic() as r`);
const revoke = (code: string) => rpc(`select public.revoke_onboarding_waiver_atomic('${code}') as r`);
const reset = () => rpc(`select public.reset_company_onboarding_atomic() as r`);

describe('WP-03 GAP-005 onboarding authority (PGlite behavioral)', () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;

    await db.exec(`
      insert into public.companies (id, name, slug, timezone) values
        ('${COMPANY_A}', 'Onboarding A', 'onb-a', 'Asia/Muscat'),
        ('${COMPANY_B}', 'Onboarding B', 'onb-b', 'Asia/Muscat')
      on conflict (id) do nothing;

      insert into auth.users (id, email, raw_app_meta_data) values
        ('${ADMIN_A}', 'onb-admin-a@test.invalid', '{}'),
        ('${MANAGER_A}', 'onb-manager-a@test.invalid', '{}'),
        ('${ADMIN_B}', 'onb-admin-b@test.invalid', '{}')
      on conflict (id) do nothing;

      insert into public.users (id, email, name, role, status, is_active) values
        ('${ADMIN_A}', 'onb-admin-a@test.invalid', 'Admin A', 'ADMIN', 'ACTIVE', true),
        ('${MANAGER_A}', 'onb-manager-a@test.invalid', 'Manager A', 'MANAGER', 'ACTIVE', true),
        ('${ADMIN_B}', 'onb-admin-b@test.invalid', 'Admin B', 'ADMIN', 'ACTIVE', true)
      on conflict (id) do update set role = excluded.role, status = 'ACTIVE', is_active = true;

      insert into public.company_members (company_id, user_id, role) values
        ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN'),
        ('${COMPANY_A}', '${MANAGER_A}', 'MANAGER'),
        ('${COMPANY_B}', '${ADMIN_B}', 'ADMIN')
      on conflict (company_id, user_id) do update set role = excluded.role;
    `);
  }, 420_000);

  afterAll(async () => {
    await db?.close();
  });

  it('seeds the canonical operating order and reports a fresh company as not completed', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const s = await state();
    expect(s.completed).toBe(false);
    const requirements = s.requirements as Array<Record<string, unknown>>;
    expect(requirements.map((r) => r.code)).toEqual(['owner', 'property', 'unit', 'contract', 'invoice']);
    expect(requirements[0].waiver_policy).toBe('NON_WAIVABLE');
    expect(requirements[1].waiver_policy).toBe('NON_WAIVABLE');
    expect(requirements[2].waiver_policy).toBe('ADMIN_WAIVABLE');
  });

  it('fails closed when waiving a NON_WAIVABLE identity/authority gate', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    await expect(waive('owner', 'تخطي')).rejects.toThrow(/NON_WAIVABLE/i);
    await expect(waive('property', 'تخطي')).rejects.toThrow(/NON_WAIVABLE/i);
  });

  it('rejects a blank waiver reason', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    await expect(waive('unit', '   ')).rejects.toThrow(/REASON_REQUIRED/i);
  });

  it('records an admin waiver with authority and evidence', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    await waive('unit', 'تُدار الوحدة عبر نظام خارجي', 'ext-1');
    const s = await state();
    const requirements = s.requirements as Array<Record<string, unknown>>;
    const unit = requirements.find((r) => r.code === 'unit')!;
    expect(unit.waived).toBe(true);
    expect(unit.waiver_authority).toBe('ADMIN');
    expect(unit.evidence_reference).toBe('ext-1');
  });

  it('denies waivers to a non-admin member', async () => {
    await assumeIdentity(db, MANAGER_A, COMPANY_A);
    await expect(waive('contract', 'تخطي')).rejects.toThrow(/ADMIN_REQUIRED/i);
  });

  it('persists completion as a single company-scoped fact and supports revoke/reset', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    // Completion is server-validated: without owner/property (NON_WAIVABLE)
    // evidence and a satisfied contract gate, it must fail closed.
    await expect(complete()).rejects.toThrow(/INCOMPLETE_REQUIREMENT/i);

    // Provide the NON_WAIVABLE data (as the table owner) and waive the
    // ADMIN_WAIVABLE contract gate. Contract lifecycle is not the subject here.
    await db.exec(`
      insert into public.owners (id, full_name, company_id) values
        ('0a000000-0000-0000-0000-000000000ee1', 'Owner A', '${COMPANY_A}');
      insert into public.properties (id, title, type, address, status, company_id) values
        ('0a000000-0000-0000-0000-000000000ee2', 'Property A', 'residential', 'C', 'active', '${COMPANY_A}');
      insert into public.units (id, name, property_id, unit_number, status, company_id) values
        ('0a000000-0000-0000-0000-000000000ee3', 'U1', '0a000000-0000-0000-0000-000000000ee2', 'U-1', 'available', '${COMPANY_A}');
    `);
    await waive('contract', 'العقد الأول يصدر لاحقاً', 'ref-contract');
    await complete();
    expect((await state()).completed).toBe(true);
    // Durable audit: a COMPLETE event and a WAIVE event exist.
    const completeEvents = await db.query<{ c: string }>(
      `select count(*)::text as c from public.company_onboarding_events where company_id = '${COMPANY_A}' and action = 'COMPLETE'`,
    );
    expect(Number(completeEvents.rows[0].c)).toBeGreaterThanOrEqual(1);

    await revoke('unit');
    const s = await state();
    const unit = (s.requirements as Array<Record<string, unknown>>).find((r) => r.code === 'unit')!;
    expect(unit.waived).toBe(false);
    // Revoke preserves the grant record (marked revoked, not deleted).
    const retained = await db.query<{ c: string }>(
      `select count(*)::text as c from public.company_onboarding_waivers where company_id = '${COMPANY_A}' and requirement_code = 'unit' and revoked_at is not null`,
    );
    expect(Number(retained.rows[0].c)).toBe(1);
    const revokeEvents = await db.query<{ c: string }>(
      `select count(*)::text as c from public.company_onboarding_events where company_id = '${COMPANY_A}' and action = 'REVOKE'`,
    );
    expect(Number(revokeEvents.rows[0].c)).toBeGreaterThanOrEqual(1);

    await reset();
    expect((await state()).completed).toBe(false);
    const resetEvents = await db.query<{ c: string }>(
      `select count(*)::text as c from public.company_onboarding_events where company_id = '${COMPANY_A}' and action = 'RESET'`,
    );
    expect(Number(resetEvents.rows[0].c)).toBeGreaterThanOrEqual(1);
  });

  it('isolates company B from company A waivers and completion', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    // Company A has owner/property/unit data (persisted above); re-satisfy the
    // ADMIN_WAIVABLE contract gate (reset revoked it) and complete.
    await waive('contract', 'العقد الأول يصدر لاحقاً', 'ref-contract');
    await waive('invoice', 'تخطي مؤقت');
    await complete();
    expect((await state()).completed).toBe(true);

    await assumeIdentity(db, ADMIN_B, COMPANY_B);
    const s = await state();
    expect(s.company_id).toBe(COMPANY_B);
    expect(s.completed).toBe(false);
    const invoice = (s.requirements as Array<Record<string, unknown>>).find((r) => r.code === 'invoice')!;
    expect(invoice.waived).toBe(false);
    // Company B does not inherit company A's audit events (RLS isolation).
    const bEvents = await db.query<{ c: string }>(
      `select count(*)::text as c from public.company_onboarding_events where company_id = '${COMPANY_B}'`,
    );
    expect(Number(bEvents.rows[0].c)).toBe(0);
    // Company B (no evidence) still cannot complete.
    await expect(complete()).rejects.toThrow(/INCOMPLETE_REQUIREMENT/i);
  });
});
