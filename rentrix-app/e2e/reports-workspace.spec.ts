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

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'The explicit reports matrix runs once in Chromium; project-level device coverage remains in readiness-smoke.spec.ts.',
  );
});

async function openFixture(page: Page, theme: (typeof themes)[number]) {
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
  await expect(page.getByText('لوحة القرار', { exact: true })).toBeVisible();
  // The fixture's authoritative server-model rate is 82%. Assert through the
  // KPI's accessible name so the proof survives the presentational trend glyph
  // (`– كفاءة 82%`) while still verifying the user-facing financial semantic.
  await expect(page.getByRole('button', { name: /كفاءة التحصيل 82%/ })).toBeVisible();
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

async function selectSection(page: Page, width: number, section: (typeof sections)[number]) {
  if (width < 640) {
    const select = page.locator('#reports-section-select');
    await expect(select).toBeVisible();
    await select.selectOption(section.id);
    await expect(select).toHaveValue(section.id);
    return;
  }

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
        await selectSection(page, viewport.width, section);
        await assertNoHorizontalOverflow(page);
      }

      await selectSection(page, viewport.width, sections[2]);
      for (const label of analyticsViews) {
        const tab = page.getByRole('tab', { name: label, exact: true });
        await expect(tab).toBeVisible();
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await assertNoHorizontalOverflow(page);
      }

      await selectSection(page, viewport.width, sections[0]);
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

test('reports accounting view exposes working scoped PDF actions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openFixture(page, 'light');

  const accountingTab = page.getByRole('tab', { name: 'ميزان المراجعة والقوائم', exact: true });
  await expect(accountingTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'ميزان المراجعة', exact: true })).toBeVisible();

  await expect(page.getByRole('button', { name: /طباعة الميزان/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /طباعة الدخل/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /طباعة المركز المالي/ })).toBeEnabled();

  const pdfButtons = page.getByRole('button', { name: 'PDF' });
  await expect(pdfButtons).toHaveCount(3);
  await expect(pdfButtons.first()).toBeEnabled();
});