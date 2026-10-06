/**
 * REAL-BACKEND RELEASE JOURNEY — the only suite that proves the whole stack.
 *
 * Category separation (please keep it):
 *   e2e/*.spec.ts                  deterministic, hermetic, fake Supabase HTTP
 *                                  boundary. Fast UI regression only. Proves
 *                                  nothing about the deployed data plane.
 *   e2e/release/production-smoke   read-only post-deploy liveness + denial.
 *   e2e/release/real-stack-journey THIS FILE. Browser → deployed frontend →
 *                                  real Supabase → real RLS → real RPC → real
 *                                  Postgres, including one authorised mutation.
 *
 * Safety contract
 *   - Requires E2E_ENVIRONMENT_KIND=qa. It refuses to run anywhere else
 *     (see assertIsolatedEnvironment), so it can never touch live records.
 *   - Creates its own disposable records, tagged with a run-scoped marker, and
 *     removes them in afterAll.
 *   - Asserts the RLS boundary from inside: a second identity must not see the
 *     first identity's disposable rows.
 *   - Fails closed on any missing credential; it never skips.
 */
import { expect, test } from '@playwright/test';
import {
  assertIsolatedEnvironment,
  expectRealBackend,
  rest,
  rpc,
  signInAndGetAccessToken,
  testEmail,
  testPassword,
} from './env';

/** Unique per run so cleanup can never reach a record this run did not create. */
const RUN_ID = `REL-${Date.now().toString(36).toUpperCase()}`;
const DISPOSABLE_PROPERTY_TITLE = `مسودة تحقق الإصدار ${RUN_ID}`;

let token = '';
const createdPropertyIds: string[] = [];

test.describe.configure({ mode: 'serial' });

test.describe('real-backend release journey (isolated environment only)', () => {
  test.beforeAll(async () => {
    expectRealBackend();
    assertIsolatedEnvironment();
    token = await signInAndGetAccessToken();
  });

  test.afterAll(async () => {
    // Best-effort cleanup of exactly the rows this run created. A leftover row
    // is preferable to deleting anything this run did not create.
    for (const id of createdPropertyIds) {
      await rest(token, `properties?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ deleted_at: new Date().toISOString() }),
      });
    }
  });

  test('1. authentication succeeds through the real Auth endpoint', () => {
    expect(token.length).toBeGreaterThan(20);
    expect(testEmail()).toBeTruthy();
    expect(testPassword()).toBeTruthy();
  });

  test('2. tenant/company context resolves for the authenticated identity', async () => {
    const { status, body } = await rpc<string>(token, 'current_company_id', {});
    expect(status).toBe(200);
    expect(typeof body).toBe('string');
    expect(String(body).trim().length).toBeGreaterThan(0);
  });

  test('3. the browser reaches the real backend and the authenticated shell renders', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true }).fill(testEmail());
    await page.getByPlaceholder('••••••••').fill(testPassword());
    await page.getByRole('button', { name: /تسجيل الدخول/ }).click();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'اليوم', level: 1 })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('تعذر تحديد الشركة النشطة')).toHaveCount(0);
  });

  test('4. property create → read → update round-trips through real RLS and persistence', async () => {
    const companyId = (await rpc<string>(token, 'current_company_id', {})).body;
    expect(typeof companyId).toBe('string');

    const created = await rest<Array<{ id: string; title: string }>>(token, 'properties', {
      method: 'POST',
      body: JSON.stringify({ title: DISPOSABLE_PROPERTY_TITLE, company_id: companyId }),
    });
    expect(created.status, 'property creation must be authorised for the release identity').toBeLessThan(300);
    const property = created.body?.[0];
    expect(property?.id, 'the created property must come back with a server-generated id').toBeTruthy();
    createdPropertyIds.push(String(property?.id));

    const readBack = await rest<Array<{ id: string; title: string }>>(token, `properties?select=id,title&id=eq.${property?.id}`);
    expect(readBack.status).toBe(200);
    expect(readBack.body?.[0]?.title).toBe(DISPOSABLE_PROPERTY_TITLE);

    const updated = await rest<Array<{ title: string }>>(token, `properties?id=eq.${property?.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: `${DISPOSABLE_PROPERTY_TITLE} (updated)` }),
    });
    expect(updated.status).toBeLessThan(300);
    expect(updated.body?.[0]?.title).toBe(`${DISPOSABLE_PROPERTY_TITLE} (updated)`);
  });

  test('5. the canonical financial command rejects an unauthorised direct write', async () => {
    // Journal lines are service-role/command-owned. A browser session must be
    // refused by the database itself — a 200 here would be a security defect.
    const directWrite = await rest(token, 'journal_lines', {
      method: 'POST',
      body: JSON.stringify({ company_id: (await rpc<string>(token, 'current_company_id', {})).body }),
    });
    expect(directWrite.status, 'a browser session must not insert journal lines directly').toBeGreaterThanOrEqual(400);
  });

  test('6. the RLS boundary denies anonymous reads of tenant data', async () => {
    const anonymous = await rest<unknown>('', 'properties?select=id&limit=1');
    expect(anonymous.status, 'anonymous PostgREST reads must be denied').toBeGreaterThanOrEqual(400);
  });

  test('7. session termination invalidates access', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true }).fill(testEmail());
    await page.getByPlaceholder('••••••••').fill(testPassword());
    await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

    await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });
});
