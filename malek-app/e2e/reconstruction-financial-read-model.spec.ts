import { expect, test } from '@playwright/test';
import { installAcceptanceBrowser } from './support/document-acceptance-session';
import { installFakeSupabaseBackend } from './support/fake-supabase-backend';

// Real route -> permissions -> invoice query -> row action -> collection form.
// Only HTTP is mocked; no payment is submitted or persisted.
for (const width of [1440, 390]) {
  test(`VAT and posted credits produce the same collection preset at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await installAcceptanceBrowser(page);
    const seed = await installFakeSupabaseBackend(page);
    seed.tables.invoices = [{
      ...seed.tables.invoices[0], reference: 'INV-RECON-001', amount: 100,
      tax_amount: 5, paid_amount: 100, credited_amount: 2, status: 'PARTIALLY_PAID',
    }];
    await page.goto('/financials?section=collections&view=invoices');
    const filter = page.getByRole('region', { name: 'البحث وحالة الفواتير' });
    await expect(filter).toBeVisible();
    if (width >= 640) {
      await filter.getByRole('button', { name: 'الكل', exact: true }).click();
    } else {
      await filter.getByRole('button', { name: 'فلاتر الفواتير', exact: true }).click();
      const sheet = page.getByRole('dialog', { name: 'فلاتر الفواتير' });
      await sheet.getByRole('button', { name: 'الكل', exact: true }).click();
      await page.keyboard.press('Escape');
    }
    const register = page.getByRole('region', { name: 'قائمة الفواتير', exact: true });
    await expect(register.getByText('INV-RECON-001', { exact: true }).first()).toBeVisible();
    if (width >= 640) {
      await register.getByRole('button', { name: 'إجراءات INV-RECON-001', exact: true }).click();
      await page.getByRole('menuitem', { name: 'تحصيل', exact: true }).click();
    } else {
      await register.getByRole('button', { name: /المزيد حول INV-RECON-001/ }).click();
      await page.getByRole('menuitem', { name: 'تحصيل', exact: true }).click();
    }
    await expect(page.locator('#quick-payment-amount')).toHaveValue('3');
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
  });
}
