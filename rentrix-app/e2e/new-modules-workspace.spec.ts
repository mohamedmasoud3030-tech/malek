import { expect, test } from '@playwright/test';

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
      // Should show KPI cards and filter bar, no mock data like E-902148
      await expect(page.locator('body')).not.toContainText('E-902148');
      await expect(page.locator('body')).not.toContainText('W-441209');
    });

    test(`vault workspace loads with private bucket at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/login?e2e-vault-workspace=1');
      await expect(page.locator('[data-e2e-vault-workspace]')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('خزينة المستندات')).toBeVisible();
      // Should frame the vault as private storage, not placehold.co mocks
      await expect(page.locator('body')).not.toContainText('placehold.co');
      await expect(page.getByText('التخزين الخاص', { exact: true })).toBeVisible();
      await expect(page.getByText('مساحة آمنة')).toBeVisible();
    });

    test(`deposits workspace loads with real ledger at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/login?e2e-deposits-workspace=1');
      await expect(page.locator('[data-e2e-deposits-workspace]')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('دفتر أمانات وتأمينات المستأجرين')).toBeVisible();
      // Should not contain mock dep-101
      await expect(page.locator('body')).not.toContainText('dep-101');
      await expect(page.getByText('تسجيل وديعة جديدة')).toBeVisible();
    });

    test(`automation workspace loads with real execution at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto('/login?e2e-automation-workspace=1');
      await expect(page.locator('[data-e2e-automation-workspace]')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('heading', { name: 'قواعد الأتمتة' })).toBeVisible();
      // Should show real rules, not local-preview only message
      await expect(page.locator('body')).not.toContainText('لم يتم تشغيل عامل أتمتة خارجي');
    });
  }

  test('vault upload form validates and shows the 5MB signed-URL notice', async ({ page }) => {
    await page.goto('/login?e2e-vault-workspace=1');
    await expect(page.locator('[data-e2e-vault-workspace]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('رفع مستند جديد')).toBeVisible();
    await expect(page.getByText('الأنواع المدعومة: PDF، JPEG، PNG، WebP')).toBeVisible();
    await expect(page.getByText('الحد الأقصى 5MB')).toBeVisible();
    const fileInput = page.locator('[data-e2e-vault-workspace] input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', 'application/pdf,image/jpeg,image/png,image/webp');
  });

  test('deposits shows balance guards and no false success', async ({ page }) => {
    await page.goto('/login?e2e-deposits-workspace=1');
    await expect(page.getByText('مسار مالي حقيقي مع سجل غير قابل للتلاعب')).toBeVisible();
    await expect(page.getByText('منع تجاوز الرصيد')).toBeVisible();
  });

  test('automation shows scheduling, duplicate prevention, and WhatsApp preview links', async ({ page }) => {
    await page.goto('/login?e2e-automation-workspace=1');
    await expect(page.getByText('قواعد محفوظة في قاعدة البيانات')).toBeVisible();
    await expect(page.getByText('منع تكرار').first()).toBeVisible();

    const whatsappPreview = page.getByRole('link', { name: 'معاينة واتساب' }).first();
    await expect(whatsappPreview).toBeVisible();
    const href = await whatsappPreview.getAttribute('href');
    expect(href).toContain('https://wa.me/');
    expect(decodeURIComponent(href?.split('text=')[1] ?? '')).toContain('مرحباً');
  });
});
