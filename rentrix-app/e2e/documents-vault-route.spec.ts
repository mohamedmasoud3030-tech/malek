import { expect, test, type Page } from '@playwright/test';
import { installFakeSupabaseBackend } from './support/fake-supabase-backend';
import { installAcceptanceBrowser } from './support/document-acceptance-session';

/**
 * Browser acceptance for the WP-06A Documents Vault route consolidation.
 *
 * Proves that /documents-vault redirects once to the real Operations Hub
 * documents_vault section and that the section renders (not the default
 * maintenance fallback), with URL and active tab staying synchronized across
 * desktop and mobile. The production route tree, hub workspace and
 * DocumentsVaultWorkspace run unchanged; only the Supabase HTTP boundary is
 * replaced by the strict, fail-closed seeded backend shared with the document
 * acceptance suite.
 */

function watchConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

function isExpectedHermeticNoise(text: string): boolean {
  // Realtime websocket cannot resolve in the hermetic backend; the seeded
  // session still boots the realtime client.
  return text.includes('realtime/v1/websocket') && text.includes('ERR_NAME_NOT_RESOLVED');
}

test.describe('Documents Vault route consolidation', () => {
  test('/documents-vault redirects to the real documents_vault section', async ({ page }) => {
    const consoleErrors = watchConsoleErrors(page);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto('/documents-vault', { waitUntil: 'domcontentloaded' });

    // 1. Final URL is the single authority.
    await expect(page).toHaveURL(/\/maintenance\?section=documents_vault(?:&|$)/);

    // 2. Documents Vault UI is rendered (embedded DocumentsVaultWorkspace),
    //    not the maintenance fallback. The shared Wave 4 workspace uses the
    //    concise "رفع مستند" action in both populated and empty states.
    const vaultSection = page.locator('[data-operations-section="documents_vault"]');
    await expect(vaultSection).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'خزينة المستندات والمرفقات' })).toHaveCount(0); // embedded: no duplicate header
    await expect(vaultSection.getByRole('button', { name: 'رفع مستند', exact: true }).first()).toBeVisible();

    // 3. Maintenance is not the active section.
    await expect(page.getByRole('tab', { name: 'المستندات التشغيلية' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'الصيانة' })).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('[data-operations-section="maintenance"]')).toHaveCount(0);

    // 7. No unexpected console errors or failed requests.
    const unexpected = consoleErrors.filter((text) => !isExpectedHermeticNoise(text));
    expect(unexpected).toEqual([]);
  });

  test('URL and active tab stay synchronized across Documents Vault and Maintenance', async ({ page }) => {
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto('/documents-vault', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/maintenance\?section=documents_vault(?:&|$)/);
    await expect(page.locator('[data-operations-section="documents_vault"]')).toBeVisible();

    // Switch to Maintenance.
    await page.getByRole('tab', { name: 'الصيانة' }).click();
    await expect(page).toHaveURL(/\/maintenance\?section=maintenance(?:&|$)/);
    await expect(page.locator('[data-operations-section="maintenance"]')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'الصيانة' })).toHaveAttribute('aria-selected', 'true');

    // Switch back to operational documents.
    await page.getByRole('tab', { name: 'المستندات التشغيلية' }).click();
    await expect(page).toHaveURL(/\/maintenance\?section=documents_vault(?:&|$)/);
    await expect(page.locator('[data-operations-section="documents_vault"]')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'المستندات التشغيلية' })).toHaveAttribute('aria-selected', 'true');
  });
});
