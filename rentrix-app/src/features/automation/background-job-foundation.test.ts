import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  assumeIdentity,
  createFullReplayedDatabase,
} from "@/p1/replay-bootstrap";

const COMPANY = "e5000000-0000-4000-8000-000000000001";
const ADMIN = "e5000000-0000-4000-8000-000000000011";
const USER = "e5000000-0000-4000-8000-000000000012";
const WORKER = "e5000000-0000-4000-8000-000000000099";
const RULE = "job-test-contract-expiry";
let db: PGlite;

async function assumeWorker() {
  const claims = JSON.stringify({
    role: "service_role",
    app_metadata: { company_id: COMPANY },
  });
  await db.exec(`select set_config('request.jwt.claims','${claims}',false)`);
}

async function enqueue(requestId: string, rule = RULE) {
  return db.query<{
    result: { job_id: string; status: string; duplicate: boolean };
  }>(
    `select public.enqueue_automation_rule_job_atomic('${rule}','${requestId}'::uuid) result`,
  );
}

async function claim(worker = WORKER) {
  return db.query<{
    result: Array<{
      id: string;
      attempt_count: number;
      job_type: string;
      payload: Record<string, unknown>;
    }>;
  }>(
    `select public.claim_background_jobs_atomic('${COMPANY}'::uuid,'${worker}'::uuid,5) result`,
  );
}

describe("durable background job foundation", () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;
    await db.exec(`
      insert into public.companies(id,name,slug) values('${COMPANY}','Background Jobs','background-jobs');
      insert into auth.users(id,email) values('${ADMIN}','jobs-admin@test.invalid'),('${USER}','jobs-user@test.invalid');
      insert into public.users(id,email,name,role,status,is_active) values
        ('${ADMIN}','jobs-admin@test.invalid','Jobs Admin','ADMIN','ACTIVE',true),
        ('${USER}','jobs-user@test.invalid','Jobs User','USER','ACTIVE',true);
      insert into public.company_members(company_id,user_id,role) values
        ('${COMPANY}','${ADMIN}','ADMIN'),('${COMPANY}','${USER}','USER');
      insert into public.automation_rules(id,name,description,rule_type,is_enabled,config,company_id)
      values('${RULE}','Job test','Internal notification only','contract_expiry',true,'{}','${COMPANY}');
      insert into public.background_job_schedules(company_id,schedule_name,job_type,payload,interval_minutes,enabled,next_run_at,source_type,source_id)
      values('${COMPANY}','automation:${RULE}','AUTOMATION_RULE_EVALUATION',jsonb_build_object('rule_id','${RULE}'),1440,false,now(),'automation_rule','${RULE}');
    `);
  }, 420_000);

  afterAll(async () => {
    await db?.close();
  });

  it("denies untrusted enqueue/worker calls and keeps every prepared schedule disabled", async () => {
    const queuePrivileges = await db.query<{
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
    }>(
      `select has_table_privilege('authenticated','public.background_jobs','SELECT') can_select,
              has_table_privilege('authenticated','public.background_jobs','INSERT') can_insert,
              has_table_privilege('authenticated','public.background_jobs','UPDATE') can_update`,
    );
    expect(queuePrivileges.rows[0]).toEqual({
      can_select: false,
      can_insert: false,
      can_update: false,
    });
    const legacyPrivileges = await db.query<{
      runs_update: boolean;
      jobs_insert: boolean;
      logs_update: boolean;
    }>(
      `select has_table_privilege('authenticated','public.automation_runs','UPDATE') runs_update,
              has_table_privilege('authenticated','public.automation_jobs','INSERT') jobs_insert,
              has_table_privilege('authenticated','public.automation_run_logs','UPDATE') logs_update`,
    );
    expect(legacyPrivileges.rows[0]).toEqual({
      runs_update: false,
      jobs_insert: false,
      logs_update: false,
    });
    await assumeIdentity(db, USER, COMPANY);
    await expect(
      enqueue("e5000000-0000-4000-8000-000000000081"),
    ).rejects.toThrow(/AUTOMATION_JOB_AUTHORITY_REQUIRED/);
    await expect(claim()).rejects.toThrow(/BACKGROUND_WORKER_REQUIRED/);

    await assumeWorker();
    const dispatched = await db.query<{ result: { dispatched: number } }>(
      `select public.dispatch_due_background_schedules_atomic(now(),50) result`,
    );
    expect(dispatched.rows[0].result.dispatched).toBe(0);
    const schedules = await db.query<{ enabled: boolean }>(
      `select enabled from public.background_job_schedules where company_id='${COMPANY}'::uuid`,
    );
    expect(schedules.rows.every((row) => row.enabled === false)).toBe(true);
    const legacy = await db.query<{
      result: { disabled: boolean; reason: string };
    }>(`select public.run_scheduled_automation_rules() result`);
    expect(legacy.rows[0].result).toMatchObject({
      disabled: true,
      reason: "BACKGROUND_SCHEDULE_ACTIVATION_REQUIRED",
    });

    await db.exec(`
      update public.background_job_schedules set enabled=true,next_run_at=now()
      where company_id='${COMPANY}'::uuid and schedule_name='automation:${RULE}';
      insert into public.background_job_schedules(company_id,schedule_name,job_type,payload,interval_minutes,enabled,next_run_at,source_type)
      values('${COMPANY}','poisoned-cleanup','CLEANUP_AI_METADATA','{"unexpected":true}',1440,true,now(),'system_cleanup');
    `);
    const partial = await db.query<{
      result: { dispatched: number; failed_disabled: number };
    }>(
      `select public.dispatch_due_background_schedules_atomic(now(),50) result`,
    );
    expect(partial.rows[0].result).toMatchObject({
      dispatched: 1,
      failed_disabled: 1,
    });
    const poison = await db.query<{
      enabled: boolean;
      last_error_code: string;
    }>(
      `select enabled,last_error_code from public.background_job_schedules where company_id='${COMPANY}'::uuid and schedule_name='poisoned-cleanup'`,
    );
    expect(poison.rows[0]).toEqual({
      enabled: false,
      last_error_code: "SCHEDULE_DISPATCH_FAILED",
    });
    await db.exec(`
      delete from public.background_jobs where company_id='${COMPANY}'::uuid;
      update public.background_job_schedules set enabled=false where company_id='${COMPANY}'::uuid;
    `);
  });

  it("enqueues once with a minimal payload, then claims and completes atomically", async () => {
    await assumeIdentity(db, ADMIN, COMPANY);
    const key = "e5000000-0000-4000-8000-000000000082";
    const first = await enqueue(key);
    const duplicate = await enqueue(key);
    expect(first.rows[0].result).toMatchObject({
      status: "QUEUED",
      duplicate: false,
    });
    expect(duplicate.rows[0].result).toMatchObject({
      job_id: first.rows[0].result.job_id,
      duplicate: true,
    });

    const stored = await db.query<{
      payload: Record<string, unknown>;
      estimated_cost_microusd: number;
    }>(
      `select payload,estimated_cost_microusd from public.background_jobs where id='${first.rows[0].result.job_id}'::uuid`,
    );
    expect(stored.rows[0]).toEqual({
      payload: { rule_id: RULE },
      estimated_cost_microusd: 0,
    });
    expect(JSON.stringify(stored.rows[0].payload)).not.toMatch(
      /password|token|email|phone|amount|content/i,
    );

    await assumeWorker();
    const claimed = await claim();
    expect(claimed.rows[0].result).toHaveLength(1);
    expect(claimed.rows[0].result[0]).toMatchObject({
      id: first.rows[0].result.job_id,
      attempt_count: 1,
    });
    const processed = await db.query<{ result: { status: string } }>(
      `select public.process_background_job_atomic('${first.rows[0].result.job_id}'::uuid,'${WORKER}'::uuid) result`,
    );
    expect(processed.rows[0].result.status).toBe("SUCCEEDED");
    const events = await db.query<{ event_type: string }>(
      `select event_type from public.background_job_events where job_id='${first.rows[0].result.job_id}'::uuid order by id`,
    );
    expect(events.rows.map((row) => row.event_type)).toEqual([
      "ENQUEUED",
      "CLAIMED",
      "SUCCEEDED",
    ]);
  });

  it("allows only one worker claim and supports idempotent queued cancellation with reason", async () => {
    await assumeIdentity(db, ADMIN, COMPANY);
    const queued = await enqueue("e5000000-0000-4000-8000-000000000083");
    const cancelled = await db.query<{
      result: { status: string; changed: boolean };
    }>(`
      select public.cancel_background_job_atomic(
        '${queued.rows[0].result.job_id}'::uuid,'إلغاء لأن القاعدة لم تعد مطلوبة','e5000000-0000-4000-8000-000000000084'::uuid
      ) result
    `);
    expect(cancelled.rows[0].result).toMatchObject({
      status: "CANCELLED",
      changed: true,
    });
    const duplicate = await db.query<{
      result: { event: string; duplicate: boolean };
    }>(`
      select public.cancel_background_job_atomic(
        '${queued.rows[0].result.job_id}'::uuid,'إلغاء لأن القاعدة لم تعد مطلوبة','e5000000-0000-4000-8000-000000000084'::uuid
      ) result
    `);
    expect(duplicate.rows[0].result).toMatchObject({
      event: "CANCELLED",
      duplicate: true,
    });
    const row = await db.query<{ cancellation_reason: string }>(
      `select cancellation_reason from public.background_jobs where id='${queued.rows[0].result.job_id}'::uuid`,
    );
    expect(row.rows[0].cancellation_reason).toBe(
      "إلغاء لأن القاعدة لم تعد مطلوبة",
    );

    const claimable = await enqueue("e5000000-0000-4000-8000-000000000085");
    await assumeWorker();
    const [one, two] = await Promise.all([
      claim(WORKER),
      claim("e5000000-0000-4000-8000-000000000098"),
    ]);
    expect(one.rows[0].result.length + two.rows[0].result.length).toBe(1);
    expect([...one.rows[0].result, ...two.rows[0].result][0].id).toBe(
      claimable.rows[0].result.job_id,
    );
  });

  it("retries a transient failure with bounded backoff and dead-letters after three attempts", async () => {
    await assumeIdentity(db, ADMIN, COMPANY);
    const queued = await enqueue("e5000000-0000-4000-8000-000000000086");
    await db.exec(
      `update public.automation_rules set deleted_at=now() where id='${RULE}'`,
    );

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await assumeWorker();
      await db.exec(
        `update public.background_jobs set available_at=now() where id='${queued.rows[0].result.job_id}'::uuid`,
      );
      const claimed = await claim();
      expect(claimed.rows[0].result[0].attempt_count).toBe(attempt);
      const processed = await db.query<{
        result: { status: string; retry_after_seconds?: number };
      }>(
        `select public.process_background_job_atomic('${queued.rows[0].result.job_id}'::uuid,'${WORKER}'::uuid) result`,
      );
      if (attempt < 3) {
        expect(processed.rows[0].result.status).toBe("RETRY_WAIT");
        expect(processed.rows[0].result.retry_after_seconds).toBe(
          attempt === 1 ? 60 : 300,
        );
      } else {
        expect(processed.rows[0].result.status).toBe("DEAD");
      }
    }
    const final = await db.query<{
      status: string;
      attempt_count: number;
      last_error_code: string;
    }>(
      `select status,attempt_count,last_error_code from public.background_jobs where id='${queued.rows[0].result.job_id}'::uuid`,
    );
    expect(final.rows[0]).toEqual({
      status: "DEAD",
      attempt_count: 3,
      last_error_code: "PERMANENT_JOB_FAILURE",
    });
  });

  it("keeps event history immutable to authenticated callers", async () => {
    await assumeIdentity(db, ADMIN, COMPANY);
    await expect(
      db.query(
        `update public.background_job_events set code='tampered' where company_id='${COMPANY}'::uuid`,
      ),
    ).rejects.toThrow(/BACKGROUND_JOB_EVENT_IMMUTABLE/);
  });
});
