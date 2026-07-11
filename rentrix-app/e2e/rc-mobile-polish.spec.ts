import { expect, test } from '@playwright/test';

const mobileWidths = [320, 375, 430] as const;

test('RC mobile polish keeps the login surface usable at 320/375/430px', async ({ page }) => {
  for (const width of mobileWidths) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();
    await expect(page.getByLabel('البريد الإلكتروني')).toBeVisible();
    await expect(page.getByRole('button', { name: /تسجيل الدخول/ })).toBeVisible();

    const viewport = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(viewport.scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(viewport.clientWidth + 1);
  }
});
