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
    'The explicit settings matrix runs once in Chromium; project device coverage remains in readiness smoke.',
  );
});

async function openFixture(page: Page, theme: (typeof themes)[number]) {
  await page.addInitScript((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);
  await page.goto(`/login?e2e-settings-workspace=1&theme=${theme}`);

  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('main[data-e2e-settings-workspace]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'إعدادات المكتب', exact: true })).toBeVisible();
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

      const saveSurface = page.getByRole('region', { name: 'تغييرات إعدادات غير محفوظة' });
      await expect(saveSurface).toHaveCount(0);

      await page.getByRole('button', { name: /المظهر والواجهة/ }).click();
      await expect(page.getByRole('heading', { name: 'المظهر والواجهة' })).toBeVisible();
      await expect(page.getByLabel('معاينة المظهر')).toBeVisible();

      const alternateTheme = theme === 'dark' ? 'فاتحة' : 'داكنة';
      await page.getByRole('button', { name: new RegExp(alternateTheme) }).click();
      await expect(page.locator('main[data-e2e-settings-workspace]')).toHaveAttribute('data-submit-count', '0');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'dark' ? 'light' : 'dark');

      await page.getByRole('button', { name: /بيانات المكتب/ }).click();

      const companyName = page.getByLabel('اسم الشركة');
      await companyName.fill('Rentrix Updated');
      await expect(saveSurface).toBeVisible();
      await expect(saveSurface.getByText('تغييرات غير محفوظة')).toBeVisible();
      await expect(saveSurface.getByRole('button', { name: 'حفظ' })).toBeEnabled();

      await saveSurface.getByRole('button', { name: 'تراجع عن التغييرات' }).click();
      await expect(companyName).toHaveValue('Rentrix');
      await expect(saveSurface).toHaveCount(0);

      await assertNoHorizontalOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`settings-workspace-${viewport.name}-${theme}.png`),
        fullPage: true,
      });
    });
  }
}