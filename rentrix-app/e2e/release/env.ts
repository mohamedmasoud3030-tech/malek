/**
 * Strict environment loading for the REAL-BACKEND release suites.
 *
 * These suites are the only place in the repository where a browser talks to a
 * real Supabase project. That makes a silently skipped run worse than a failing
 * one: a green tick with no traffic would be fake release evidence. Every
 * accessor below therefore THROWS on a missing value instead of skipping.
 *
 * The deterministic hermetic suites under `e2e/*.spec.ts` are unaffected and
 * stay the fast UI regression layer (see playwright.config.ts, which ignores
 * `e2e/release/**`).
 */
import { expect } from '@playwright/test';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required for the real-backend release suites. `
      + 'These suites must fail, never skip, when a real environment is unavailable.',
    );
  }
  return value;
}

/** Real Supabase endpoint — must be a live https origin, never a placeholder. */
export function supabaseUrl(): string {
  const raw = required('VITE_SUPABASE_URL');
  const parsed = new URL(raw);
  if (parsed.protocol !== 'https:') throw new Error('VITE_SUPABASE_URL must use HTTPS for real-backend verification.');
  if (/\.invalid|example\.supabase\.co|invalid\.supabase\.local/.test(parsed.hostname)) {
    throw new Error(`VITE_SUPABASE_URL points at a placeholder host (${parsed.hostname}); real-backend suites must not run against a stub.`);
  }
  return parsed.origin;
}

export function supabaseAnonKey(): string {
  return required('VITE_SUPABASE_ANON_KEY');
}

export function testEmail(): string {
  return required('E2E_TEST_EMAIL');
}

export function testPassword(): string {
  return required('E2E_TEST_PASSWORD');
}

export function environmentKind(): 'qa' | 'production-readonly' {
  const kind = required('E2E_ENVIRONMENT_KIND');
  if (kind !== 'qa' && kind !== 'production-readonly') {
    throw new Error(`E2E_ENVIRONMENT_KIND must be "qa" or "production-readonly", got "${kind}".`);
  }
  return kind;
}

/** Mutating journeys are only ever authorised against a disposable environment. */
export function assertIsolatedEnvironment(): void {
  const kind = environmentKind();
  if (kind !== 'qa') {
    throw new Error(
      `This suite mutates data and is restricted to E2E_ENVIRONMENT_KIND=qa; refusing to run against "${kind}". `
      + 'Production verification is read-only by policy — see production-smoke.spec.ts.',
    );
  }
}

/**
 * Signs in through the real Supabase Auth endpoint and returns the session
 * token. Uses the public anon key exactly as the browser client does.
 */
export async function signInAndGetAccessToken(): Promise<string> {
  const response = await fetch(`${supabaseUrl()}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: testEmail(), password: testPassword() }),
  });

  if (!response.ok) {
    throw new Error(`Supabase Auth rejected the release-test identity (HTTP ${response.status}). Credentials remain redacted.`);
  }

  const payload = await response.json() as { access_token?: unknown };
  const token = typeof payload.access_token === 'string' ? payload.access_token : '';
  if (!token) throw new Error('Supabase Auth returned no access_token.');
  return token;
}

/** Authenticated PostgREST call that sends the reviewed `Accept-Profile`. */
export async function rest<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: T | null }> {
  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseAnonKey(),
      Authorization: `Bearer ${token}`,
      'Accept-Profile': 'public',
      'Content-Profile': 'public',
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  return { status: response.status, body: body as T | null };
}

/** RPC call against the real database (the same path the UI uses). */
export async function rpc<T>(
  token: string,
  name: string,
  payload: Record<string, unknown>,
): Promise<{ status: number; body: T | null }> {
  return rest<T>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) });
}

export function expectRealBackend(): void {
  // Touch every required value up front so a misconfigured run fails at
  // collection time with one clear message instead of mid-journey.
  expect(environmentKind()).toBeTruthy();
  expect(supabaseUrl()).toBeTruthy();
  expect(supabaseAnonKey()).toBeTruthy();
  expect(testEmail()).toBeTruthy();
  expect(testPassword()).toBeTruthy();
}
