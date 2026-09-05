import { expect, test } from '@playwright/test';

test.describe('contracts EntityTable workspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login?e2e-showcase-contracts=1');
    await expect(page.locator('main[data-e2e-contracts-workspace]')).toBeVisible();
  });

  test('uses the desktop table and opens the preview from the keyboard', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop EntityTable contract');

    const table = page.getByRole('table', { name: 'جدول العقود' });
    await expect(table).toBeVisible();

    const firstDataRow = table.getByRole('row').nth(1);
    // Rows are the activation surface, so the row itself must take focus.
    await expect(firstDataRow).toHaveAttribute('tabindex', '0');

    // Read the identity of the row under test from the rendered table so the
    // assertions below prove that *this* row was activated, not that some
    // dialog happened to exist.
    const activatedRow = await firstDataRow.evaluate((row) => {
      const headers = Array.from(row.closest('table')?.querySelectorAll('thead th') ?? []).map((head) => head.textContent?.trim() ?? '');
      const cells = row.querySelectorAll('td');
      const cellFor = (label: string): string | null => {
        const index = headers.findIndex((header) => header.includes(label));
        if (index < 0) return null;
        return cells[index]?.textContent?.trim() || null;
      };
      return { contract: cellFor('العقد رقم'), tenant: cellFor('المستأجر') };
    });
    expect(activatedRow.contract, 'activated row shows a contract reference').toBeTruthy();
    expect(activatedRow.tenant, 'activated row shows a tenant').toBeTruthy();

    await firstDataRow.focus();
    await firstDataRow.press('Enter');

    // Quick Preview is the canonical activation target for a contract row and
    // its accessible name is the contract reference.
    const dialog = page.getByRole('dialog', { name: activatedRow.contract! });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('المستأجر').first()).toBeVisible();
    await expect(dialog.getByText(activatedRow.tenant!).first()).toBeVisible();

    // Keyboard activation must be reversible without a pointer.
    await expect(dialog.getByRole('button', { name: 'فتح العقد بالكامل' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('uses the shared mobile card renderer', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile', 'Mobile EntityTable contract');

    const list = page.getByRole('list', { name: 'جدول العقود' });
    await expect(list).toBeVisible();
    await expect(list.getByRole('listitem')).toHaveCount(7);
    await expect(page.getByRole('table', { name: 'جدول العقود' })).toBeHidden();
  });
});
