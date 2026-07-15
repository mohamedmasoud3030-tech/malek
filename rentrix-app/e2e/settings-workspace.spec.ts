import { expect, test, type Page } from '@playwright/test';

const viewportMatrix = [
  { name: 'mobile-360', width: 360, height: 800, usesSelect: true },
  { name: 'mobile-390', width: 390, height: 844, usesSelect: true },
  { name: 'mobile-430', width: 430, height: 932, usesSelect: true },
  { name: 'tablet-768', width: 768, height: 1024, usesSelect: false },
  { name: 'desktop-1440', width: 1440, height: 1000, usesSelect: false },
] as const;

const themes = ['light', 'dark'] as const;

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'The explicit settings matrix runs once in Chromium; project device coverage remains in readiness smoke.',
  );
});

async function openFixture(page: Page, theme: (typeof themes)[number]) {
  await page.addInitScript((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);
  await page.goto('/login?e2e-settings-workspace=1');

  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('main[data-e2e-settings-workspace]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rentrix' })).toBeVisible();
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.documentClientWidth + 1);
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.documentClientWidth + 1);
}

for (const viewport of viewportMatrix) {
  for (const theme of themes) {
    test(`settings workspace ${viewport.name} ${theme} RTL`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFixture(page, theme);

      const saveSurface = page.getByRole('region', { name: 'حالة حفظ الإعدادات' });
      await expect(saveSurface).toBeVisible();

      if (viewport.usesSelect) {
        await expect(page.getByLabel('القسم الحالي')).toBeVisible();
        await expect.poll(async () => saveSurface.evaluate((node) => getComputedStyle(node).position)).toBe('static');
        await page.getByLabel('القسم الحالي').selectOption('system');
      } else {
        await expect(page.getByLabel('القسم الحالي')).toBeHidden();
        await page.getByRole('button', { name: /المظهر والواجهة/ }).click();
      }

      await expect(page.getByRole('heading', { name: 'المظهر والواجهة' })).toBeVisible();
      await expect(page.getByLabel('معاينة المظهر')).toBeVisible();

      const alternateTheme = theme === 'dark' ? 'فاتحة' : 'داكنة';
      await page.getByRole('button', { name: new RegExp(alternateTheme) }).click();
      await expect(page.locator('main[data-e2e-settings-workspace]')).toHaveAttribute('data-submit-count', '0');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'dark' ? 'light' : 'dark');

      if (viewport.usesSelect) {
        await page.getByLabel('القسم الحالي').selectOption('office');
      } else {
        await page.getByRole('button', { name: /بيانات المكتب/ }).click();
      }

      const companyName = page.getByLabel('اسم الشركة');
      await companyName.fill('Rentrix Updated');
      await expect(page.getByText('تغييرات غير محفوظة').first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'حفظ' })).toBeEnabled();

      await page.getByRole('button', { name: 'تراجع' }).click();
      await expect(companyName).toHaveValue('Rentrix');
      await expect(page.getByRole('button', { name: 'حفظ' })).toBeDisabled();

      await assertNoHorizontalOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`settings-workspace-${viewport.name}-${theme}.png`),
        fullPage: true,
      });
    });
  }
}
