import { expect, test, type Page } from '@playwright/test';
import { installFakeSupabaseBackend } from './support/fake-supabase-backend';
import { installAcceptanceBrowser } from './support/document-acceptance-session';

/**
 * Browser acceptance for the contextual Documents Vault section.
 *
 * The canonical deep link is `/maintenance?section=documents_vault` inside the
 * Services hub: the vault is intentionally not a routine primary tab, and the
 * former `/documents-vault` standalone URL alias is retired. This matches the
 * canonical contextual-documents contract — deep links stay valid through the
 * hub without promoting a global vault beside daily Maintenance / Utilities.
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

test.describe('Documents Vault contextual section', () => {
  test('canonical Services deep link renders the real contextual documents section', async ({ page }) => {
    const consoleErrors = watchConsoleErrors(page);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto('/maintenance?section=documents_vault', { waitUntil: 'domcontentloaded' });

    // 1. URL stays at the single Services authority.
    await expect(page).toHaveURL(/\/maintenance\?section=documents_vault(?:&|$)/);

    // 2. Documents Vault UI is rendered as the embedded cross-entity index,
    //    not the maintenance fallback. Upload belongs to the owning entity and
    //    therefore must not be offered from this global index.
    const vaultSection = page.locator('[data-operations-section="documents_vault"]');
    await expect(vaultSection).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'خزينة المستندات والمرفقات' })).toHaveCount(0);
    await expect(vaultSection.getByLabel('بحث في فهرس المستندات')).toBeVisible();
    await expect(vaultSection.getByRole('button', { name: 'رفع مستند', exact: true })).toHaveCount(0);
    await expect(vaultSection.locator('input[type="file"]')).toHaveCount(0);

    // 3. Contextual/deep-link sections intentionally do not render the daily
    // Services tab strip. They stay reachable without competing with the
    // routine Maintenance / Utilities navigation.
    await expect(page.getByRole('tab', { name: 'المستندات التشغيلية' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'الصيانة' })).toHaveCount(0);
    await expect(page.locator('[data-operations-section="maintenance"]')).toHaveCount(0);

    // 4. No unexpected console errors or failed requests.
    const unexpected = consoleErrors.filter((text) => !isExpectedHermeticNoise(text));
    expect(unexpected).toEqual([]);
  });

  test('contextual documents and routine Maintenance switch cleanly on the hub URL', async ({ page }) => {
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto('/maintenance?section=documents_vault', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/maintenance\?section=documents_vault(?:&|$)/);
    await expect(page.locator('[data-operations-section="documents_vault"]')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'الصيانة' })).toHaveCount(0);

    // Explicitly enter the routine Services workspace. Its primary tab strip
    // is restored and follows the URL authority.
    await page.goto('/maintenance?section=maintenance', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/maintenance\?section=maintenance(?:&|$)/);
    await expect(page.locator('[data-operations-section="maintenance"]')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'الصيانة' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'المرافق والعدادات' })).toBeVisible();

    // The canonical deep link still resolves back to the contextual section,
    // again without surfacing a specialist documents tab in routine nav.
    await page.goto('/maintenance?section=documents_vault', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/maintenance\?section=documents_vault(?:&|$)/);
    await expect(page.locator('[data-operations-section="documents_vault"]')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'المستندات التشغيلية' })).toHaveCount(0);
  });
});
