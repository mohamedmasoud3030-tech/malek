import { expect, test, type Page } from '@playwright/test';

function requireEnv(name: 'E2E_TEST_EMAIL' | 'E2E_TEST_PASSWORD'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required. Release-blocker authentication tests must fail, not skip, when staging credentials are unavailable.`);
  }
  return value;
}

const email = requireEnv('E2E_TEST_EMAIL');
const password = requireEnv('E2E_TEST_PASSWORD');

async function submitLogin(page: Page, candidatePassword: string) {
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByPlaceholder('••••••••').fill(candidatePassword);
  await page.getByRole('button', { name: /^تسجيل الدخول$/ }).click();
}

async function expectProtectedShell(page: Page) {
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('لوحة التحكم').first()).toBeVisible();
}

test.describe('release blocker: real authentication lifecycle', () => {
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

    await page.evaluate(() => {
      const storageKey = Object.keys(localStorage).find(
        (key) => key.startsWith('sb-') && key.endsWith('-auth-token'),
      );
      if (!storageKey) throw new Error('Supabase auth storage key was not created after login.');

      const rawSession = localStorage.getItem(storageKey);
      if (!rawSession) throw new Error('Supabase auth storage value is missing.');

      const session = JSON.parse(rawSession) as Record<string, unknown>;
      session.access_token = 'expired.invalid.token';
      session.refresh_token = 'invalid-refresh-token';
      session.expires_at = 1;
      localStorage.setItem(storageKey, JSON.stringify(session));
    });

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();
  });

  test('logout removes protected access', async ({ page }) => {
    await submitLogin(page, password);
    await expectProtectedShell(page);

    await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();
  });
});
