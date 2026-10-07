/**
 * WP-06 — hermetic backend FAIL-CLOSED contract (behavioural, not source-scan).
 *
 * `documentAcceptanceHarness.test.ts` asserts the harness *source* says the
 * right things. This file proves the harness actually BEHAVES that way by
 * driving `installFakeSupabaseBackend` through a minimal fake Playwright
 * `Page`/`Route` and inspecting the real HTTP responses it produces.
 *
 * The rule under test is the one that matters most for truthfulness:
 *
 *   An unseeded table must NEVER answer `200 []`.
 *
 * A `200 []` is indistinguishable from a truthful "no rows" state, so a
 * screen reading a table nobody seeded would render a confident, EMPTY,
 * WRONG UI — and the acceptance suite would pass while proving nothing.
 * PostgREST answers an unknown relation with 404/PGRST205; the harness must
 * do the same so a missing seed fails visibly.
 */
import { describe, expect, it, vi } from 'vitest';
import { installFakeSupabaseBackend } from '../../../e2e/support/fake-supabase-backend';

type FulfillArgs = { status: number; contentType?: string; headers?: Record<string, string>; body: string };

type CapturedResponse = {
  status: number;
  body: unknown;
  rawBody: string;
  headers: Record<string, string>;
};

/**
 * Minimal stand-in for Playwright's `Page`, capturing the route handlers the
 * harness registers so this test can dispatch requests at them directly.
 */
function createRoutingHarness() {
  const handlers: Array<{ pattern: string; handler: (route: unknown) => unknown }> = [];

  const page = {
    route: (pattern: string, handler: (route: unknown) => unknown) => {
      handlers.push({ pattern, handler });
      return Promise.resolve();
    },
  } as unknown as Parameters<typeof installFakeSupabaseBackend>[0];

  /** Glob-ish match mirroring Playwright's `**` semantics closely enough. */
  const matches = (pattern: string, url: string): boolean => {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const expression = escaped.replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
    return new RegExp(`^${expression}$`).test(url);
  };

  async function request(url: string, method = 'GET', postData: string | null = null): Promise<CapturedResponse> {
    // Later routes are registered first-wins in Playwright; the harness
    // registers the RPC pattern before the generic table pattern.
    const entry = handlers.find((candidate) => matches(candidate.pattern, url));
    if (!entry) throw new Error(`no harness route matched ${url}`);

    let captured: FulfillArgs | undefined;
    const route = {
      request: () => ({
        url: () => url,
        method: () => method,
        postData: () => postData,
        headerValue: async () => null,
      }),
      fulfill: async (args: FulfillArgs) => {
        captured = args;
      },
    };

    await entry.handler(route);
    if (!captured) throw new Error(`harness did not fulfill ${url}`);

    let parsed: unknown = undefined;
    try {
      parsed = JSON.parse(captured.body);
    } catch {
      parsed = captured.body;
    }
    return { status: captured.status, body: parsed, rawBody: captured.body, headers: captured.headers ?? {} };
  }

  return { page, request };
}

const BASE = 'https://invalid.supabase.local';

async function backend() {
  const harness = createRoutingHarness();
  // Silence the intentional diagnostic warnings this suite triggers.
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  await installFakeSupabaseBackend(harness.page, 'complete');
  return { ...harness, warn };
}

describe('unseeded table reads fail closed', () => {
  it('returns a PostgREST-shaped 404/PGRST205, never 200 []', async () => {
    const { request, warn } = await backend();

    const response = await request(`${BASE}/rest/v1/definitely_not_seeded?select=*`);

    expect(response.status).toBe(404);
    expect(response.status).not.toBe(200);
    expect(response.body).toMatchObject({ code: 'PGRST205' });
    warn.mockRestore();
  });

  it('the failure cannot be mistaken for a truthful empty state', async () => {
    const { request, warn } = await backend();
    const response = await request(`${BASE}/rest/v1/ghost_table?select=*`);

    // The three ways a caller could accidentally read this as "no rows":
    expect(response.status).toBeGreaterThanOrEqual(400); // not 2xx
    expect(Array.isArray(response.body)).toBe(false); // not a list
    expect(response.rawBody).not.toBe('[]'); // not an empty payload

    // A supabase-js style consumer must see an error, not empty data.
    const asPostgrest = response.status >= 400
      ? { data: null, error: response.body as Record<string, unknown> }
      : { data: response.body, error: null };
    expect(asPostgrest.data).toBeNull();
    expect(asPostgrest.error).not.toBeNull();
    expect((asPostgrest.error as { code?: string }).code).toBe('PGRST205');
    warn.mockRestore();
  });

  it('does not leak the table name into the HTTP response body', async () => {
    const { request, warn } = await backend();
    const response = await request(`${BASE}/rest/v1/secret_internal_ledger?select=*`);

    expect(response.rawBody).not.toContain('secret_internal_ledger');
    // …but it IS reported to harness diagnostics so the gap is fixable.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('secret_internal_ledger'));
    warn.mockRestore();
  });

  it('reports the unseeded table exactly once per read, as a warning', async () => {
    const { request, warn } = await backend();
    await request(`${BASE}/rest/v1/another_missing_table?select=*`);
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.filter((message) => message.includes('another_missing_table'))).toHaveLength(1);
    expect(messages[0]).toContain('UNSEEDED TABLE');
    warn.mockRestore();
  });
});

describe('explicitly seeded tables still behave normally', () => {
  it('an explicitly seeded EMPTY table returns a truthful 200 []', async () => {
    const { request, warn } = await backend();

    // `app_notifications` is seeded as [] on purpose: the app really does
    // read it and genuinely has no rows in this scenario.
    const response = await request(`${BASE}/rest/v1/app_notifications?select=*`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    // A deliberate empty seed must NOT be reported as unseeded.
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('app_notifications'));
    warn.mockRestore();
  });

  it('a seeded table with rows returns its rows', async () => {
    const { request, warn } = await backend();
    const response = await request(`${BASE}/rest/v1/company_settings?select=*`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect((response.body as unknown[]).length).toBeGreaterThan(0);
    warn.mockRestore();
  });

  it('every table the document suites visit is seeded (no fail-closed surprises)', async () => {
    const { request, warn } = await backend();
    const visited = [
      'companies',
      'company_members',
      'company_settings',
      'people',
      'properties',
      'units',
      'contracts',
      'invoices',
      'app_notifications',
      'cost_centers',
      'expenses',
      'maintenance_records',
      'owner_agreements',
      'receipt_allocations',
      'user_permission_grants',
      'vault_documents',
    ];

    for (const table of visited) {
      const response = await request(`${BASE}/rest/v1/${table}?select=*`);
      expect(response.status, `${table} must be explicitly seeded`).toBe(200);
    }
    warn.mockRestore();
  });
});

describe('unknown RPCs and writes stay fail-closed too', () => {
  it('an unseeded RPC returns 404/PGRST202, never a permissive success', async () => {
    const { request, warn } = await backend();
    const response = await request(`${BASE}/rest/v1/rpc/rpt_not_seeded_at_all`, 'POST', '{}');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'PGRST202' });
    expect(response.rawBody).not.toBe('{}');
    warn.mockRestore();
  });

  it('a seeded set-returning RPC returns its real array contract', async () => {
    const { request, warn } = await backend();
    const response = await request(`${BASE}/rest/v1/rpc/list_permission_requests_for_review`, 'POST', '{}');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    warn.mockRestore();
  });

  it('writes are refused on every table, seeded or not', async () => {
    const { request, warn } = await backend();
    for (const method of ['POST', 'PATCH', 'DELETE', 'PUT']) {
      const response = await request(`${BASE}/rest/v1/invoices`, method, '{}');
      expect(response.status, `${method} must be refused`).toBe(405);
    }
    warn.mockRestore();
  });

  it('storage is not broadly permitted', async () => {
    const { request, warn } = await backend();
    const response = await request(`${BASE}/storage/v1/object/list/documents`, 'GET');
    expect(response.status).toBe(404);
    warn.mockRestore();
  });
});
