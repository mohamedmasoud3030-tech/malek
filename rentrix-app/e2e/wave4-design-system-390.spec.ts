import { expect, test, type Page } from '@playwright/test';

const WIDTH = 390;
const HEIGHT = 844;

const surfaces = [
  {
    name: 'settings',
    url: '/login?e2e-settings-workspace=1',
    ready: 'main[data-e2e-settings-workspace]',
  },
  {
    name: 'reports',
    url: '/login?e2e-reports-workspace=1',
    ready: 'main[data-e2e-reports-workspace]',
  },
  {
    name: 'owners',
    url: '/login?e2e-owner-detail-workspace=1',
    ready: 'main[data-e2e-owner-detail-workspace]',
  },
] as const;

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth, `${label}: horizontal overflow`).toBeLessThanOrEqual(metrics.clientWidth + 2);
}

async function assertTouchTargets(page: Page, label: string) {
  const offenders = await page.evaluate(() => {
    const isVisible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
    return Array.from(document.querySelectorAll<HTMLElement>('button, a[href], [role="button"], input, select'))
      .filter(isVisible)
      .filter((element) => element.getAttribute('aria-hidden') !== 'true')
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          name: (element.getAttribute('aria-label') || element.textContent || element.tagName).trim().slice(0, 60),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((target) => target.width < 44 || target.height < 44);
  });
  expect(offenders, `${label}: touch targets below 44x44`).toEqual([]);
}

async function assertResponsiveCardGrids(page: Page, label: string) {
  const grids = page.locator('[data-responsive-card-grid]:visible');
  const count = await grids.count();
  if (count === 0) return;

  for (let index = 0; index < count; index += 1) {
    const columns = await grids.nth(index).evaluate((element) => {
      const template = getComputedStyle(element as HTMLElement).gridTemplateColumns;
      return template.split(' ').filter(Boolean).length;
    });
    expect(columns, `${label}: responsive card grid ${index} must use two mobile columns`).toBe(2);
  }
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Wave 4 390px acceptance runs once in chromium-desktop shard');
});

for (const surface of surfaces) {
  test(`Wave 4 ${surface.name} — 390px responsive contract`, async ({ page }) => {
    await page.setViewportSize({ width: WIDTH, height: HEIGHT });
    await page.goto(surface.url, { waitUntil: 'domcontentloaded' });
    await expect(page.locator(surface.ready).first()).toBeVisible({ timeout: 20_000 });

    await assertNoHorizontalOverflow(page, `${surface.name}@390`);
    await assertTouchTargets(page, `${surface.name}@390`);
    await assertResponsiveCardGrids(page, `${surface.name}@390`);
  });
}
