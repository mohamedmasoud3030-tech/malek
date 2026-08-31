import { expect, test } from '@playwright/test';

const fixtureUrl = '/login?e2e-service-providers-workspace=1';

test.describe('Service Providers workspace', () => {
  test('renders the Arabic register and provider operations without horizontal overflow', async ({ page }) => {
    await page.goto(fixtureUrl);
    const workspace = page.locator('[data-e2e-service-providers]');
    await expect(workspace).toBeVisible();
    await expect(page.getByRole('heading', { name: 'مزودو الخدمات' })).toBeVisible();
    await expect(page.getByText('شركة الأفق للتبريد', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('التكييف والتبريد', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    const openJobsMetric = page
      .getByRole('region', { name: 'ملخص مزودي الخدمات' })
      .getByRole('article')
      .filter({ hasText: 'أعمال جارية' });
    await expect(openJobsMetric.getByText('2', { exact: true })).toBeVisible();
    await expect(openJobsMetric).toContainText('مفتوحة أو قيد التنفيذ');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });

  test('opens and closes the accessible create workflow', async ({ page }) => {
    await page.goto(fixtureUrl);
    await page.getByRole('button', { name: 'إضافة مزود' }).click();
    const dialog = page.getByRole('dialog', { name: 'إضافة مزود خدمة' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('اسم مزود الخدمة')).toBeVisible();
    await expect(dialog.getByText('التكييف والتبريد')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('filters the register by active state and keeps 44px actions', async ({ page }) => {
    await page.goto(fixtureUrl);
    await page.getByLabel('تصفية مزودي الخدمات حسب الحالة').selectOption('inactive');

    await expect(page.getByText('مؤسسة الحلول السريعة', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('شركة الأفق للتبريد', { exact: true }).filter({ visible: true })).toHaveCount(0);

    let menuTrigger = page.locator('[data-action-menu-trigger]').filter({ visible: true }).first();
    if (await menuTrigger.count() === 0) {
      const mobileTrigger = page.locator('[data-entity-table-mobile-actions]').filter({ visible: true }).first();
      await expect(mobileTrigger).toBeVisible();
      const mobileTriggerBox = await mobileTrigger.boundingBox();
      expect(mobileTriggerBox?.height ?? 0).toBeGreaterThanOrEqual(44);
      await mobileTrigger.click();
      menuTrigger = page.locator('[data-action-menu-trigger]').filter({ visible: true }).first();
    }

    await expect(menuTrigger).toBeVisible();
    const triggerBox = await menuTrigger.boundingBox();
    expect(triggerBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await menuTrigger.click();
    await expect(page.getByRole('menuitem', { name: 'عرض', exact: true }).filter({ visible: true }).first()).toBeVisible();
  });
});
