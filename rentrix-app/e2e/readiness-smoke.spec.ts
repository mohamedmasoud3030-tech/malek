import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const allowedConsoleErrorFragments = [
  'Supabase environment is incomplete. Runtime diagnostics will be shown in UI.',
  'Failed to load resource: net::ERR_CERT_AUTHORITY_INVALID',
];

async function collectUnexpectedConsoleErrors(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (allowedConsoleErrorFragments.some((fragment) => text.includes(fragment))) return;
    consoleErrors.push(text);
  });
  return consoleErrors;
}

test.describe('release readiness browser smoke', () => {
  test('redirects the root to login without loading landing or protected bundles', async ({ page }) => {
    const requestedUrls: string[] = [];
    page.on('request', (request) => requestedUrls.push(request.url()));

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /ودّع جداول Excel/ })).toHaveCount(0);

    expect(requestedUrls.some((url) => url.includes('rentrix-demo.mp4'))).toBe(false);
    expect(requestedUrls.some((url) => url.includes('/features/landing') || url.includes('/routes/landing'))).toBe(false);
    expect(requestedUrls.some((url) => url.includes('recharts') || url.includes('/routes/_protected'))).toBe(false);
    expect(requestedUrls.some((url) => url.endsWith('/icon-rentrix.png'))).toBe(false);
  });

  test('renders the unauthenticated login surface without critical accessibility violations', async ({ page }, testInfo) => {
    const consoleErrors = await collectUnexpectedConsoleErrors(page);

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();
    await expect(page.getByLabel('البريد الإلكتروني')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /تسجيل الدخول/ })).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath(`login-${testInfo.project.name}.png`),
      fullPage: true,
    });
    expect(consoleErrors).toEqual([]);
  });

  test('supports keyboard focus through the unauthenticated login form', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.getByLabel('البريد الإلكتروني');
    const passwordInput = page.getByPlaceholder('••••••••');
    const passwordToggle = page.getByRole('button', { name: 'إظهار كلمة المرور' });
    const submitButton = page.getByRole('button', { name: /تسجيل الدخول/ });

    await emailInput.focus();
    await expect(emailInput).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(passwordInput).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(passwordToggle).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(submitButton).toBeFocused();
  });

  test('keeps the login surface within the mobile viewport without horizontal overflow', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });

  test('redirects a protected route to login when no session exists', async ({ page }) => {
    const consoleErrors = await collectUnexpectedConsoleErrors(page);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('seeded staging readiness smoke', () => {
  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for authenticated staging smoke tests.',
  );

  test('can submit seeded staging credentials and reach the protected app shell', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('البريد الإلكتروني').fill(process.env.E2E_TEST_EMAIL!);
    await page.getByPlaceholder('••••••••').fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole('button', { name: /تسجيل الدخول/ }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('لوحة التحكم').first()).toBeVisible();
  });
});
