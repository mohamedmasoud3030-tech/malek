import { expect, test, type Page } from '@playwright/test';

const viewportMatrix = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
] as const;

const themes = ['light', 'dark'] as const;

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'The explicit login viewport matrix runs once in Chromium; readiness-smoke retains project device coverage.',
  );
});

async function openLogin(page: Page, theme: (typeof themes)[number]) {
  await page.addInitScript((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);
  await page.goto('/login');
  await page.evaluate((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('[data-login-surface]')).toBeVisible();
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));

  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1);
  expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1);
}

for (const viewport of viewportMatrix) {
  for (const theme of themes) {
    test(`focused login ${viewport.name} ${theme} RTL`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogin(page, theme);

      await expect(page.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true })).toBeVisible();
      await expect(page.getByPlaceholder('••••••••')).toBeVisible();
      await expect(page.getByRole('button', { name: /تسجيل الدخول/ })).toBeVisible();
      await expect(page.locator('aside')).toHaveCount(0);
      await expect(page.getByText('إدارة واضحة للأصول')).toHaveCount(0);
      await expect(page.locator('form')).toHaveCount(1);
      await assertNoHorizontalOverflow(page);

      const surfaceBox = await page.locator('[data-login-surface]').boundingBox();
      expect(surfaceBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(viewport.width);

      await page.screenshot({
        path: testInfo.outputPath(`login-simplification-${viewport.name}-${theme}.png`),
        fullPage: true,
      });
    });
  }
}

test('keeps authentication failure inside the login form', async ({ page }) => {
  await page.route('**/auth/v1/token**', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
    });
  });

  await openLogin(page, 'light');
  const submitButton = page.getByRole('button', { name: 'تسجيل الدخول' });
  await expect(submitButton).toBeEnabled();
  await page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true }).fill('invalid@example.com');
  await page.getByPlaceholder('••••••••').fill('not-a-real-password');
  await page.getByRole('button', { name: /تسجيل الدخول/ }).click();

  const form = page.locator('form');
  const error = form.getByRole('alert');
  await expect(error).toBeVisible();
  await expect(error).toContainText('تعذر تسجيل الدخول');
  await expect(submitButton).toBeEnabled();
});
