import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const viewports = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x1000', width: 1440, height: 1000 },
] as const;

const themes = ['light', 'dark'] as const;

const targetDir = process.env.EVIDENCE_DIR || 'docs/ui-ux/evidence/before';

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
});

for (const vp of viewports) {
  for (const theme of themes) {
    test(`capture login ${vp.name} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript((selectedTheme) => {
        document.documentElement.dataset.theme = selectedTheme;
        document.documentElement.dir = 'rtl';
      }, theme);
      await page.goto('/login');
      await page.evaluate((selectedTheme) => {
        document.documentElement.dataset.theme = selectedTheme;
        document.documentElement.dir = 'rtl';
      }, theme);
      await expect(page.locator('[data-login-surface]')).toBeVisible();

      const outPath = path.join(process.cwd(), '..', targetDir, `login-${vp.name}-${theme}.png`);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      await page.screenshot({ path: outPath, fullPage: true });
    });

    test(`capture dashboard ${vp.name} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript((selectedTheme) => {
        document.documentElement.dataset.theme = selectedTheme;
        document.documentElement.dir = 'rtl';
      }, theme);
      await page.goto('/login?e2e-dashboard-workspace=1');
      await page.evaluate((selectedTheme) => {
        document.documentElement.dataset.theme = selectedTheme;
        document.documentElement.dir = 'rtl';
      }, theme);
      await expect(page.locator('main[data-e2e-dashboard-workspace]')).toBeVisible();

      const outPath = path.join(process.cwd(), '..', targetDir, `dashboard-${vp.name}-${theme}.png`);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      await page.screenshot({ path: outPath, fullPage: true });
    });
  }
}
