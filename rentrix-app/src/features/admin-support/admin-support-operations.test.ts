import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  assumeIdentity,
  createFullReplayedDatabase,
} from "@/p1/replay-bootstrap";
import {
  canAccess,
  type AuthorizationContext,
} from "@/features/auth/permissions";

const COMPANY = "d4000000-0000-4000-8000-000000000001";
const ADMIN = "d4000000-0000-4000-8000-000000000011";
const MANAGER = "d4000000-0000-4000-8000-000000000012";
const USER = "d4000000-0000-4000-8000-000000000013";
let db: PGlite;
let requestId: string;

function authorization(
  role: AuthorizationContext["role"],
): AuthorizationContext {
  return { userId: `${role}-id`, email: null, role, grantedPermissions: [] };
}

describe("admin/support frontend capability matrix", () => {
  it("grants the minimal toolkit and keeps user lookup admin-only", () => {
    expect(canAccess(authorization("ADMIN"), "support.operations.view")).toBe(
      true,
    );
    expect(canAccess(authorization("ADMIN"), "support.requests.triage")).toBe(
      true,
    );
    expect(canAccess(authorization("ADMIN"), "support.user_lookup.view")).toBe(
      true,
    );
    expect(canAccess(authorization("MANAGER"), "support.operations.view")).toBe(
      true,
    );
    expect(canAccess(authorization("MANAGER"), "support.requests.triage")).toBe(
      true,
    );
    expect(
      canAccess(authorization("MANAGER"), "support.user_lookup.view"),
    ).toBe(false);
    for (const role of [
      "ACCOUNTANT",
      "OPERATIONS",
      "USER",
      "VIEWER",
    ] as const) {
      expect(canAccess(authorization(role), "support.operations.view")).toBe(
        false,
      );
      expect(canAccess(authorization(role), "support.requests.triage")).toBe(
        false,
      );
      expect(canAccess(authorization(role), "support.user_lookup.view")).toBe(
        false,
      );
    }
  });
});

describe("admin/support authoritative database boundary", () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;
    await db.exec(`
      insert into public.companies(id,name,slug) values('${COMPANY}','Admin Support Test','admin-support-test');
      insert into auth.users(id,email) values
        ('${ADMIN}','admin.owner@test.invalid'),('${MANAGER}','manager.ops@test.invalid'),('${USER}','normal.user@test.invalid');
      insert into public.users(id,email,name,full_name,role,status,is_active) values
        ('${ADMIN}','admin.owner@test.invalid','Admin Owner','Admin Owner','ADMIN','ACTIVE',true),
        ('${MANAGER}','manager.ops@test.invalid','Manager Ops','Manager Operations','MANAGER','ACTIVE',true),
        ('${USER}','normal.user@test.invalid','Normal User','Normal User','USER','ACTIVE',true);
      insert into public.company_members(company_id,user_id,role) values
        ('${COMPANY}','${ADMIN}','ADMIN'),('${COMPANY}','${MANAGER}','MEMBER'),('${COMPANY}','${USER}','MEMBER');
    `);
    await assumeIdentity(db, USER, COMPANY);
    const created = await db.query<{ result: { id: string } }>(`
      select public.create_support_request_atomic(
        'TECHNICAL','HIGH','/contracts','test-version','ERR-LOAD',
        'يجب أن تظهر قائمة العقود بعد التحميل',
        'ظهرت حالة خطأ عامة بعد إعادة المحاولة'
      ) result
    `);
    requestId = created.rows[0].result.id;
  }, 420_000);

  afterAll(async () => {
    await db?.close();
  });

  it("denies normal users and gives managers metadata-only support scope", async () => {
    const privileges = await db.query<{
      can_update: boolean;
      can_insert: boolean;
      can_delete: boolean;
    }>(
      `select has_table_privilege('authenticated','public.users','UPDATE') can_update,
              has_table_privilege('authenticated','public.users','INSERT') can_insert,
              has_table_privilege('authenticated','public.users','DELETE') can_delete`,
    );
    expect(privileges.rows[0]).toEqual({
      can_update: false,
      can_insert: false,
      can_delete: false,
    });
    await assumeIdentity(db, USER, COMPANY);
    await expect(
      db.query(`select public.get_admin_support_operations_snapshot(null)`),
    ).rejects.toThrow(/SUPPORT_OPERATIONS_VIEW_REQUIRED/);

    await assumeIdentity(db, MANAGER, COMPANY);
    const snapshot = await db.query<{ result: Record<string, any> }>(
      `select public.get_admin_support_operations_snapshot('MS-') result`,
    );
    expect(snapshot.rows[0].result.capabilities).toEqual({
      view: true,
      triage: true,
      user_lookup: false,
    });
    expect(snapshot.rows[0].result.users).toEqual([]);
    expect(snapshot.rows[0].result.audit).toEqual([]);
    expect(snapshot.rows[0].result.limits).toMatchObject({
      bulk_actions: 0,
      exports: false,
      impersonation: false,
    });
    expect(snapshot.rows[0].result.requests).toHaveLength(1);
    expect(snapshot.rows[0].result.requests[0]).not.toHaveProperty(
      "expected_behavior",
    );
    expect(snapshot.rows[0].result.requests[0]).not.toHaveProperty(
      "actual_behavior",
    );
    expect(snapshot.rows[0].result.requests[0]).not.toHaveProperty(
      "requester_id",
    );
  });

  it("triages one request idempotently with reason and immutable audit, while manager cannot close", async () => {
    const key = "d4000000-0000-4000-8000-000000000091";
    await assumeIdentity(db, MANAGER, COMPANY);
    const first = await db.query<{
      result: { status: string; duplicate: boolean };
    }>(`
      select public.triage_support_request_atomic(
        '${requestId}'::uuid,'IN_REVIEW','جارٍ التحقق من مرجع الخطأ',
        'بدء التحقيق في خطأ تحميل العقود','${key}'::uuid
      ) result
    `);
    expect(first.rows[0].result).toMatchObject({
      status: "IN_REVIEW",
      duplicate: false,
    });
    const duplicate = await db.query<{
      result: { status: string; duplicate: boolean };
    }>(`
      select public.triage_support_request_atomic(
        '${requestId}'::uuid,'IN_REVIEW','جارٍ التحقق من مرجع الخطأ',
        'بدء التحقيق في خطأ تحميل العقود','${key}'::uuid
      ) result
    `);
    expect(duplicate.rows[0].result).toMatchObject({
      status: "IN_REVIEW",
      duplicate: true,
    });
    await expect(
      db.query(`select public.triage_support_request_atomic(
      '${requestId}'::uuid,'CLOSED',null,'محاولة إغلاق من المدير','d4000000-0000-4000-8000-000000000092'::uuid
    )`),
    ).rejects.toThrow(/SUPPORT_CLOSE_ADMIN_REQUIRED/);

    const event = await db.query<{ reason: string; count: number }>(`
      select min(reason) reason,count(*)::int count from public.support_request_events
      where company_id='${COMPANY}'::uuid and idempotency_key='${key}'::uuid
    `);
    expect(event.rows[0]).toEqual({
      reason: "بدء التحقيق في خطأ تحميل العقود",
      count: 1,
    });
    await expect(
      db.query(
        `update public.admin_support_audit_events set outcome='tampered' where company_id='${COMPANY}'::uuid`,
      ),
    ).rejects.toThrow(/ADMIN_SUPPORT_AUDIT_IMMUTABLE/);
  });

  it("returns masked admin-only user lookup and creates a non-executable proposal without changing access", async () => {
    await assumeIdentity(db, ADMIN, COMPANY);
    const snapshot = await db.query<{ result: Record<string, any> }>(
      `select public.get_admin_support_operations_snapshot('normal') result`,
    );
    expect(snapshot.rows[0].result.capabilities.user_lookup).toBe(true);
    expect(snapshot.rows[0].result.users).toHaveLength(1);
    expect(snapshot.rows[0].result.users[0]).toMatchObject({
      id: USER,
      name_masked: "N***",
      email_masked: "n***@t***",
      app_role: "USER",
    });
    expect(JSON.stringify(snapshot.rows[0].result.users)).not.toContain(
      "normal.user@test.invalid",
    );

    const key = "d4000000-0000-4000-8000-000000000093";
    const proposal = await db.query<{ result: Record<string, unknown> }>(`
      select public.propose_user_access_change_atomic(
        '${USER}'::uuid,'VIEWER',false,'إيقاف مؤقت لحين مراجعة وصول الحساب','${key}'::uuid
      ) result
    `);
    expect(proposal.rows[0].result).toMatchObject({
      status: "PENDING_OWNER_APPROVAL",
      executed: false,
      duplicate: false,
      current_role: "USER",
      proposed_role: "VIEWER",
    });
    const unchanged = await db.query<{ role: string; is_active: boolean }>(
      `select role::text,is_active from public.users where id='${USER}'::uuid`,
    );
    expect(unchanged.rows[0]).toEqual({ role: "USER", is_active: true });
    await expect(
      db.query(`select public.propose_user_access_change_atomic(
      '${ADMIN}'::uuid,'VIEWER',false,'محاولة تغيير الحساب الحالي','d4000000-0000-4000-8000-000000000094'::uuid
    )`),
    ).rejects.toThrow(/ACCESS_PROPOSAL_SELF_CHANGE_PROHIBITED/);

    await db.exec(`insert into public.user_permission_grants(company_id,user_id,permission,granted_by)
      values('${COMPANY}','${MANAGER}','support.user_lookup.view','${ADMIN}')`);
    await assumeIdentity(db, MANAGER, COMPANY);
    await expect(
      db.query(`select public.propose_user_access_change_atomic(
        '${ADMIN}'::uuid,'VIEWER',false,'محاولة خفض صلاحية آخر مسؤول نشط','d4000000-0000-4000-8000-000000000095'::uuid
      )`),
    ).rejects.toThrow(/ACCESS_PROPOSAL_LAST_ADMIN_PROTECTED/);
  });
});
