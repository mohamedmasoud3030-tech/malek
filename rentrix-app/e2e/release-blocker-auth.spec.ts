import { expect, test, type Page } from '@playwright/test';

const isReleaseBlockerRun = process.env.E2E_ENVIRONMENT_KIND === 'staging';

function requireEnv(name: 'E2E_TEST_EMAIL' | 'E2E_TEST_PASSWORD'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required. Release-blocker authentication tests must fail, not skip, when staging credentials are unavailable.`);
  }
  return value;
}

const email = isReleaseBlockerRun ? requireEnv('E2E_TEST_EMAIL') : '';
const password = isReleaseBlockerRun ? requireEnv('E2E_TEST_PASSWORD') : '';

async function submitLogin(page: Page, candidatePassword: string) {
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByPlaceholder('••••••••').fill(candidatePassword);
  await page.getByRole('button', { name: /^تسجيل الدخول$/ }).click();
}

async function expectProtectedShell(page: Page) {
  await expect(page).toHaveURL(/\/($|\?)/);
  await expect(page.getByText('لوحة التحكم').first()).toBeVisible();
}

async function waitForAuthStorageKey(page: Page, timeoutMs = 10_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const keys = await page.evaluate(() =>
      Object.keys(localStorage).filter(
        (key) => key.startsWith('sb-') && (key.endsWith('-auth-token') || key.includes('auth-token')),
      ),
    );
    if (keys.length > 0) return keys[0];
    // If the app redirected, reload to pick up any persisted auth state
    if (page.url().includes('/login')) {
      await page.waitForTimeout(500);
    } else {
      await page.waitForTimeout(150);
    }
  }
  throw new Error(`Supabase auth storage key was not created after login within ${timeoutMs}ms.`);
}

test.describe('release blocker: real authentication lifecycle', () => {
  test.skip(
    !isReleaseBlockerRun,
    'The general browser smoke does not own staging credentials; the dedicated release-blocker job runs this suite with zero skips.',
  );

  test('valid staging credentials create a usable protected session', async ({ page }) => {
    await submitLogin(page, password);
    await expectProtectedShell(page);
  });

  test('invalid credentials do not create a session or enter the protected shell', async ({ page }) => {
    await submitLogin(page, `${password}-invalid`);

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();
    await expect(page.getByText('لوحة التحكم')).toHaveCount(0);

    const authStorageKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token')),
    );
    expect(authStorageKeys).toEqual([]);
  });

  test('an invalidated stored session returns to login without a redirect loop', async ({ page }) => {
    await submitLogin(page, password);
    await expectProtectedShell(page);

    // Wait for Supabase to persist its auth-token key. Sometimes the navigation
    // to the dashboard resolves before the SDK flushes the token to localStorage,
    // so we poll explicitly rather than racing on a single page.evaluate call.
    const storageKey = await waitForAuthStorageKey(page);

    await page.evaluate((key) => {
      const rawSession = localStorage.getItem(key);
      if (!rawSession) throw new Error('Supabase auth storage value is missing.');

      const session = JSON.parse(rawSession) as Record<string, unknown>;
      session.access_token = 'expired.invalid.token';
      session.refresh_token = 'invalid-refresh-token';
      session.expires_at = 1;
      localStorage.setItem(key, JSON.stringify(session));
    }, storageKey);

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();
  });

  test('logout removes protected access', async ({ page }) => {
    await submitLogin(page, password);
    await expectProtectedShell(page);

    // Wait for the SDK to finish restoring the session before clicking logout so
    // the logout button is guaranteed to be wired to a real authenticated client.
    await waitForAuthStorageKey(page);

    await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();
  });
});
