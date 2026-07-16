import { expect, test, type Page } from '@playwright/test';

const viewportMatrix = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
] as const;

const themes = ['light', 'dark'] as const;

const reportTabs = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'property_analytics', label: 'العقارات' },
  { id: 'overdue', label: 'المتأخرات' },
  { id: 'occupancy', label: 'الإشغال' },
  { id: 'collections', label: 'التحصيلات' },
  { id: 'expenses', label: 'المصروفات' },
  { id: 'maintenance_analytics', label: 'الصيانة' },
  { id: 'deferred_revenue', label: 'الاستحقاق' },
  { id: 'statements', label: 'الكشوف' },
  { id: 'accounting', label: 'المحاسبة' },
] as const;

const evidenceTabs = new Set([
  'overview',
  'overdue',
  'collections',
  'maintenance_analytics',
  'deferred_revenue',
  'statements',
  'accounting',
]);

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
  await expect(page.getByText('لوحة القرار', { exact: true })).toBeVisible();
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

      const editFilters = page.getByRole('button', { name: 'تعديل النطاق' });
      await expect(editFilters).toBeVisible();
      await editFilters.click();

      const sheet = page.getByRole('dialog', { name: 'فلترة نطاق التقرير' });
      await expect(sheet).toBeVisible();
      await expect(page.getByRole('button', { name: 'تطبيق وعرض النتائج' })).toBeVisible();
      await page.getByRole('button', { name: 'تطبيق وعرض النتائج' }).click();
      await expect(sheet).toBeHidden();

      for (const reportTab of reportTabs) {
        const tab = page.getByRole('tab', { name: reportTab.label, exact: true });
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator(`[role="tabpanel"][aria-labelledby="section-tab-${reportTab.id}"]`)).toBeVisible();
        await expect(page.getByRole('heading', { name: reportTab.label, exact: true })).toBeVisible();
        await assertNoHorizontalOverflow(page);

        if (
          theme === 'light'
          && evidenceTabs.has(reportTab.id)
          && (viewport.name === 'mobile-390' || viewport.name === 'desktop-1440')
        ) {
          await page.screenshot({
            path: testInfo.outputPath(`reports-${reportTab.id}-${viewport.name}-${theme}.png`),
            fullPage: true,
          });
        }
      }

      await page.screenshot({
        path: testInfo.outputPath(`reports-workspace-${viewport.name}-${theme}.png`),
        fullPage: true,
      });
    });
  }
}
