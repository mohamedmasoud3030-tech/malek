/**
 * employee-invite-accept — account-creating acceptance for employee invites.
 *
 * A brand-new employee has no session, so acceptance runs here with the
 * service role under the same governed boundary as the in-app path:
 *
 *   1. The 64-char raw token is hashed (SHA-256) and looked up through
 *      public.lookup_employee_invite_for_signup (service-role only).
 *   2. A PENDING invite leads to Auth account creation (admin API,
 *      e-mail pre-confirmed — no rate-limited invitation e-mail).
 *   3. public.finalize_employee_invite_signup binds the account's e-mail to
 *      the invite and applies the governed acceptance (single-use,
 *      one-company, never-demote) through
 *      app_private.apply_employee_invite_acceptance.
 *   4. If finalization fails after account creation, the orphan account is
 *      deleted again so a retry starts clean.
 *
 * Existing accounts sign in and accept through public.accept_employee_invite
 * instead; this function refuses e-mails that are already registered.
 */

type JsonObject = Record<string, unknown>;

const RPC_TIMEOUT_MS = 30_000;

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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function serviceHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function rpc(
  supabaseUrl: string,
  serviceRoleKey: string,
  name: string,
  payload: JsonObject,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetchWithTimeout(
    `${supabaseUrl}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers: serviceHeaders(serviceRoleKey),
      body: JSON.stringify(payload),
    },
    RPC_TIMEOUT_MS,
  );
  return {
    ok: response.ok,
    status: response.status,
    body: (await response.json().catch(() => null)) as unknown,
  };
}

function errorCodeOf(body: unknown): string {
  if (isRecord(body) && typeof body.message === "string") return body.message;
  if (typeof body === "string") return body;
  return "";
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST")
    return json({ error: { code: "METHOD_NOT_ALLOWED" } }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!supabaseUrl || !serviceRoleKey)
    return json({ error: { code: "CONFIG_MISSING" } }, 503);

  let payload: JsonObject;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) throw new Error("not an object");
    payload = parsed;
  } catch {
    return json({ error: { code: "BODY_INVALID" } }, 400);
  }

  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  const fullName =
    typeof payload.full_name === "string" ? payload.full_name.trim() : "";
  const password =
    typeof payload.password === "string" ? payload.password : "";
  if (!/^[0-9a-f]{64}$/.test(token))
    return json({ error: { code: "TOKEN_INVALID" } }, 400);
  if (fullName.length < 2 || fullName.length > 120)
    return json({ error: { code: "FULL_NAME_INVALID" } }, 400);
  if (password.length < 8 || password.length > 128)
    return json({ error: { code: "PASSWORD_INVALID" } }, 400);

  // 1. Look up the invite (service-only RPC; unknown token → empty).
  const lookup = await rpc(supabaseUrl, serviceRoleKey,
    "lookup_employee_invite_for_signup", { p_token: token });
  if (!lookup.ok)
    return json({ error: { code: "LOOKUP_FAILED" } }, 502);
  const invites = Array.isArray(lookup.body) ? lookup.body : [];
  const invite = invites[0];
  if (!isRecord(invite))
    return json({ error: { code: "INVITE_NOT_FOUND" } }, 404);
  if (invite.invite_status !== "PENDING") {
    return json({
      error: { code: `INVITE_${String(invite.invite_status)}` },
    }, 409);
  }
  const email = String(invite.email ?? "");

  // 2. Refuse already-registered e-mails: those accounts sign in and accept
  //    through the in-app path instead.
  const existing = await fetchWithTimeout(
    `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(email)}`,
    { method: "GET", headers: serviceHeaders(serviceRoleKey) },
    RPC_TIMEOUT_MS,
  );
  if (existing.ok) {
    const listed: unknown = await existing.json().catch(() => null);
    const users = isRecord(listed) && Array.isArray(listed.users)
      ? listed.users
      : [];
    const clash = users.find(
      (candidate) =>
        isRecord(candidate) &&
        typeof candidate.email === "string" &&
        candidate.email.toLowerCase() === email.toLowerCase(),
    );
    if (clash)
      return json({ error: { code: "EMAIL_ALREADY_REGISTERED" } }, 409);
  }

  // 3. Create the account (e-mail pre-confirmed; no invitation e-mail).
  const created = await fetchWithTimeout(
    `${supabaseUrl}/auth/v1/admin/users`,
    {
      method: "POST",
      headers: serviceHeaders(serviceRoleKey),
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      }),
    },
    RPC_TIMEOUT_MS,
  );
  if (!created.ok) {
    const body: unknown = await created.json().catch(() => null);
    const message = errorCodeOf(body);
    const code = /already|exists|registered/i.test(message)
      ? "EMAIL_ALREADY_REGISTERED"
      : "ACCOUNT_CREATE_FAILED";
    return json({ error: { code } }, code === "EMAIL_ALREADY_REGISTERED" ? 409 : 502);
  }
  const createdUser: unknown = await created.json().catch(() => null);
  const userId =
    isRecord(createdUser) && typeof createdUser.id === "string"
      ? createdUser.id
      : "";
  if (!userId)
    return json({ error: { code: "ACCOUNT_CREATE_FAILED" } }, 502);

  // 4. Apply the governed acceptance; on failure remove the orphan account.
  const finalize = await rpc(supabaseUrl, serviceRoleKey,
    "finalize_employee_invite_signup", {
      p_token: token,
      p_user_id: userId,
      p_full_name: fullName,
    });
  if (!finalize.ok) {
    await fetchWithTimeout(
      `${supabaseUrl}/auth/v1/admin/users/${userId}`,
      { method: "DELETE", headers: serviceHeaders(serviceRoleKey) },
      RPC_TIMEOUT_MS,
    ).catch(() => undefined);
    const code = errorCodeOf(finalize.body);
    const known =
      /EMPLOYEE_INVITE_(REVOKED|EXPIRED|ALREADY_USED|EMAIL_MISMATCH|USER_ASSIGNED_ELSEWHERE|EMAIL_CONFLICT)/
        .exec(code);
    return json(
      { error: { code: known?.[1] ? `INVITE_${known[1]}` : "FINALIZE_FAILED" } },
      known ? 409 : 502,
    );
  }

  return json({ data: { company_id: finalize.body, email } }, 200);
});
