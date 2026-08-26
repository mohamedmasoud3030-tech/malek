import { expect, test, type Page } from '@playwright/test';

const viewportMatrix = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
] as const;

const themes = ['light', 'dark'] as const;

const sections = [
  { id: 'accounting', label: 'المحاسبة والرقابة' },
  { id: 'statements', label: 'الكشوف' },
  { id: 'analytics', label: 'التحليلات' },
] as const;

const analyticsViews = [
  'نظرة عامة على الأداء',
  'تحليلات التحصيل',
  'تعتيق المتأخرات',
  'تحليلات المصروفات',
  'تحليلات العقارات',
  'تحليلات الإشغال',
  'تحليلات الصيانة',
] as const;

const accountingViews = [
  'ميزان المراجعة والقوائم',
  'دفتر الأستاذ والشجرة',
  'تسوية الإيرادات',
] as const;

const reconciliationRows = ['1201', '1300', '2000', '2200', '2300'].map((accountNo) => ({
  reconciliation_class: `fixture-${accountNo}`,
  account_no: accountNo,
  account_name: `حساب ${accountNo}`,
  subledger_balance: 100,
  gl_balance: 100,
  variance: 0,
  abs_variance: 0,
  currency: 'OMR',
  reconciliation_status: 'PASS',
  subledger_count: 1,
  gl_count: 1,
}));

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'The explicit reports matrix runs once in Chromium; project-level device coverage remains in readiness-smoke.spec.ts.',
  );
});

async function openFixture(page: Page, theme: (typeof themes)[number]) {
  await page.route('**/rest/v1/rpc/wp05_reconcile_all', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(reconciliationRows),
    });
  });
  await page.addInitScript((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);
  await page.goto('/login?e2e-reports-workspace=1');
  await page.evaluate((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);

  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('main[data-e2e-reports-workspace]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'مركز التقارير والكشوف', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'المحاسبة والرقابة', exact: true }).first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(/المخرجات المحاسبية هنا تعتمد على القيود المرحّلة/)).toBeVisible();
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.documentClientWidth + 1);
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.documentClientWidth + 1);
}

async function selectSection(page: Page, section: (typeof sections)[number]) {
  const tab = page.getByRole('tab', { name: section.label, exact: true }).first();
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

for (const viewport of viewportMatrix) {
  for (const theme of themes) {
    test(`reports workspace ${viewport.name} ${theme} RTL`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFixture(page, theme);

      const editFilters = page.getByRole('button', { name: 'تعديل النطاق' });
      await expect(editFilters).toBeVisible();
      await editFilters.click();

      const sheet = page.getByRole('dialog', { name: 'فلترة نطاق التقرير' });
      await expect(sheet).toBeVisible();
      await page.getByRole('button', { name: 'تطبيق وعرض النتائج' }).click();
      await expect(sheet).toBeHidden();

      for (const section of sections) {
        await selectSection(page, section);
        await assertNoHorizontalOverflow(page);
      }

      await selectSection(page, sections[2]);
      await expect(page.getByText('لوحة القرار', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /كفاءة التحصيل 82%/ })).toBeVisible();
      for (const label of analyticsViews) {
        const tab = page.getByRole('tab', { name: label, exact: true });
        await expect(tab).toBeVisible();
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await assertNoHorizontalOverflow(page);
      }

      await selectSection(page, sections[0]);
      await expect(page.getByText('لوحة القرار', { exact: true })).toHaveCount(0);
      for (const label of accountingViews) {
        const tab = page.getByRole('tab', { name: label, exact: true });
        await expect(tab).toBeVisible();
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await assertNoHorizontalOverflow(page);
      }

      await page.screenshot({
        path: testInfo.outputPath(`reports-workspace-${viewport.name}-${theme}.png`),
        fullPage: true,
      });
    });
  }
}

// The focused accounting workspace intentionally renders one statement action
// set at a time; every visible Print/PDF action must still remain fail-closed
// behind the authoritative reconciliation and document-readiness guards.
test('reports accounting view exposes focused guarded document actions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openFixture(page, 'light');

  const accountingTab = page.getByRole('tab', { name: 'ميزان المراجعة والقوائم', exact: true });
  await expect(accountingTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'ميزان المراجعة', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /طباعة الميزان/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'PDF' })).toHaveCount(1);

  const incomeStatementTab = page.getByRole('tab', { name: 'الأرباح والخسائر', exact: true });
  await incomeStatementTab.click();
  await expect(incomeStatementTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: /طباعة الدخل/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'PDF' })).toHaveCount(1);

  const balanceSheetTab = page.getByRole('tab', { name: 'المركز المالي', exact: true });
  await balanceSheetTab.click();
  await expect(balanceSheetTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: /طباعة المركز المالي/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'PDF' })).toHaveCount(1);
});
