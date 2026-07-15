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
  test.skip(testInfo.project.name !== 'chromium-desktop', 'The explicit dashboard matrix runs once in Chromium.');
});

async function openFixture(page: Page, theme: (typeof themes)[number]) {
  await page.addInitScript((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);
  await page.goto('/login?e2e-dashboard-workspace=1');
  await page.evaluate((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('main[data-e2e-dashboard-workspace]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'لوحة التحكم' })).toBeVisible();
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
    test(`dashboard priorities ${viewport.name} ${theme} RTL`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFixture(page, theme);

      const sectionNames = await page.locator('[data-dashboard-section]').evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-dashboard-section')),
      );
      expect(sectionNames).toEqual(['kpis', 'priorities', 'trends', 'work-queues']);
      await expect(page.locator('[data-dashboard-hero]')).toBeVisible();

      await expect(page.locator('[data-dashboard-action-grid] > a')).toHaveCount(4);
      await expect(page.locator('[data-dashboard-kpi-grid] [class*="grid-cols-2"] > *')).toHaveCount(4);

      const actionColumns = await page.locator('[data-dashboard-action-grid]').evaluate((node) =>
        getComputedStyle(node).gridTemplateColumns.split(' ').length,
      );
      const kpiColumns = await page.locator('[data-dashboard-kpi-grid] > div').evaluate((node) =>
        getComputedStyle(node).gridTemplateColumns.split(' ').length,
      );
      expect(actionColumns).toBe(2);
      expect(kpiColumns).toBe(2);

      await assertNoHorizontalOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`dashboard-${viewport.name}-${theme}.png`), fullPage: true });
    });
  }
}
