import { expect, test, type Page } from '@playwright/test';

const viewportMatrix = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
] as const;

const themes = ['light', 'dark'] as const;

async function openFixture(page: Page, theme: (typeof themes)[number], surface: 'bottom-sheet' | 'full-page' = 'full-page') {
  await page.addInitScript((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);
  await page.goto(`/login?e2e-form-contract=1&surface=${surface}`);
  await expect(page.getByRole('heading', { name: 'اختبار عقد الفورم المشترك' })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

for (const viewport of viewportMatrix) {
  for (const theme of themes) {
    test(`shared form contract ${viewport.name} ${theme} RTL`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFixture(page, theme);

      const formSurface = page.locator('[data-entity-form-surface]');
      await expect(formSurface).toBeVisible();
      await expect(page.locator('main[data-e2e-form-contract]')).toHaveCSS('direction', 'rtl');
      await assertNoHorizontalOverflow(page);

      await page.getByRole('button', { name: 'حفظ تجريبي' }).click();
      const nameInput = page.getByPlaceholder('اكتب الاسم');
      await expect(page.getByText('الاسم مطلوب')).toBeVisible();
      await expect(nameInput).toBeFocused();

      const lastField = page.locator('[data-e2e-last-field]');
      await lastField.scrollIntoViewIfNeeded();
      await expect(lastField).toBeVisible();

      const geometry = await page.evaluate(() => {
        const last = document.querySelector<HTMLElement>('[data-e2e-last-field]')?.getBoundingClientRect();
        const actions = document.querySelector<HTMLElement>('[data-entity-form-actions]')?.getBoundingClientRect();
        return {
          lastBottom: last?.bottom ?? 0,
          actionsTop: actions?.top ?? Number.POSITIVE_INFINITY,
          viewportHeight: window.innerHeight,
        };
      });
      expect(geometry.lastBottom).toBeLessThanOrEqual(geometry.actionsTop + 1);
      expect(geometry.lastBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);

      await page.screenshot({
        path: testInfo.outputPath(`ux-foundation-${viewport.name}-${theme}.png`),
        fullPage: true,
      });
    });
  }
}

test('bottom sheet follows a reduced visual viewport and keeps actions reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page, 'dark', 'bottom-sheet');

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--visual-viewport-height', '560px');
  });

  const sheet = page.locator('[data-bottom-sheet]');
  await expect(sheet).toBeVisible();
  const sheetBox = await sheet.boundingBox();
  expect(sheetBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(560);

  const lastField = page.locator('[data-e2e-last-field]');
  await lastField.scrollIntoViewIfNeeded();
  await expect(lastField).toBeVisible();
  await assertNoHorizontalOverflow(page);
});