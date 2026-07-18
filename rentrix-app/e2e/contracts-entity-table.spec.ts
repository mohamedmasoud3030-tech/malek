import { expect, test } from '@playwright/test';

test.describe('contracts EntityTable workspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login?e2e-showcase-contracts=1');
    await expect(page.locator('main[data-e2e-contracts-workspace]')).toBeVisible();
  });

  test('uses the desktop table and keeps keyboard row expansion', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop EntityTable contract');

    const table = page.getByRole('table', { name: 'جدول العقود' });
    await expect(table).toBeVisible();

    const firstDataRow = table.getByRole('row').nth(1);
    await firstDataRow.focus();
    await firstDataRow.press('Enter');
    await expect(page.getByText('بيانات المستأجر').first()).toBeVisible();
  });

  test('uses the shared mobile card renderer', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile', 'Mobile EntityTable contract');

    const list = page.getByRole('list', { name: 'جدول العقود' });
    await expect(list).toBeVisible();
    await expect(list.getByRole('listitem')).toHaveCount(7);
    await expect(page.getByRole('table', { name: 'جدول العقود' })).toBeHidden();
  });
});
