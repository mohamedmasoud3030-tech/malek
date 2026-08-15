import { expect, test, type Page } from '@playwright/test';

test.setTimeout(120_000);

function encodeJwtPart(value: unknown) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }

function sessionPayload() {
  const companyId = '00000000-0000-4000-8000-000000000101';
  const userId = '00000000-0000-4000-8000-000000000201';
  const nowIso = '2026-08-05T08:00:00.000Z';
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const app_metadata = { user_role: 'ADMIN', role: 'ADMIN', company_id: companyId };
  const accessToken = `${encodeJwtPart({ alg: 'HS256', typ: 'JWT' })}.${encodeJwtPart({ sub: userId, role: 'authenticated', email: 'login@malek.test', app_metadata, exp: expiresAt })}.e2e-signature`;
  return {
    access_token: accessToken, refresh_token: 'e2e-refresh-token', token_type: 'bearer',
    expires_in: 3600, expires_at: expiresAt,
    user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'login@malek.test', app_metadata, user_metadata: {}, created_at: nowIso, updated_at: nowIso },
    companyId, userId, nowIso,
  };
}

const companySettings = {
  id: '00000000-0000-4000-8000-000000000301', singleton_key: true, company_name: 'MALEK',
  legal_name: null, tax_number: null, registration_number: null, phone: null, email: null,
  address: null, city: null, country: 'OM', currency: 'OMR', locale: 'ar-OM', timezone: 'Asia/Muscat',
  date_format: 'dd/MM/yyyy', number_format: 'ar-OM', logo_url: null, invoice_prefix: 'INV',
  contract_prefix: 'CON', receipt_prefix: 'REC', default_vat_rate: 0, vat_enabled: false, vat_rate: 5,
  vat_registration_number: null, notification_email_enabled: true, notification_sms_enabled: false,
  created_at: '2026-08-05T08:00:00.000Z', updated_at: '2026-08-05T08:00:00.000Z',
};

async function installAuthHarness(page: Page) {
  // Stub ONLY the auth token endpoint (login POST) + session restore; everything
  // else resolves as empty so the app shell mounts. This proves the login flow
  // (signInWithPassword → session → navigate /dashboard → app shell) is healthy
  // when Supabase is reachable.
  await page.unroute('**/*').catch(() => undefined);
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isSupabase = url.hostname.includes('supabase');
    if (!isSupabase && url.hostname !== 'invalid.supabase.local') { await route.continue(); return; }
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); return; }
    if (url.pathname.includes('/auth/v1/token')) {
      // signInWithPassword POST → return a session
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(sessionPayload()) });
      return;
    }
    if (url.pathname.includes('/auth/v1/user')) {
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ id: '00000000-0000-4000-8000-000000000201', aud: 'authenticated', role: 'authenticated', email: 'login@malek.test', app_metadata: { user_role: 'ADMIN', role: 'ADMIN', company_id: '00000000-0000-4000-8000-000000000101' }, user_metadata: {}, created_at: '2026-08-05T08:00:00.000Z', updated_at: '2026-08-05T08:00:00.000Z' }) });
      return;
    }
    const tableMatch = url.pathname.match(/\/rest\/v1\/([^/?]+)/);
    const table = tableMatch?.[1] ?? '';
    let body: unknown = [];
    if (table === 'company_members') {
      const { companyId } = sessionPayload();
      body = [{ company_id: companyId, role: 'OWNER', companies: { id: companyId, name: 'MALEK Demo', slug: 'malek-demo', currency: 'OMR', locale: 'ar-OM' } }];
    } else if (table === 'company_settings') { body = companySettings; }
    const arr = Array.isArray(body) ? body : [body];
    await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-range': arr.length > 0 ? `0-${arr.length - 1}/${arr.length}` : '*/0' }, body: JSON.stringify(body) });
  });
}

test('LOGIN FLOW: form → auth POST → session → /dashboard → app shell (app-side login path)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installAuthHarness(page);
  await page.addInitScript(() => { if (document.documentElement) document.documentElement.dataset.theme = 'light'; });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByPlaceholder('••••••••')).toBeVisible();

  // Fill and submit the real form; the harness answers the auth POST.
  await page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true }).fill('login@malek.test');
  await page.getByPlaceholder('••••••••').fill('correct-password');
  await page.getByRole('button', { name: /تسجيل الدخول/ }).click();

  // Must land on /dashboard with the real app shell (no error boundary, no stuck form)
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  await expect(page.locator('[data-app-shell]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-app-shell-header]')).toBeVisible();
});

test('LOGIN FLOW: wrong credentials show the Arabic error, stay on /login, no crash', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await installAuthHarness(page);
  await page.route('**/auth/v1/token*', (route) => route.fulfill({ status: 400, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) }));
  await page.addInitScript(() => { if (document.documentElement) document.documentElement.dataset.theme = 'light'; });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true }).fill('login@malek.test');
  await page.getByPlaceholder('••••••••').fill('wrong-password');
  await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
  await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/login$/);
  // Form still usable (fields not stuck disabled)
  await expect(page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true })).toBeEnabled();
});
