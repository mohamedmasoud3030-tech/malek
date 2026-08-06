import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

const viewportMatrix = [
  { name: '320', width: 320, height: 740 },
  { name: '375', width: 375, height: 844 },
  { name: '414', width: 414, height: 896 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1440', width: 1440, height: 1000 },
] as const;

const evidenceDir = process.env.VISUAL_WAVE_EVIDENCE_DIR || '/home/user/malik/evidence/ui-malek-pro-wave-1/after';

// The spec writes its explicit visual evidence itself. Disable per-failure
// video/trace archives here only so a large browser matrix cannot turn a
// passing visual assertion into a slow/corrupt artifact teardown.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test.setTimeout(120_000);

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Runs the explicit six-width visual matrix once; standard project coverage remains in the readiness suite.',
  );
});

async function setThemeAndNavigate(page: Page, url: string, theme: 'light' | 'dark') {
  await page.addInitScript((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);
}

async function expectNoApplicationOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    htmlScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(metrics.htmlScrollWidth, `${label}: html overflow`).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.bodyScrollWidth, `${label}: body overflow`).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

for (const viewport of viewportMatrix) {
  test(`properties operational shell is contained and touch-safe at ${viewport.name}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setThemeAndNavigate(page, '/login?e2e-showcase-properties=1', 'light');

    await expect(page.locator('[data-e2e-properties-workspace]')).toBeVisible();
    await expect(page.locator('[data-visual-wave="malek-pro"]').first()).toBeVisible();
    await expectNoApplicationOverflow(page, `properties@${viewport.name}`);

    const targetMetrics = await page.locator('[data-page-header] button, [data-list-controls] button, [data-list-controls] input, [data-list-controls] select').evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = (element as HTMLElement).getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .map((element) => {
          const rect = (element as HTMLElement).getBoundingClientRect();
          return { name: (element.getAttribute('aria-label') || element.textContent || element.tagName).trim(), width: rect.width, height: rect.height };
        }),
    );
    for (const target of targetMetrics) {
      expect(target.width, `${viewport.name}px ${target.name}: target width`).toBeGreaterThanOrEqual(44);
      expect(target.height, `${viewport.name}px ${target.name}: target height`).toBeGreaterThanOrEqual(44);
    }
  });
}

for (const surface of [
  { name: 'contracts', url: '/login?e2e-showcase-contracts=1', ready: '[data-e2e-contracts-workspace]', width: 414, height: 896 },
  { name: 'settings', url: '/login?e2e-settings-workspace=1', ready: '[data-e2e-settings-workspace]', width: 768, height: 1024 },
  { name: 'maintenance', url: '/login?e2e-showcase-maintenance=1', ready: '[data-e2e-maintenance-workspace]', width: 1024, height: 900 },
] as const) {
  test(`${surface.name} keeps the scoped operational visual system without page overflow`, async ({ page }) => {
    await page.setViewportSize({ width: surface.width, height: surface.height });
    await setThemeAndNavigate(page, surface.url, 'dark');
    await expect(page.locator(surface.ready)).toBeVisible();
    await expect(page.locator('[data-visual-wave="malek-pro"]').first()).toBeVisible();
    await expectNoApplicationOverflow(page, `${surface.name}@${surface.width}`);
  });
}

test('mobile uses readable cards while desktop preserves the real table and keyboard-focusable scroller', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await setThemeAndNavigate(page, '/login?e2e-showcase-properties=1', 'dark');

  await expect(page.locator('[role="list"][aria-label="جدول العقارات"]')).toBeVisible();
  await expect(page.locator('table[aria-label="جدول العقارات"]')).toBeHidden();
  await expectNoApplicationOverflow(page, 'properties mobile cards');

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator('table[aria-label="جدول العقارات"]')).toBeVisible();
  const scroller = page.locator('[data-entity-table-scroll]').first();
  await scroller.focus();
  await expect(scroller).toBeFocused();
});

test('respects reduced motion and has no obvious RTL accessibility violations on the core properties surface', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 844 });
  await setThemeAndNavigate(page, '/login?e2e-showcase-properties=1', 'dark');

  const primaryAction = page.getByRole('button', { name: 'إضافة عقار' });
  await expect(primaryAction).toBeVisible();
  const duration = await primaryAction.evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.01);

  const results = await new AxeBuilder({ page })
    .disableRules(['color-contrast'])
    .analyze();
  expect(results.violations).toEqual([]);
});

for (const [width, height] of [[375, 844], [1440, 1000]] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`captures the required properties evidence at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await setThemeAndNavigate(page, '/login?e2e-showcase-properties=1', theme);
      await expect(page.locator('[data-e2e-properties-workspace]')).toBeVisible();
      await expectNoApplicationOverflow(page, `evidence ${width}px ${theme}`);
      fs.mkdirSync(evidenceDir, { recursive: true });
      await page.screenshot({ path: path.join(evidenceDir, `properties-${width}-${theme}.png`), fullPage: true });
    });
  }
}
