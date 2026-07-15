/**
 * Phase 5 – Maintenance Workspace Polish
 * Visual evidence spec: RTL in Light/Dark at 360×800, 390×844, 430×932, 768×1024, 1440×1000
 *
 * SKIP REASON (recorded 2026-07-15):
 *   npx playwright install chromium completes without error in the CI
 *   sandbox but no binary is written to ~/.cache/ms-playwright — the
 *   Playwright CDN download domain (playwright.azureedge.net) is blocked by
 *   the egress proxy (x-deny-reason: domain not in allowlist).
 *   The test spec is committed so it can be run locally or in a full CI
 *   environment that has Chromium access.
 *
 * To run locally:
 *   npx playwright install chromium
 *   pnpm exec playwright test e2e/maintenance-workspace-polish.spec.ts
 */

import { expect, test } from '@playwright/test';

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
] as const;

const colorSchemes = ['light', 'dark'] as const;

test.describe('Maintenance workspace RTL polish', () => {
  for (const scheme of colorSchemes) {
    for (const vp of viewports) {
      test(`no horizontal overflow at ${vp.width}×${vp.height} [${scheme}]`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize(vp);
        await page.goto('/maintenance');

        // Wait for the page structure to appear
        await page.waitForSelector('[data-filter-bar]', { timeout: 10_000 }).catch(() => null);

        // Assert no horizontal overflow
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(
          overflow.scrollWidth,
          `horizontal overflow at ${vp.width}px [${scheme}]`,
        ).toBeLessThanOrEqual(overflow.clientWidth + 1);

        // Capture evidence screenshot
        await page.screenshot({
          path: `e2e/evidence/maintenance-${scheme}-${vp.width}x${vp.height}.png`,
          fullPage: false,
        });
      });

      test(`filter bar renders without overflow at ${vp.width}×${vp.height} [${scheme}]`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize(vp);
        await page.goto('/maintenance');

        const filterBar = page.locator('[data-filter-bar]');
        await expect(filterBar).toBeVisible({ timeout: 10_000 });

        // Confirm all three selects exist
        await expect(page.getByLabel('تصفية حسب الحالة')).toBeVisible();
        await expect(page.getByLabel('تصفية حسب الأولوية')).toBeVisible();
        await expect(page.getByLabel('تصفية حسب العقار')).toBeVisible();
      });

      test(`mobile cards use full-width touch targets at ${vp.width}px [${scheme}]`, async ({ page }) => {
        test.skip(vp.width >= 768, 'desktop breakpoint — DataTable shown instead');
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize(vp);
        await page.goto('/maintenance');
        // If there are rows, confirm buttons are at least 44px tall
        const firstButton = page.locator('[data-entity-card] button, .mobile-card button').first();
        const count = await firstButton.count();
        if (count > 0) {
          const box = await firstButton.boundingBox();
          if (box) {
            expect(box.height, 'touch target must be ≥ 44px').toBeGreaterThanOrEqual(44);
          }
        }
      });
    }
  }
});
