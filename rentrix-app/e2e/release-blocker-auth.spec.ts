import { expect, test, type Page, type Response } from '@playwright/test';

const isReleaseBlockerRun = process.env.E2E_ENVIRONMENT_KIND === 'production-readonly';
const authStorageKey = 'rentrix-auth-session';
const invalidSessionSeedMarker = 'rentrix-invalid-session-seeded';
const fallbackEmailDomain = 'gmail.com';
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const allowedAuthWritePaths = new Set(['/auth/v1/token', '/auth/v1/logout']);
const readOnlyReportRpcPrefix = '/rest/v1/rpc/rpt_';

function requireEnv(name: 'E2E_TEST_EMAIL' | 'E2E_TEST_PASSWORD'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Deployed read-only authentication tests must fail, not skip, when credentials are unavailable.`,
    );
  }

  if (name === 'E2E_TEST_EMAIL' && value.endsWith('@')) {
    return `${value}${fallbackEmailDomain}`;
  }

  return value;
}

const email = isReleaseBlockerRun ? requireEnv('E2E_TEST_EMAIL') : '';
const password = isReleaseBlockerRun ? requireEnv('E2E_TEST_PASSWORD') : '';

async function installReadOnlyNetworkGuard(page: Page) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    if (safeMethods.has(method)) {
      await route.continue();
      return;
    }

    const { pathname } = new URL(request.url());
    const isAllowedAuthRequest = method === 'POST' && allowedAuthWritePaths.has(pathname);
    const isReadOnlyReportRpc = method === 'POST' && pathname.startsWith(readOnlyReportRpcPrefix);
    if (isAllowedAuthRequest || isReadOnlyReportRpc) {
      await route.continue();
      return;
    }

    await route.abort('blockedbyclient');
    throw new Error(`Blocked unexpected mutating ${method} request during read-only release verification: ${pathname}`);
  });
}

async function submitLogin(page: Page, candidatePassword: string): Promise<Response> {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true }).fill(email);
  await page.getByPlaceholder('••••••••').fill(candidatePassword);

  const loginButton = page.getByRole('button', { name: /^تسجيل الدخول$/ });
  const authResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/auth/v1/token') && response.request().method() === 'POST';
  });

  await loginButton.click();
  return authResponsePromise;
}

async function expectProtectedShell(page: Page) {
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('لوحة التحكم').first()).toBeVisible();
}

test.describe('release blocker: deployed read-only authentication lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  test.skip(
    !isReleaseBlockerRun,
    'The general browser smoke does not own deployed credentials; the dedicated read-only release job runs this suite with zero skips.',
  );

  test.beforeEach(async ({ page }) => {
    await installReadOnlyNetworkGuard(page);
  });

  test('valid deployed credentials create a usable session that can be logged out', async ({ page }) => {
    const authResponse = await submitLogin(page, password);
    expect(authResponse.ok()).toBe(true);
    await expectProtectedShell(page);

    await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'كل أملاكك في مكان واحد', exact: true })).toBeVisible();
  });

  test('invalid credentials do not create a session or enter the protected shell', async ({ page }) => {
    const authResponse = await submitLogin(page, `${password}-invalid`);
    expect(authResponse.status()).toBeGreaterThanOrEqual(400);

    const loginButton = page.getByRole('button', { name: /^تسجيل الدخول$/ });
    await expect(loginButton).toBeEnabled();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'كل أملاكك في مكان واحد', exact: true })).toBeVisible();
    await expect(page.getByText('لوحة التحكم')).toHaveCount(0);

    const authStorageValue = await page.evaluate(
      (storageKey) => localStorage.getItem(storageKey),
      authStorageKey,
    );
    expect(authStorageValue).toBeNull();
  });

  test('an invalidated stored session returns to login without a second real sign-in', async ({ page }) => {
    await page.addInitScript(
      ({ storageKey, marker, userEmail }) => {
        if (sessionStorage.getItem(marker) === '1') return;

        localStorage.setItem(
          storageKey,
          JSON.stringify({
            access_token: 'expired.invalid.token',
            refresh_token: 'invalid-refresh-token',
            expires_at: 1,
            expires_in: 1,
            token_type: 'bearer',
            user: {
              id: '00000000-0000-4000-8000-000000000001',
              aud: 'authenticated',
              role: 'authenticated',
              email: userEmail,
            },
          }),
        );
        sessionStorage.setItem(marker, '1');
      },
      { storageKey: authStorageKey, marker: invalidSessionSeedMarker, userEmail: email },
    );

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'كل أملاكك في مكان واحد', exact: true })).toBeVisible();
    await expect(page.getByText('لوحة التحكم')).toHaveCount(0);
  });
});
