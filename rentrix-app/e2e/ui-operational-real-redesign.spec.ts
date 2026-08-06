import { expect, test, type Page } from '@playwright/test';

const fixtures = {
  properties: {
    url: '/login?e2e-showcase-properties=1',
    ready: '[data-e2e-properties-workspace]',
    summary: '[data-property-summary]',
    register: '[data-property-register]',
  },
  contracts: {
    url: '/login?e2e-showcase-contracts=1',
    ready: '[data-e2e-contracts-workspace]',
    summary: '[data-contract-summary]',
    register: '[data-contract-register]',
  },
  maintenance: {
    url: '/login?e2e-showcase-maintenance=1',
    ready: '[data-e2e-maintenance-workspace]',
    summary: '[data-maintenance-summary]',
    register: '[data-maintenance-register]',
  },
} as const;

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test.setTimeout(120_000);

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'The operational evidence matrix runs once in Chromium; shared readiness covers the other configured projects.',
  );
});

async function applyTheme(page: Page, theme: 'light' | 'dark', operationalRoute = false) {
  await page.addInitScript(
    ({ selectedTheme, markOperational }) => {
      document.documentElement.dataset.theme = selectedTheme;
      document.documentElement.dir = 'rtl';
      if (markOperational) {
        document.documentElement.dataset.operationalRoute = 'true';
      }
    },
    { selectedTheme: theme, markOperational: operationalRoute },
  );
}

async function openFixture(
  page: Page,
  fixture: (typeof fixtures)[keyof typeof fixtures],
  theme: 'light' | 'dark',
) {
  await applyTheme(page, theme, true);
  await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
  await page.evaluate((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dataset.operationalRoute = 'true';
    document.documentElement.dir = 'rtl';
  }, theme);
  await expect(page.locator(fixture.ready)).toBeVisible();
  await expect(page.locator(fixture.summary)).toBeVisible();
  await expect(page.locator(fixture.register)).toBeVisible();
}

async function openOperationalFormFixture(page: Page, theme: 'light' | 'dark') {
  await applyTheme(page, theme);
  await page.goto('/login?e2e-form-contract=1&surface=bottom-sheet', {
    waitUntil: 'domcontentloaded',
  });
  await page.evaluate((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);
  await expect(page.locator('main[data-e2e-form-contract]')).toBeAttached();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(metrics.html, `${label}: html overflow`).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.body, `${label}: body overflow`).toBeLessThanOrEqual(metrics.viewport + 1);
}

for (const [name, fixture] of Object.entries(fixtures)) {
  for (const viewport of [
    { width: 375, height: 844, theme: 'light' as const },
    { width: 1440, height: 1000, theme: 'dark' as const },
  ]) {
    test(`${name} exposes the real command panel and register at ${viewport.width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFixture(page, fixture, viewport.theme);
      await expect(page.locator('[data-operational-route="true"], html[data-operational-route="true"]')).toBeAttached();
      await expectNoHorizontalOverflow(page, `${name}@${viewport.width}`);
      await page.screenshot({
        path: testInfo.outputPath(`${name}-${viewport.width}-${viewport.theme}.png`),
        fullPage: true,
      });
    });
  }
}

test('operational create form is a Bottom Sheet on mobile with visible actions', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await openOperationalFormFixture(page, 'light');

  const bottomSheet = page.locator('[data-bottom-sheet]');
  const formSurface = page.locator(
    '[data-entity-form-surface="bottom-sheet"][data-entity-form-variant="operational"]',
  );
  await expect(bottomSheet).toBeVisible();
  await expect(formSurface).toBeVisible();
  await expect(page.locator('[data-entity-form-surface="full-page"]')).toHaveCount(0);
  await expect(bottomSheet.getByRole('heading', { name: 'إضافة جهة اتصال' })).toBeVisible();
  await expect(formSurface.locator('[data-entity-form-actions]')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'operational create bottom sheet');

  const sheetBox = await bottomSheet.boundingBox();
  expect(sheetBox).not.toBeNull();
  expect(sheetBox!.width).toBeLessThanOrEqual(375);
  expect(sheetBox!.height).toBeLessThanOrEqual(844);

  await page.screenshot({
    path: testInfo.outputPath('operational-create-375-bottom-sheet.png'),
    fullPage: true,
  });
});

test('operational create form remains a Dialog on desktop', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openOperationalFormFixture(page, 'dark');

  const dialog = page.locator(
    '[data-entity-form-surface="dialog"][data-entity-form-variant="operational"]',
  );
  await expect(dialog).toBeVisible();
  await expect(page.locator('[data-bottom-sheet]')).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: 'إضافة جهة اتصال' })).toBeVisible();
  await expect(dialog.locator('[data-entity-form-actions]')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'operational create desktop dialog');

  await page.screenshot({
    path: testInfo.outputPath('operational-create-1440-dialog.png'),
    fullPage: true,
  });
});
