/**
 * PRODUCTION SMOKE — minimal, read-only, post-deployment verification.
 *
 * This is NOT the end-to-end suite and must never be presented as one. Its only
 * job is to answer, after a deploy: "is the thing we shipped alive, reachable,
 * authenticated, tenant-scoped, and still refusing what it must refuse?"
 *
 * It deliberately performs NO mutation. The repository's standing policy
 * (`scripts/assert-release-blocker-env.mjs`) confines every write rehearsal to
 * an isolated environment; the mutation half of the journey lives in
 * `real-stack-journey.spec.ts` and runs only with E2E_ENVIRONMENT_KIND=qa.
 * Weakening that split to make this file "more end-to-end" would be a security
 * regression, not an improvement.
 *
 * Fails closed: any missing credential or unreachable dependency is a failure.
 */
import { expect, test } from '@playwright/test';
import {
  environmentKind,
  expectRealBackend,
  rest,
  signInAndGetAccessToken,
  supabaseUrl,
} from './env';

test.describe('production smoke — read-only deployment verification', () => {
  test.beforeAll(() => {
    expectRealBackend();
    // Guard against an operator pointing this file at a writable environment.
    expect(environmentKind()).toBe('production-readonly');
  });

  test('1. the deployed application loads and serves the unauthenticated entry point', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status(), 'the root document must return 200').toBe(200);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /تسجيل الدخول/ })).toBeVisible();
  });

  test('2. the deployment identity endpoint answers with a stamped revision', async ({ page }) => {
    const proof = await page.request.get('/build-proof.json');
    expect(proof.status()).toBe(200);
    const payload = await proof.json() as { sha?: string };
    expect(payload.sha, 'a deployment must stamp its Git revision').toMatch(/^[0-9a-f]{40}$/);
  });

  test('3. authentication works against the real Supabase project', async () => {
    const token = await signInAndGetAccessToken();
    expect(token.length).toBeGreaterThan(20);
  });

  test('4. the authenticated tenant context resolves to a company', async () => {
    const token = await signInAndGetAccessToken();
    const { status, body } = await rest<string>(token, 'rpc/current_company_id', { method: 'POST', body: '{}' });
    expect(status, 'current_company_id must be callable by the verified identity').toBe(200);
    expect(typeof body, 'the tenant context must resolve to a company id').toBe('string');
    expect(String(body).trim().length).toBeGreaterThan(0);
  });

  test('5. a critical read path returns company-scoped data over the real RLS boundary', async () => {
    const token = await signInAndGetAccessToken();
    const { status, body } = await rest<Array<{ id: string }>>(token, 'companies?select=id&limit=1');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body?.length, 'the verified identity must see its own company').toBeGreaterThan(0);
  });

  test('6. unauthorized access remains denied', async () => {
    // Anonymous access to tenant data must be refused by the database, not by
    // the UI. Probe the data plane directly with no Authorization header.
    const anonymous = await fetch(`${supabaseUrl()}/rest/v1/companies?select=id&limit=1`, {
      headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY ?? '', 'Accept-Profile': 'public' },
    });
    expect(anonymous.ok, 'anon must not read companies').toBe(false);

    // A garbage bearer token must also be refused.
    const forged = await fetch(`${supabaseUrl()}/rest/v1/companies?select=id&limit=1`, {
      headers: {
        apikey: process.env.VITE_SUPABASE_ANON_KEY ?? '',
        Authorization: 'Bearer not-a-real-token',
        'Accept-Profile': 'public',
      },
    });
    expect(forged.ok, 'a forged bearer token must not read companies').toBe(false);
  });

  test('7. the public legal surfaces deploy alongside the application', async ({ page }) => {
    for (const path of ['/privacy', '/terms']) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} must be served`).toBe(200);
    }
  });
});
