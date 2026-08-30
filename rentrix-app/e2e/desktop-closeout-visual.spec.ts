import { expect, test, type Page } from '@playwright/test';
import { IDS, PROPERTY_TITLE, TENANT_NAME, installFakeSupabaseBackend } from './support/fake-supabase-backend';
import { installAcceptanceBrowser } from './support/document-acceptance-session';

/**
 * Desktop closeout visual pass.
 *
 * Real production routes + authenticated session + fake Supabase boundary.
 * Viewports are actual laptop/desktop sizes — not phone “Desktop site”.
 * Tablet/mobile projects are skipped so this file cannot regress frozen layouts.
 */

const DESKTOP = 'chromium-desktop';

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
] as const;

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP, 'Desktop closeout runs only on chromium-desktop.');
});

async function prepareAuthenticatedDesktop(page: Page) {
  await installAcceptanceBrowser(page);
  await installFakeSupabaseBackend(page, 'complete');
  await page.addInitScript(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  });
}

async function assertDesktopChrome(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const sidebar = page.locator('[data-sidebar]').first();
  await expect(sidebar).toBeVisible();
  const box = await sidebar.boundingBox();
  expect(box, 'Desktop sidebar must occupy real width, not be collapsed/hidden').not.toBeNull();
  expect((box?.width ?? 0)).toBeGreaterThan(140);
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(
    overflow.documentScrollWidth,
    `document overflow ${overflow.documentScrollWidth} > ${overflow.documentClientWidth}`,
  ).toBeLessThanOrEqual(overflow.documentClientWidth + 2);
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.documentClientWidth + 2);
}

async function capture(page: Page, testInfo: { outputPath: (name: string) => string }, slug: string) {
  await page.screenshot({ path: testInfo.outputPath(`${slug}.png`), fullPage: true });
}

test.describe('desktop closeout visual matrix', () => {
  for (const viewport of VIEWPORTS) {
    test(`dashboard ${viewport.name}`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepareAuthenticatedDesktop(page);
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'لوحة التحكم', level: 1 })).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('[data-dashboard-section]')).toHaveCount(10);
      await assertDesktopChrome(page);
      await assertNoHorizontalOverflow(page);
      await capture(page, testInfo, `dashboard-${viewport.name}`);
    });

    test(`properties register ${viewport.name}`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepareAuthenticatedDesktop(page);
      await page.goto('/properties', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'المحفظة', level: 1 })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(PROPERTY_TITLE).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('[data-entity-table-wrapper]')).toBeVisible();
      await assertDesktopChrome(page);
      await assertNoHorizontalOverflow(page);
      await capture(page, testInfo, `properties-${viewport.name}`);
    });

    test(`contract detail ${viewport.name}`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepareAuthenticatedDesktop(page);
      await page.goto(`/contracts/${IDS.contract}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-contract-detail-workspace]')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(TENANT_NAME).first()).toBeVisible();
      await assertDesktopChrome(page);
      await assertNoHorizontalOverflow(page);
      await capture(page, testInfo, `contract-detail-${viewport.name}`);
    });

    test(`invoices financial + invoice dialog ${viewport.name}`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepareAuthenticatedDesktop(page);
      await page.goto('/invoices', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/financials\?section=collections&view=invoices/);
      await expect(page.getByRole('heading', { name: 'المالية', level: 1 })).toBeVisible({ timeout: 20_000 });
      const register = page.getByRole('table', { name: 'سجل الفواتير' });
      await expect(register).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('button', { name: 'تحصيل فاتورة مسجلة' }).first()).toBeVisible();
      await assertDesktopChrome(page);
      await assertNoHorizontalOverflow(page);
      await capture(page, testInfo, `invoices-${viewport.name}`);

      await page.getByRole('button', { name: 'تحصيل فاتورة مسجلة' }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      await expect(dialog.getByText('تفاصيل الفاتورة وسجل المدفوعات')).toBeVisible();
      const dialogBox = await dialog.boundingBox();
      expect(dialogBox).not.toBeNull();
      expect((dialogBox?.width ?? 0)).toBeGreaterThan(Math.min(720, viewport.width * 0.5));
      expect((dialogBox?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
      await capture(page, testInfo, `invoice-dialog-${viewport.name}`);
      await page.keyboard.press('Escape');
    });

    test(`property create form dialog ${viewport.name}`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepareAuthenticatedDesktop(page);
      await page.goto('/properties/new', { waitUntil: 'domcontentloaded' });
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 20_000 });
      await expect(dialog.locator('input, select, textarea').first()).toBeVisible();
      const dialogBox = await dialog.boundingBox();
      expect(dialogBox).not.toBeNull();
      expect((dialogBox?.width ?? 0)).toBeGreaterThan(420);
      expect((dialogBox?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
      await assertNoHorizontalOverflow(page);
      await capture(page, testInfo, `property-form-${viewport.name}`);
    });
  }
});
