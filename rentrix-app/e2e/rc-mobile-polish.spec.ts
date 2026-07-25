import { expect, test, type Page } from '@playwright/test';

test.setTimeout(180_000);

const viewportWidths = [360, 390, 430, 768, 1440] as const;

const surfaces = [
  { name: 'login', url: '/login', ready: 'form[aria-describedby], form' },
  { name: 'dashboard', url: '/login?e2e-dashboard-workspace=1', ready: 'main[data-e2e-dashboard-workspace]' },
  { name: 'reports', url: '/login?e2e-reports-workspace=1', ready: 'main[data-e2e-reports-workspace]' },
  { name: 'settings', url: '/login?e2e-settings-workspace=1', ready: 'main[data-e2e-settings-workspace]' },
  { name: 'financials', url: '/login?e2e-showcase-financials=1', ready: 'main[data-e2e-financials-workspace]' },
  { name: 'properties', url: '/login?e2e-showcase-properties=1', ready: 'main[data-e2e-properties-workspace]' },
  { name: 'contracts', url: '/login?e2e-showcase-contracts=1', ready: 'main[data-e2e-contracts-workspace]' },
  { name: 'maintenance', url: '/login?e2e-maintenance-workspace=1', ready: 'main[data-e2e-maintenance-workspace]' },
  { name: 'utilities', url: '/login?e2e-utilities-workspace=1', ready: '[data-e2e-utilities-workspace]' },
  { name: 'documents-vault', url: '/login?e2e-vault-workspace=1', ready: '[data-e2e-vault-workspace]' },
  { name: 'deposits', url: '/login?e2e-deposits-workspace=1', ready: '[data-e2e-deposits-workspace]' },
  { name: 'automation', url: '/login?e2e-automation-workspace=1', ready: '[data-e2e-automation-workspace]' },
  { name: 'owner-detail', url: '/login?e2e-owner-detail-workspace=1', ready: 'main[data-e2e-owner-detail-workspace]' },
] as const;

function viewportHeight(width: number): number {
  if (width >= 1440) return 1000;
  if (width >= 768) return 1024;
  return 844;
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(
    Math.max(metrics.documentScrollWidth, metrics.bodyScrollWidth),
    `${label}: horizontal overflow`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function expectRtl(page: Page, label: string) {
  const direction = await page.evaluate(() => getComputedStyle(document.body).direction);
  expect(direction, `${label}: body direction`).toBe('rtl');
}

async function expectMobileTouchTargets(page: Page, label: string) {
  const offenders = await page.evaluate(() => {
    const isVisible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    return Array.from(document.querySelectorAll<HTMLElement>('button, input, select, textarea, [role="button"]'))
      .filter(isVisible)
      .filter((element) => element.getAttribute('aria-hidden') !== 'true')
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const label = element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName;
        return { label: label.slice(0, 40), width: Math.round(rect.width), height: Math.round(rect.height) };
      })
      .filter((item) => item.height < 40 || item.width < 32);
  });

  expect(offenders, `${label}: small touch targets ${JSON.stringify(offenders)}`).toEqual([]);
}

async function assertSurfaceAtViewport(page: Page, surface: (typeof surfaces)[number], width: number) {
  const label = `${surface.name}@${width}`;
  await page.setViewportSize({ width, height: viewportHeight(width) });
  await page.goto(surface.url);
  await expect(page.locator(surface.ready).first(), `${label}: ready marker`).toBeVisible({ timeout: 15_000 });
  await expectRtl(page, label);
  await expectNoHorizontalOverflow(page, `${label}: light`);

  if (width <= 768) {
    await expectMobileTouchTargets(page, label);
  }

  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await expectNoHorizontalOverflow(page, `${label}: dark`);
}

test('mobile UX viewport contract covers 360/390/430/768/1440 on representative app surfaces', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Viewport contract sets exact widths itself; run once.');

  for (const surface of surfaces) {
    for (const width of viewportWidths) {
      await assertSurfaceAtViewport(page, surface, width);
    }
  }
});
