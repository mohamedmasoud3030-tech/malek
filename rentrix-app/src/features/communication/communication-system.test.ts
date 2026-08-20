import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  assumeIdentity,
  createFullReplayedDatabase,
} from "@/p1/replay-bootstrap";
import {
  communicationEventPolicies,
  communicationProviderCapabilities,
  communicationTemplates,
  getCommunicationRetryDecision,
  prepareCommunicationPreview,
  type CommunicationPreference,
} from "./communication-system";

const COMPANY = "c3000000-0000-4000-8000-000000000001";
const ADMIN = "c3000000-0000-4000-8000-000000000011";
const MEMBER = "c3000000-0000-4000-8000-000000000012";
let db: PGlite;

const enabledPreference: CommunicationPreference = {
  enabled: true,
  locale: "ar",
  timezone: "Asia/Muscat",
  quietHoursStart: 21,
  quietHoursEnd: 8,
};

describe("communication policy and templates", () => {
  it("justifies channels per event and leaves push/SMS disabled", () => {
    expect(
      communicationEventPolicies.find(
        (policy) => policy.eventType === "PAYMENT_RESULT_UNCERTAIN",
      ),
    ).toMatchObject({
      channels: ["in_app"],
      mandatoryInApp: true,
      priority: "CRITICAL",
    });
    expect(
      communicationEventPolicies.find(
        (policy) => policy.eventType === "RENT_DUE_REMINDER",
      )?.channels,
    ).toEqual(["email", "whatsapp"]);
    expect(
      communicationProviderCapabilities.find(
        (provider) => provider.channel === "sms",
      )?.enabled,
    ).toBe(false);
    expect(
      communicationProviderCapabilities.find(
        (provider) => provider.channel === "push",
      )?.enabled,
    ).toBe(false);
  });

  it("ships complete Arabic/English generic templates without unresolved variables or sensitive previews", () => {
    for (const policy of communicationEventPolicies) {
      for (const channel of policy.channels) {
        for (const locale of ["ar", "en"]) {
          const template = communicationTemplates.find(
            (candidate) =>
              candidate.eventType === policy.eventType &&
              candidate.channel === channel &&
              candidate.locale === locale,
          );
          expect(
            template,
            `${policy.eventType}/${channel}/${locale}`,
          ).toBeDefined();
          expect(template?.body).not.toMatch(/{{|}}|[0-9]{8,}|@/);
          expect(template?.subject ?? "").not.toMatch(/{{|}}|[0-9]{4,}|@/);
        }
      }
    }
  });

  it("enforces consent, review, preference and quiet hours before external preview", () => {
    const base = {
      eventType: "RENT_DUE_REMINDER" as const,
      channel: "whatsapp" as const,
      locale: "ar" as const,
      recipient: "+96891234567",
      preference: enabledPreference,
    };
    expect(
      prepareCommunicationPreview({
        ...base,
        consentGranted: false,
        humanReviewed: false,
      }).reason,
    ).toBe("CONSENT_REQUIRED");
    expect(
      prepareCommunicationPreview({
        ...base,
        consentGranted: true,
        humanReviewed: false,
      }).reason,
    ).toBe("HUMAN_REVIEW_REQUIRED");
    expect(
      prepareCommunicationPreview({
        ...base,
        consentGranted: true,
        humanReviewed: true,
        now: new Date("2026-08-20T18:30:00.000Z"),
      }).reason,
    ).toBe("QUIET_HOURS");
    expect(
      prepareCommunicationPreview({
        ...base,
        consentGranted: true,
        humanReviewed: true,
        preference: {
          ...enabledPreference,
          quietHoursStart: 0,
          quietHoursEnd: 0,
        },
      }),
    ).toMatchObject({ accepted: true, mode: "preview" });
  });

  it("retries transient failures only with bounded backoff", () => {
    expect(getCommunicationRetryDecision(0, "NETWORK")).toEqual({
      retry: true,
      delaySeconds: 60,
    });
    expect(getCommunicationRetryDecision(1, "RATE_LIMIT")).toEqual({
      retry: true,
      delaySeconds: 300,
    });
    expect(getCommunicationRetryDecision(2, "SERVER")).toEqual({
      retry: true,
      delaySeconds: 1800,
    });
    expect(getCommunicationRetryDecision(3, "NETWORK")).toEqual({
      retry: false,
      delaySeconds: null,
    });
    expect(getCommunicationRetryDecision(0, "AUTH")).toEqual({
      retry: false,
      delaySeconds: null,
    });
    expect(getCommunicationRetryDecision(0, "INVALID_RECIPIENT")).toEqual({
      retry: false,
      delaySeconds: null,
    });
  });
});

describe("communication preview database controls", () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;
    await db.exec(`
      insert into public.companies(id,name,slug) values('${COMPANY}','Communication Test','communication-test');
      insert into auth.users(id,email) values('${ADMIN}','comm-admin@test.invalid'),('${MEMBER}','comm-member@test.invalid');
      insert into public.users(id,email,name,role,status,is_active) values
        ('${ADMIN}','comm-admin@test.invalid','Communication Admin','ADMIN','ACTIVE',true),
        ('${MEMBER}','comm-member@test.invalid','Communication Member','USER','ACTIVE',true);
      insert into public.company_members(company_id,user_id,role) values
        ('${COMPANY}','${ADMIN}','ADMIN'),('${COMPANY}','${MEMBER}','MEMBER');
    `);
  }, 420_000);

  afterAll(async () => {
    await db?.close();
  });

  it("prevents opting out of mandatory in-app events but persists optional external preference", async () => {
    await assumeIdentity(db, MEMBER, COMPANY);
    await expect(
      db.query(
        `select public.set_my_communication_preference_atomic('ACCESS_DECISION','IN_APP',false,'ar',21,8)`,
      ),
    ).rejects.toThrow(/COMMUNICATION_TRANSACTIONAL_IN_APP_REQUIRED/);
    const preference = await db.query<{
      result: { enabled: boolean; channel: string };
    }>(
      `select public.set_my_communication_preference_atomic('RENT_DUE_REMINDER','WHATSAPP',true,'ar',0,0) result`,
    );
    expect(preference.rows[0].result).toMatchObject({
      enabled: true,
      channel: "WHATSAPP",
    });
  });

  it("enforces authority, preferences, consent and one-time idempotent preview reservation", async () => {
    const key = "c3000000-0000-4000-8000-000000000099";
    await assumeIdentity(db, MEMBER, COMPANY);
    await expect(
      db.query(
        `select public.prepare_communication_preview_atomic('RENT_DUE_REMINDER','WHATSAPP','${MEMBER}'::uuid,'invoice',null,'${key}'::uuid,'ar',true,true)`,
      ),
    ).rejects.toThrow(/COMMUNICATION_PREVIEW_AUTHORITY_REQUIRED/);

    await assumeIdentity(db, ADMIN, COMPANY);
    const suppressed = await db.query<{
      result: { status: string; suppression_reason: string };
    }>(
      `select public.prepare_communication_preview_atomic('OWNER_STATEMENT_READY','EMAIL','${MEMBER}'::uuid,'owner_statement',null,'c3000000-0000-4000-8000-000000000098'::uuid,'ar',true,true) result`,
    );
    expect(suppressed.rows[0].result).toMatchObject({
      status: "SUPPRESSED",
      suppression_reason: "PREFERENCE_DISABLED",
    });

    const first = await db.query<{
      result: {
        id: string;
        status: string;
        duplicate: boolean;
        reserved_cost_microusd: number;
      };
    }>(
      `select public.prepare_communication_preview_atomic('RENT_DUE_REMINDER','WHATSAPP','${MEMBER}'::uuid,'invoice',null,'${key}'::uuid,'ar',true,true) result`,
    );
    expect(first.rows[0].result).toMatchObject({
      status: "PREVIEW",
      duplicate: false,
      reserved_cost_microusd: 0,
    });
    const evidence = await db.query<{
      consent: boolean;
      reviewer: string;
      reviewed: boolean;
    }>(
      `select consent_confirmed_at is not null consent,human_reviewed_by::text reviewer,human_reviewed_at is not null reviewed from public.communication_delivery_outbox where id='${first.rows[0].result.id}'::uuid`,
    );
    expect(evidence.rows[0]).toEqual({
      consent: true,
      reviewer: ADMIN,
      reviewed: true,
    });
    const duplicate = await db.query<{
      result: { id: string; status: string; duplicate: boolean };
    }>(
      `select public.prepare_communication_preview_atomic('RENT_DUE_REMINDER','WHATSAPP','${MEMBER}'::uuid,'invoice',null,'${key}'::uuid,'ar',true,true) result`,
    );
    expect(duplicate.rows[0].result).toMatchObject({
      id: first.rows[0].result.id,
      status: "PREVIEW",
      duplicate: true,
    });

    await assumeIdentity(db, MEMBER, COMPANY);
    await db.query(
      `select public.set_my_communication_preference_atomic('RENT_DUE_REMINDER','WHATSAPP',false,'ar',0,0)`,
    );
    await assumeIdentity(db, ADMIN, COMPANY);
    const afterOptOut = await db.query<{
      result: { status: string; suppression_reason: string };
    }>(
      `select public.prepare_communication_preview_atomic('RENT_DUE_REMINDER','WHATSAPP','${MEMBER}'::uuid,'invoice',null,'c3000000-0000-4000-8000-000000000097'::uuid,'ar',true,true) result`,
    );
    expect(afterOptOut.rows[0].result).toMatchObject({
      status: "SUPPRESSED",
      suppression_reason: "PREFERENCE_DISABLED",
    });
  });

  it("sanitizes legacy in-app notification copy and links before persistence", async () => {
    await db.exec(`
      insert into public.app_notifications(id,company_id,recipient_user_id,type,title,message,link,created_at)
      values('unsafe-notification','${COMPANY}','${MEMBER}','permission_decision','token abc','call 99112233','/contracts/c3000000-0000-4000-8000-000000000099',now());
      insert into public.automation_notifications(company_id,type,title,body,related_entity_type,related_entity_id)
      values('${COMPANY}','overdue_invoice','invoice c3000000-0000-4000-8000-000000000099','amount 250.000 for 99112233','invoice','source-1');
    `);
    const app = await db.query<{
      title: string;
      message: string;
      link: string;
    }>(
      `select title,message,link from public.app_notifications where id='unsafe-notification'`,
    );
    expect(app.rows[0]).toEqual({
      title: "تم تحديث حالة صلاحية",
      message: "راجع حالة الصلاحية من المسار المعتمد داخل MALEK.",
      link: "/settings?section=users-permissions",
    });
    const automation = await db.query<{ title: string; body: string }>(
      `select title,body from public.automation_notifications where company_id='${COMPANY}'::uuid order by created_at desc limit 1`,
    );
    expect(automation.rows[0].title).toBe("متابعة متأخرات");
    expect(automation.rows[0].body).not.toMatch(/250|99112233|c3000000/);
  });
});
