import { expect, test, type Page, type Response } from '@playwright/test';

const isReleaseBlockerRun = process.env.E2E_ENVIRONMENT_KIND === 'staging';
const authStorageKey = 'rentrix-auth-session';
const invalidSessionSeedMarker = 'rentrix-invalid-session-seeded';
const fallbackEmailDomain = 'gmail.com';

function requireEnv(name: 'E2E_TEST_EMAIL' | 'E2E_TEST_PASSWORD'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Release-blocker authentication tests must fail, not skip, when staging credentials are unavailable.`,
    );
  }

  if (name === 'E2E_TEST_EMAIL' && value.endsWith('@')) {
    return `${value}${fallbackEmailDomain}`;
  }

  return value;
}

const email = isReleaseBlockerRun ? requireEnv('E2E_TEST_EMAIL') : '';
const password = isReleaseBlockerRun ? requireEnv('E2E_TEST_PASSWORD') : '';

async function submitLogin(page: Page, candidatePassword: string): Promise<Response> {
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill(email);
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
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('لوحة التحكم').first()).toBeVisible();
}

test.describe('release blocker: real authentication lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  test.skip(
    !isReleaseBlockerRun,
    'The general browser smoke does not own staging credentials; the dedicated release-blocker job runs this suite with zero skips.',
  );

  test('valid staging credentials create a usable session that can be logged out', async ({ page }) => {
    const authResponse = await submitLogin(page, password);
    expect(authResponse.ok()).toBe(true);
    await expectProtectedShell(page);

    await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();
  });

  test('invalid credentials do not create a session or enter the protected shell', async ({ page }) => {
    const authResponse = await submitLogin(page, `${password}-invalid`);
    expect(authResponse.status()).toBeGreaterThanOrEqual(400);

    const loginButton = page.getByRole('button', { name: /^تسجيل الدخول$/ });
    await expect(loginButton).toBeEnabled();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();
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

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();
    await expect(page.getByText('لوحة التحكم')).toHaveCount(0);
  });
});
