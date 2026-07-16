import { expect, test, type Page } from '@playwright/test';

const viewportMatrix = [
  { name: 'mobile-360', width: 360, height: 800, usesSheet: true },
  { name: 'mobile-390', width: 390, height: 844, usesSheet: true },
  { name: 'mobile-430', width: 430, height: 932, usesSheet: true },
  { name: 'tablet-768', width: 768, height: 1024, usesSheet: false },
  { name: 'desktop-1440', width: 1440, height: 1000, usesSheet: false },
] as const;

const themes = ['light', 'dark'] as const;

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'The explicit reports matrix runs once in Chromium; project-level device coverage remains in readiness-smoke.spec.ts.',
  );
});

async function openFixture(page: Page, theme: (typeof themes)[number]) {
  await page.addInitScript((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);
  await page.goto('/login?e2e-reports-workspace=1');
  await page.evaluate((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);

  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('main[data-e2e-reports-workspace]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'مركز التقارير والكشوف', exact: true })).toBeVisible();
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
    test(`reports workspace ${viewport.name} ${theme} RTL`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFixture(page, theme);

      const editFilters = page.getByRole('button', { name: 'تعديل الفلاتر' });
      if (viewport.usesSheet) {
        await expect(editFilters).toBeVisible();
        await editFilters.click();

        const sheet = page.getByRole('dialog', { name: 'فلترة نطاق التقرير' });
        await expect(sheet).toBeVisible();
        await expect(page.getByRole('button', { name: 'عرض النتائج' })).toBeVisible();
        await page.getByRole('button', { name: 'عرض النتائج' }).click();
        await expect(sheet).toBeHidden();
      } else {
        await expect(editFilters).toBeHidden();
        await expect(page.getByRole('heading', { name: 'فلترة نطاق التقرير' })).toBeVisible();
      }

      const collectionsTab = page.getByRole('tab', { name: 'التحصيلات' });
      await collectionsTab.click();
      await expect(collectionsTab).toHaveAttribute('aria-selected', 'true');
      await expect(
        page.locator('[role="tabpanel"][aria-labelledby="section-tab-collections"]'),
      ).toBeVisible();

      await assertNoHorizontalOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`reports-workspace-${viewport.name}-${theme}.png`),
        fullPage: true,
      });
    });
  }
}
