import { expect, test, type Page } from '@playwright/test';

// Contract width matrix (MALEK Visual Contract V2 / ADR 0012 phase 2-3):
// 320 / 375 / 414 mobile, 768 tablet, 1024 small desktop, 1440 desktop.
const viewportMatrix = [
  { name: 'mobile-320', width: 320, height: 760 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-414', width: 414, height: 896 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1024', width: 1024, height: 820 },
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
    test(`dashboard visual contract v2 ${viewport.name} ${theme} RTL`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFixture(page, theme);

      // 1. The V2 scope exists on a real Dashboard-owned DOM node and wraps the
      //    whole proof subtree.
      const scope = page.locator('[data-visual-contract="v2"]');
      await expect(scope).toBeVisible();
      await expect(scope.locator('[data-dashboard-hero]')).toBeVisible();

      // 2. Deliberate decision hierarchy: urgent priorities first, then KPI
      //    summary, trends, work queues and secondary analytics.
      const sectionNames = await page.locator('[data-dashboard-section]').evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-dashboard-section')),
      );
      expect(sectionNames).toEqual(['priorities', 'kpis', 'trends', 'work-queues', 'analytics']);

      // 3. KPI surfaces are real links and quick actions stay a 2x2 cluster.
      await expect(page.locator('[data-dashboard-action-grid] > a')).toHaveCount(4);
      const kpiLinks = page.locator('[data-dashboard-kpi-grid] a[data-dashboard-kpi-link]');
      await expect(kpiLinks).toHaveCount(4);
      const kpiHrefs = await kpiLinks.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
      expect(kpiHrefs).toEqual(['/financials', '/expenses', '/reports', '/arrears']);

      const actionColumns = await page.locator('[data-dashboard-action-grid]').evaluate((node) =>
        getComputedStyle(node).gridTemplateColumns.split(' ').length,
      );
      const kpiColumns = await page.locator('[data-dashboard-kpi-grid] > div').evaluate((node) =>
        getComputedStyle(node).gridTemplateColumns.split(' ').length,
      );
      expect(actionColumns).toBe(2);
      expect(kpiColumns).toBe(2);

      // 4. Minimum 44x44 interaction targets on the decision paths.
      const targetSizes = await page.evaluate(() => {
        const selectors = [
          '[data-dashboard-action-grid] > a',
          'a[data-dashboard-kpi-link]',
          'a[data-dashboard-priority-link]',
        ];
        return selectors.flatMap((selector) =>
          Array.from(document.querySelectorAll(selector)).map((el) => {
            const rect = el.getBoundingClientRect();
            return { selector, width: rect.width, height: rect.height };
          }),
        );
      });
      expect(targetSizes.length).toBeGreaterThan(0);
      for (const target of targetSizes) {
        expect(
          target.height >= 44 && target.width >= 44,
          `${target.selector} must stay >= 44x44 (got ${Math.round(target.width)}x${Math.round(target.height)})`,
        ).toBe(true);
      }

      // 5. No application-level horizontal scrolling at any contract width.
      await assertNoHorizontalOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`dashboard-${viewport.name}-${theme}.png`), fullPage: true });
    });
  }
}

test('dashboard visual contract v2 keyboard focus stays visible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Keyboard proof runs once in Chromium.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openFixture(page, 'light');

  // Tab into the page and confirm the focused interactive element has a
  // visible focus indicator (non-transparent outline from the V2 scope).
  await page.keyboard.press('Tab');
  const focusState = page.locator(':focus-visible');
  await expect(focusState).toBeVisible();
  const outline = await focusState.evaluate((node) => {
    const styles = getComputedStyle(node);
    return { style: styles.outlineStyle, width: styles.outlineWidth };
  });
  expect(outline.style).not.toBe('none');
  expect(Number.parseFloat(outline.width)).toBeGreaterThan(0);
});

test('dashboard visual contract v2 reduced motion collapses animation inside the scope', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Reduced-motion proof runs once in Chromium.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page, 'light');

  const durations = await page.evaluate(() => {
    const scoped = document.querySelector('[data-visual-contract="v2"]');
    if (!scoped) return null;
    const card = scoped.querySelector('[data-kpi-card]');
    if (!card) return null;
    const styles = getComputedStyle(card);
    return { transition: styles.transitionDuration, animation: styles.animationDuration };
  });
  expect(durations).not.toBeNull();
  for (const value of Object.values(durations ?? {})) {
    for (const part of value.split(',')) {
      expect(Number.parseFloat(part)).toBeLessThanOrEqual(0.011);
    }
  }
});
