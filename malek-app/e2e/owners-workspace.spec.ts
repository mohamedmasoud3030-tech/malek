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

// Regression (whole-app browser audit): the owner dossier's "related
// properties" register used to render a <Link> in the identity column. On
// mobile the shared EntityTable wraps identity in the card's primary
// <button>, which produced invalid nested interactive controls and a 30px
// touch target. The identity cell must stay plain text (the card button is
// the single navigation affordance), and every control in the mobile card
// must meet the 44px floor.
test('owner dossier mobile register cards never nest interactive controls and keep ≥44px targets', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openFixture(page, 'light');

  const nested = await page.evaluate(() => {
    const findings: string[] = [];
    for (const card of Array.from(document.querySelectorAll('[data-entity-table-mobile-card]'))) {
      const primary = card.querySelector('button[data-entity-table-mobile-primary]');
      if (primary?.querySelector('a[href], button, [role="button"]')) {
        findings.push(`interactive nested inside card primary button: ${primary.textContent?.trim().slice(0, 40)}`);
      }
    }
    return findings;
  });
  expect(nested, `nested interactives: ${nested.join('\n')}`).toEqual([]);

  const smallTargets = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-entity-table-mobile-card] button, [data-entity-table-mobile-card] a[href]'));
    return els
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { name: (el.getAttribute('aria-label') || el.textContent || el.tagName || '').trim().slice(0, 50), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((o) => o.w < 44 || o.h < 44);
  });
  expect(smallTargets, `sub-44 targets: ${JSON.stringify(smallTargets)}`).toEqual([]);
});
