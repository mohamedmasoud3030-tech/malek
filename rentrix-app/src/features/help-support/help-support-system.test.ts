import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  assumeIdentity,
  createFullReplayedDatabase,
} from "@/p1/replay-bootstrap";
import { sanitizeSupportRoute } from "./help-context";
import {
  getContextualHelpArticleId,
  helpArticles,
  searchHelpArticles,
} from "./help-content";
import {
  containsUnsafeSupportContent,
  validateSupportRequest,
  type SupportRequestInput,
} from "./support-service";

const COMPANY = "b2000000-0000-4000-8000-000000000001";
const USER = "b2000000-0000-4000-8000-000000000011";
const ADMIN = "b2000000-0000-4000-8000-000000000012";
let db: PGlite;

const validInput: SupportRequestInput = {
  category: "TECHNICAL",
  urgency: "NORMAL",
  route: "/contracts",
  appVersion: "test-version",
  errorReference: "ERR-LOAD-1",
  expectedBehavior: "ظهور قائمة العقود بعد اكتمال التحميل",
  actualBehavior: "ظهرت حالة خطأ بعد الضغط على إعادة المحاولة",
};

describe("help content contract", () => {
  it("provides high-value task coverage with fresh ownership metadata", () => {
    expect(helpArticles.length).toBeGreaterThanOrEqual(10);
    expect(new Set(helpArticles.map((article) => article.id)).size).toBe(
      helpArticles.length,
    );
    for (const article of helpArticles) {
      expect(article.steps.length).toBeGreaterThanOrEqual(3);
      expect(article.owner).toMatch(/^(product|operations|security|finance)$/);
      expect(article.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const ageDays =
        (Date.parse("2026-08-20") - Date.parse(article.verifiedOn)) /
        86_400_000;
      expect(ageDays).toBeGreaterThanOrEqual(0);
      expect(ageDays).toBeLessThanOrEqual(180);
    }
  });

  it("searches Arabic task language and maps routes to contextual help", () => {
    expect(searchHelpArticles("صلاحية")[0]?.id).toBe("permissions");
    expect(
      searchHelpArticles("كشف بنك").some(
        (article) => article.id === "bank-import",
      ),
    ).toBe(true);
    expect(getContextualHelpArticleId("/contracts/123")).toBe(
      "contract-lifecycle",
    );
    expect(getContextualHelpArticleId("/reports")).toBe("reports-documents");
    expect(
      sanitizeSupportRoute(
        "/contracts/00000000-0000-0000-0000-000000000123?tab=money",
      ),
    ).toBe("/contracts/:id");
  });

  it("rejects secrets, contact details and long identifiers before intake", () => {
    expect(validateSupportRequest(validInput)).toBeNull();
    expect(containsUnsafeSupportContent("password=hello")).toBe(true);
    expect(containsUnsafeSupportContent("راسلني على user@example.com")).toBe(
      true,
    );
    expect(containsUnsafeSupportContent("رقم هاتفي 99112233")).toBe(true);
    expect(
      validateSupportRequest({
        ...validInput,
        actualBehavior: "رمز token هو abcdefgh",
      }),
    ).toContain("احذف");
  });
});

describe("internal support request database boundary", () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;
    await db.exec(`
      insert into public.companies(id,name,slug) values('${COMPANY}','Support Test','support-test');
      insert into auth.users(id,email) values('${USER}','support-user@test.invalid'),('${ADMIN}','support-admin@test.invalid');
      insert into public.users(id,email,name,role,status,is_active) values
        ('${USER}','support-user@test.invalid','Support User','USER','ACTIVE',true),
        ('${ADMIN}','support-admin@test.invalid','Support Admin','ADMIN','ACTIVE',true);
      insert into public.company_members(company_id,user_id,role) values
        ('${COMPANY}','${USER}','MEMBER'),('${COMPANY}','${ADMIN}','ADMIN');
    `);
  }, 420_000);

  afterAll(async () => {
    await db?.close();
  });

  it("derives actor/company/role, acknowledges, and returns metadata-only status", async () => {
    await assumeIdentity(db, USER, COMPANY);
    const { rows } = await db.query<{
      result: {
        id: string;
        reference: string;
        status: string;
        urgency: string;
      };
    }>(`
      select public.create_support_request_atomic(
        'TECHNICAL','NORMAL','/contracts','test-version','ERR-LOAD-1',
        'ظهور قائمة العقود بعد اكتمال التحميل',
        'ظهرت حالة خطأ بعد الضغط على إعادة المحاولة'
      ) result
    `);
    expect(rows[0].result.status).toBe("ACKNOWLEDGED");
    expect(rows[0].result.reference).toMatch(/^MS-/);

    const stored = await db.query<{
      company_id: string;
      requester_id: string;
      requester_role: string;
    }>(
      `select company_id::text,requester_id::text,requester_role from public.support_requests where id='${rows[0].result.id}'::uuid`,
    );
    expect(stored.rows[0]).toEqual({
      company_id: COMPANY,
      requester_id: USER,
      requester_role: "MEMBER",
    });

    const listed = await db.query<{ result: Array<Record<string, unknown>> }>(
      `select public.list_my_support_requests() result`,
    );
    expect(listed.rows[0].result).toHaveLength(1);
    expect(listed.rows[0].result[0]).not.toHaveProperty("actual_behavior");
    expect(listed.rows[0].result[0]).not.toHaveProperty("expected_behavior");
  });

  it("rejects sensitive content and limits status updates to company admins", async () => {
    await assumeIdentity(db, USER, COMPANY);
    await expect(
      db.query(`
      select public.create_support_request_atomic(
        'TECHNICAL','NORMAL','/contracts','test-version',null,
        'أريد تحميل قائمة العقود في الشاشة',
        'كلمة المرور password والرمز token ظهرا هنا'
      )
    `),
    ).rejects.toThrow(/SUPPORT_SENSITIVE_CONTENT_REJECTED/);

    const request = await db.query<{ id: string }>(
      `select id::text from public.support_requests limit 1`,
    );
    await expect(
      db.query(
        `select public.update_support_request_status_atomic('${request.rows[0].id}'::uuid,'IN_REVIEW',null)`,
      ),
    ).rejects.toThrow(/SUPPORT_ADMIN_REQUIRED/);

    await assumeIdentity(db, ADMIN, COMPANY);
    const updated = await db.query<{ result: { status: string } }>(
      `select public.update_support_request_status_atomic('${request.rows[0].id}'::uuid,'IN_REVIEW','جارٍ فحص المرجع التقني') result`,
    );
    expect(updated.rows[0].result.status).toBe("IN_REVIEW");
  });
});
