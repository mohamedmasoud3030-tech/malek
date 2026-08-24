import { expect, test } from '@playwright/test';
import { installFakeSupabaseBackend } from './support/fake-supabase-backend';

const viewports = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
] as const;

test.describe('New Real Modules - Utilities, Vault, Deposits, Automation', () => {
  for (const vp of viewports) {
    test(`utilities workspace loads at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/login?e2e-utilities-workspace=1');
      await expect(page.locator('[data-e2e-utilities-workspace]')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('إدارة المرافق والعدادات')).toBeVisible();
      await expect(page.locator('body')).not.toContainText('E-902148');
      await expect(page.locator('body')).not.toContainText('W-441209');
    });

    test(`vault workspace loads with private storage controls at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      // This is a login-route E2E fixture. Seeding an authenticated session here
      // correctly triggers authRoute's production redirect to /dashboard before
      // the fixture can mount. The fake Supabase HTTP boundary is sufficient for
      // this isolated workspace contract; auth behavior is covered separately.
      await installFakeSupabaseBackend(page, 'complete');
      await page.goto('/login?e2e-vault-workspace=1');
      const workspace = page.locator('[data-e2e-vault-workspace]');
      await expect(workspace).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('heading', { name: 'خزينة المستندات والمرفقات' })).toBeVisible();
      await expect(workspace).toContainText('أرشيف خاص');
      await expect(page.locator('body')).not.toContainText('placehold.co');
      await expect(workspace.getByRole('button', { name: 'رفع مستند', exact: true }).first()).toBeVisible();
    });

    test(`deposits workspace loads with the real governed ledger at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/login?e2e-deposits-workspace=1');
      const workspace = page.locator('[data-e2e-deposits-workspace]');
      await expect(workspace).toBeVisible({ timeout: 10000 });
      await expect(workspace.getByRole('heading', { name: 'تأمينات المستأجرين' })).toBeVisible();
      await expect(page.locator('body')).not.toContainText('dep-101');
      await expect(workspace.getByRole('button', { name: 'تسجيل وديعة جديدة' })).toBeVisible();
    });

    test(`automation workspace loads with real execution at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/login?e2e-automation-workspace=1');
      await expect(page.locator('[data-e2e-automation-workspace]')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('heading', { name: 'قواعد الأتمتة' })).toBeVisible();
      await expect(page.locator('body')).not.toContainText('لم يتم تشغيل عامل أتمتة خارجي');
    });
  }

  test('vault upload form validates the current private-file contract', async ({ page }) => {
    await installFakeSupabaseBackend(page, 'complete');
    await page.goto('/login?e2e-vault-workspace=1');
    const workspace = page.locator('[data-e2e-vault-workspace]');
    await expect(workspace).toBeVisible({ timeout: 10000 });
    await workspace.getByRole('button', { name: 'رفع مستند', exact: true }).first().click();

    const dialog = page.getByRole('dialog', { name: 'رفع مستند' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('الحد الأقصى 5MB');
    await expect(dialog).toContainText('PDF أو JPEG أو PNG أو WebP');
    const fileInput = dialog.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', 'application/pdf,image/jpeg,image/png,image/webp');
    await expect(dialog.getByRole('button', { name: 'رفع', exact: true })).toBeDisabled();
  });

  test('deposits create flow is guarded and cannot report false success before valid input', async ({ page }) => {
    await page.goto('/login?e2e-deposits-workspace=1');
    const workspace = page.locator('[data-e2e-deposits-workspace]');
    await expect(workspace).toBeVisible({ timeout: 10000 });
    await workspace.getByRole('button', { name: 'تسجيل وديعة جديدة' }).click();

    const dialog = page.getByRole('dialog', { name: 'تسجيل وديعة تأمين جديدة' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('RPC ذري مع قيد محاسبي');
    await expect(dialog.getByRole('button', { name: 'حفظ الوديعة' })).toBeDisabled();
    await expect(page.locator('body')).not.toContainText('تم تسجيل الوديعة بنجاح');
  });

  test('automation keeps WhatsApp preview-only and never exposes a direct send link', async ({ page }) => {
    await page.goto('/login?e2e-automation-workspace=1');
    await expect(page.getByText('قواعد محفوظة في قاعدة البيانات')).toBeVisible();
    await expect(page.getByText('منع تكرار').first()).toBeVisible();

    // Current product policy is preview-only: no direct wa.me action is exposed
    // from Automation until the external channel is explicitly approved.
    await expect(page.locator('a[href^="https://wa.me/"]')).toHaveCount(0);
    await expect(page.locator('body')).toContainText('معاينة محلية فقط · لا يوجد إرسال خارجي');
  });
});