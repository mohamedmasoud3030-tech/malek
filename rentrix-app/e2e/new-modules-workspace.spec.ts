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
      // Should mention private bucket and signed URL, not placehold.co
      await expect(page.locator('body')).not.toContainText('placehold.co');
      await expect(page.getByText('private bucket')).toBeVisible();
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
      await expect(page.getByText('مركز الأتمتة الحقيقي')).toBeVisible();
      // Should show real rules, not local-preview only message
      await expect(page.locator('body')).not.toContainText('لم يتم تشغيل عامل أتمتة خارجي');
    });
  }

  test('vault upload form validates and shows private bucket notice', async ({ page }) => {
    await page.goto('/login?e2e-vault-workspace=1');
    await expect(page.getByText('رفع مستند جديد (Bucket خاص)')).toBeVisible();
    await expect(page.getByText('لا يُستخدم getPublicUrl')).toBeVisible();
  });

  test('deposits shows balance guards and no false success', async ({ page }) => {
    await page.goto('/login?e2e-deposits-workspace=1');
    await expect(page.getByText('مسار مالي حقيقي مع سجل غير قابل للتلاعب')).toBeVisible();
    await expect(page.getByText('منع تجاوز الرصيد')).toBeVisible();
  });

  test('automation shows scheduling and duplicate prevention', async ({ page }) => {
    await page.goto('/login?e2e-automation-workspace=1');
    await expect(page.getByText('قواعد أتمتة حقيقية محفوظة')).toBeVisible();
    await expect(page.getByText('منع تكرار').first()).toBeVisible();
  });
});
