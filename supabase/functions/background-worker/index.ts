type JsonObject = Record<string, unknown>;

const MAX_COMPANIES_PER_INVOCATION = 5;
const MAX_JOBS_PER_INVOCATION = 3;
const RPC_TIMEOUT_MS = 50_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1)
    mismatch |=
      (a[index % Math.max(1, a.length)] ?? 0) ^
      (b[index % Math.max(1, b.length)] ?? 0);
  return mismatch === 0;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function rpc(
  supabaseUrl: string,
  serviceRoleKey: string,
  name: string,
  payload: JsonObject,
): Promise<unknown> {
  const response = await fetchWithTimeout(
    `${supabaseUrl}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    RPC_TIMEOUT_MS,
  );
  if (!response.ok) throw new Error(`RPC_${name}_FAILED_${response.status}`);
  return (await response.json().catch(() => null)) as unknown;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST")
    return json({ error: { code: "METHOD_NOT_ALLOWED" } }, 405);

  const workerSecret = Deno.env.get("BACKGROUND_WORKER_SECRET")?.trim() ?? "";
  const supplied =
    request.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ?? "";
  if (workerSecret.length < 32 || !constantTimeEqual(supplied, workerSecret)) {
    return json({ error: { code: "WORKER_AUTH_REQUIRED" } }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!supabaseUrl || !serviceRoleKey)
    return json({ error: { code: "WORKER_CONFIG_MISSING" } }, 503);

  const invocationId = crypto.randomUUID();
  try {
    const dispatch = await rpc(
      supabaseUrl,
      serviceRoleKey,
      "dispatch_due_background_schedules_atomic",
      {
        p_now: new Date().toISOString(),
        p_limit: 50,
      },
    );
    const companiesValue = await rpc(
      supabaseUrl,
      serviceRoleKey,
      "list_background_job_companies_atomic",
      {
        p_limit: MAX_COMPANIES_PER_INVOCATION,
      },
    );
    const companies = Array.isArray(companiesValue)
      ? companiesValue
          .filter((value): value is string => typeof value === "string")
          .slice(0, MAX_COMPANIES_PER_INVOCATION)
      : [];

    const claimed: Array<{ id: string; companyId: string }> = [];
    for (const companyId of companies) {
      if (claimed.length >= MAX_JOBS_PER_INVOCATION) break;
      const jobsValue = await rpc(
        supabaseUrl,
        serviceRoleKey,
        "claim_background_jobs_atomic",
        {
          p_company_id: companyId,
          p_worker_id: invocationId,
          p_limit: 1,
        },
      );
      if (!Array.isArray(jobsValue)) continue;
      for (const value of jobsValue) {
        if (
          claimed.length >= MAX_JOBS_PER_INVOCATION ||
          !isRecord(value) ||
          typeof value.id !== "string"
        )
          break;
        claimed.push({ id: value.id, companyId });
      }
    }

    const outcomes = await Promise.allSettled(
      claimed.map((job) =>
        rpc(supabaseUrl, serviceRoleKey, "process_background_job_atomic", {
          p_job_id: job.id,
          p_worker_id: invocationId,
        }),
      ),
    );
    const completed = outcomes.filter(
      (outcome) => outcome.status === "fulfilled",
    ).length;
    const failedRequests = outcomes.length - completed;

    console.log("Background worker invocation completed", {
      invocationId,
      companies: companies.length,
      claimed: claimed.length,
      completed,
      failedRequests,
    });
    return json({
      invocationId,
      dispatch,
      companies: companies.length,
      claimed: claimed.length,
      completed,
      failedRequests,
    });
  } catch (error) {
    console.error("Background worker invocation failed", {
      invocationId,
      failureClass:
        error instanceof DOMException && error.name === "AbortError"
          ? "TIMEOUT"
          : "CONTROL_PLANE",
    });
    return json(
      { error: { code: "BACKGROUND_WORKER_FAILED" }, invocationId },
      503,
    );
  }
});
