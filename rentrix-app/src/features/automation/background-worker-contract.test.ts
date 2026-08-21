import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const worker = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../../supabase/functions/background-worker/index.ts",
  ),
  "utf8",
);
const migration = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../../supabase/migrations/20260901000006_background_job_foundation.sql",
  ),
  "utf8",
);
const supabaseConfig = readFileSync(
  resolve(import.meta.dirname, "../../../../supabase/config.toml"),
  "utf8",
);

describe("background worker boundary contract", () => {
  it("requires a dedicated invocation secret and keeps service credentials server-side", () => {
    expect(worker).toContain("BACKGROUND_WORKER_SECRET");
    expect(worker).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(worker).toContain("constantTimeEqual");
    expect(worker).not.toContain("VITE_");
    expect(supabaseConfig).toContain("[functions.background-worker]");
    expect(supabaseConfig).toContain("verify_jwt = false");
    expect(worker).not.toMatch(
      /console\.(log|error)\([^)]*(serviceRoleKey|workerSecret|supplied)/,
    );
  });

  it("accepts no client-selected company, job type, payload or job id", () => {
    expect(worker).not.toContain("request.json()");
    expect(worker).toContain("MAX_COMPANIES_PER_INVOCATION = 5");
    expect(worker).toContain("MAX_JOBS_PER_INVOCATION = 3");
    expect(worker).toContain("list_background_job_companies_atomic");
    expect(worker).toContain("claim_background_jobs_atomic");
    expect(worker).toContain("process_background_job_atomic");
  });

  it("does not install or enable a production schedule", () => {
    expect(migration).not.toContain("cron.schedule(");
    expect(migration).toContain("false,now(),'automation_rule'");
    expect(migration).toContain("'BACKGROUND_SCHEDULE_ACTIVATION_REQUIRED'");
    expect(migration).toContain("cron.unschedule('rentrix-automation-hourly')");
  });

  it("pins bounded claim, timeout, retry, dead-letter, cancellation and retention controls", () => {
    expect(migration).toContain("p_limit not between 1 and 5");
    expect(migration).toContain("interval '5 minutes'");
    expect(migration).toContain("set_config('statement_timeout','45s',true)");
    expect(migration).toContain("when 1 then 60 when 2 then 300 else 1800");
    expect(migration).toContain("status='DEAD'");
    expect(migration).toContain("cancellation_requested=true");
    expect(migration).toContain("finished_at<now()-interval '30 days'");
    expect(migration).toContain("finished_at<now()-interval '90 days'");
  });
});
