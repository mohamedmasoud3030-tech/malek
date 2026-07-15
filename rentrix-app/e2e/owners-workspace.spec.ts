import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x1000', width: 1440, height: 1000 },
] as const;
const themes = ['light', 'dark'] as const;

test.beforeEach(async ({}, testInfo) => test.skip(testInfo.project.name !== 'chromium-desktop'));

async function openFixture(page: Page, theme: (typeof themes)[number]) {
  await page.addInitScript((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);
  await page.goto('/login?e2e-owner-detail-workspace=1');
  await expect(page.locator('main[data-e2e-owner-detail-workspace]')).toBeVisible();
  await expect(page.getByText('بيانات التواصل')).toBeVisible();
}

for (const viewport of viewports) {
  for (const theme of themes) {
    test(`owner detail ${viewport.name} ${theme} RTL`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await openFixture(page, theme);
      await expect(page.getByText('خالد السالمي')).toBeVisible();
      await expect(page.getByText('نشط').first()).toBeVisible();
      const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
      await page.screenshot({ path: testInfo.outputPath(`owner-detail-${viewport.name}-${theme}.png`), fullPage: true });
    });
  }
}
