/**
 * Maintenance workspace responsive acceptance.
 * The fixture intentionally uses the current card-first maintenance contract;
 * it does not render EntityTable on mobile, so assertions target the real
 * interactive surface rather than the retired compact-table implementation.
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
        await page.goto('/login?e2e-maintenance-workspace=1');

        await expect(page.locator('[data-e2e-maintenance-workspace]')).toBeVisible();
        await expect(page.locator('[data-filter-bar]')).toBeVisible();

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(
          overflow.scrollWidth,
          `horizontal overflow at ${vp.width}px [${scheme}]`,
        ).toBeLessThanOrEqual(overflow.clientWidth + 1);

        await page.screenshot({
          path: `e2e/evidence/maintenance-${scheme}-${vp.width}x${vp.height}.png`,
          fullPage: false,
        });
      });

      test(`filter bar renders without overflow at ${vp.width}×${vp.height} [${scheme}]`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize(vp);
        await page.goto('/login?e2e-maintenance-workspace=1');

        const filterBar = page.locator('[data-filter-bar]');
        await expect(filterBar).toBeVisible({ timeout: 10_000 });
        await expect(page.getByLabel('تصفية حسب الحالة')).toBeVisible();
        await expect(page.getByLabel('تصفية حسب الأولوية')).toBeVisible();
        await expect(page.getByLabel('تصفية حسب العقار')).toBeVisible();
      });

      test(`maintenance cards keep 44px actions at ${vp.width}px [${scheme}]`, async ({ page }) => {
        test.skip(vp.width >= 768, 'mobile-width assertion');
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize(vp);
        await page.goto('/login?e2e-maintenance-workspace=1');

        const cards = page.locator('[data-entity-card]');
        await expect(cards).toHaveCount(2);
        await expect(cards.first()).toBeVisible();

        const buttons = cards.locator('button');
        const count = await buttons.count();
        expect(count).toBeGreaterThan(0);
        for (let index = 0; index < count; index += 1) {
          const box = await buttons.nth(index).boundingBox();
          expect(box?.height ?? 0, 'touch target must be ≥ 44px').toBeGreaterThanOrEqual(44);
        }
      });
    }
  }
});
