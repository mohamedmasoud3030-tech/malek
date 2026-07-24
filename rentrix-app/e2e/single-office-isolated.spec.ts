import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_SINGLE_OFFICE_EMAIL ?? 'single-office-admin@rentrix.test';
const PASSWORD = process.env.E2E_SINGLE_OFFICE_PASSWORD ?? 'SingleOffice-Aa1!';
const INVOICE_ID = '00000000-0000-0000-0000-000000009801';
const PAYMENT_REFERENCE = 'SO-E2E-001';

test.skip(
  process.env.E2E_ENVIRONMENT_KIND !== 'local' || !process.env.E2E_SINGLE_OFFICE_ENABLED,
  'The single-office lifecycle runs only against the disposable local Supabase gate.',
);

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill(EMAIL);
  await page.getByPlaceholder('••••••••').fill(PASSWORD);
  await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'لوحة التحكم', level: 1 })).toBeVisible();
  await expect(page.getByText('تعذر تحديد الشركة النشطة')).toHaveCount(0);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test.describe('single-office isolated launch acceptance', () => {
  test.describe.configure({ retries: 0 });

  test('runs the real browser invoice → payment → receipt → VOID journey once', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'The mutating journey runs once on desktop.');

    const serverErrors: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
    });

    await login(page);
    await page.goto(`/invoices?invoiceId=${INVOICE_ID}&collect=1`);
    await expect(page.getByRole('heading', { name: 'الفواتير', level: 1 })).toBeVisible();

    const paymentForm = page.locator('#quick-payment-form');
    const amount = paymentForm.locator('#quick-payment-amount');
    await expect(amount).toHaveValue('1000');
    await paymentForm.locator('input[type="date"]').fill('2026-07-25');
    await paymentForm.getByPlaceholder('اختياري').fill(PAYMENT_REFERENCE);
    const paymentResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/rest/v1/rpc/record_invoice_payment_atomic')
    ));
    await paymentForm.getByRole('button', { name: 'تسجيل دفعة' }).click();
    const paymentResponse = await paymentResponsePromise;
    expect(paymentResponse.ok()).toBe(true);

    await page.goto('/receipts');
    await expect(page.getByRole('heading', { name: 'الإيصالات', level: 1 })).toBeVisible();
    await page.getByLabel('بحث في الإيصالات').fill(PAYMENT_REFERENCE);

    const receiptTable = page.getByRole('table', { name: 'جدول الإيصالات' });
    await expect(receiptTable.getByRole('row')).toHaveCount(2);
    const receiptRow = receiptTable.getByRole('row').nth(1);
    await expect(receiptRow).toContainText('مستأجر اختبار المكتب الواحد');
    await expect(receiptRow).toContainText('مرحّل');
    await receiptRow.getByRole('button', { name: 'إلغاء' }).click();

    const dialog = page.getByRole('dialog', { name: /إلغاء الإيصال/ });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('السبب').fill('اختبار إلغاء معزول قبل إطلاق المكتب الأول');
    const voidResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/rest/v1/rpc/void_receipt_atomic')
    ));
    await dialog.getByRole('button', { name: 'تأكيد الإلغاء' }).click();
    const voidResponse = await voidResponsePromise;
    expect(voidResponse.ok()).toBe(true);
    await expect(dialog).toBeHidden();
    await expect(receiptRow).toContainText('ملغي');
    expect(serverErrors).toEqual([]);
  });

  test('opens the core single-office workspaces responsively with real seeded data', async ({ page }) => {
    await login(page);

    const routes = [
      { path: '/properties', heading: 'العقارات', evidence: 'عقار اختبار المكتب الواحد' },
      { path: '/units', heading: 'الوحدات', evidence: 'SO-E2E-1' },
      { path: '/contracts', heading: 'العقود', evidence: 'مستأجر اختبار المكتب الواحد' },
      { path: '/invoices', heading: 'الفواتير', evidence: '#00000000' },
      { path: '/receipts', heading: 'الإيصالات', evidence: 'مستأجر اختبار المكتب الواحد' },
      { path: '/reports', heading: 'التقارير', evidence: 'التقارير' },
      { path: '/maintenance', heading: 'الصيانة', evidence: 'الصيانة' },
      { path: '/settings', heading: null, evidence: 'الإعدادات محفوظة' },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      if (route.heading) {
        await expect(page.getByRole('heading', { name: route.heading, level: 1 })).toBeVisible();
      }
      await expect(page.getByText(route.evidence, { exact: false }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText('تعذر تحديد الشركة النشطة')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    }
  });
});
