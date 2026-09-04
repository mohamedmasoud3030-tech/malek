import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_SINGLE_OFFICE_EMAIL ?? 'single-office-admin@rentrix.test';
const PASSWORD = process.env.E2E_SINGLE_OFFICE_PASSWORD ?? 'SingleOffice-Aa1!';
const CHECKER_EMAIL = process.env.E2E_SINGLE_OFFICE_CHECKER_EMAIL ?? 'single-office-checker@rentrix.test';
const CHECKER_PASSWORD = process.env.E2E_SINGLE_OFFICE_CHECKER_PASSWORD ?? PASSWORD;
const INVOICE_ID = '00000000-0000-0000-0000-000000009801';
const PAYMENT_REFERENCE = 'SO-E2E-001';
// Deterministic, date-rot-safe payment date inside the current OPEN fixture
// period (matches the single-office seed).
function iso(d: Date) { return d.toISOString().slice(0, 10); }
const now = new Date();
const PAYMENT_DATE = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(5, now.getUTCDate()))));

test.skip(
  !['local', 'qa'].includes(process.env.E2E_ENVIRONMENT_KIND ?? '')
    || !process.env.E2E_SINGLE_OFFICE_ENABLED
    || (process.env.E2E_ENVIRONMENT_KIND === 'qa' && process.env.QA_MUTATION_APPROVED !== '1'),
  'The single-office lifecycle runs only against local or an explicitly approved disposable QA environment.',
);

async function login(page: Page, email = EMAIL, password = PASSWORD) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true }).fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'اليوم', level: 1 })).toBeVisible();
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

  test('runs the real browser invoice → payment → receipt → VOID request journey once', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'The mutating journey runs once on desktop.');

    const serverErrors: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
    });

    await login(page);
    await page.goto(`/financials?section=collections&view=invoices&invoiceId=${INVOICE_ID}&collect=1`);

    const paymentForm = page.locator('#quick-payment-form');
    await expect(paymentForm).toBeVisible({ timeout: 15000 });
    const amount = paymentForm.locator('#quick-payment-amount');
    await expect(amount).toHaveValue('1000', { timeout: 15000 });
    await paymentForm.locator('#quick-payment-date').fill(PAYMENT_DATE);
    await paymentForm.locator('#quick-payment-reference').fill(PAYMENT_REFERENCE);
    const paymentResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/rest/v1/rpc/record_invoice_payment_atomic')
    ));
    await paymentForm.getByRole('button', { name: 'تسجيل دفعة' }).click();
    const paymentResponse = await paymentResponsePromise;
    expect(paymentResponse.ok()).toBe(true);

    await page.goto('/receipts');
    const searchInput = page.getByPlaceholder('رقم الإيصال أو المرجع أو المستأجر أو العقار');
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill(PAYMENT_REFERENCE);

    const receiptTable = page.getByRole('table', { name: 'جدول الإيصالات' });
    await expect(receiptTable).toBeVisible({ timeout: 15000 });
    const receiptRow = receiptTable.getByRole('row').filter({ hasText: 'مستأجر اختبار المكتب الواحد' }).first();
    await expect(receiptRow).toBeVisible({ timeout: 15000 });
    await expect(receiptRow).toContainText('مرحّل');
    await receiptRow.getByRole('button', { name: 'طلب إلغاء' }).click();

    const dialog = page.getByRole('dialog').filter({ hasText: 'طلب إلغاء الإيصال' });
    await expect(dialog).toBeVisible({ timeout: 15000 });
    const reasonInput = dialog.getByPlaceholder('مثال: خطأ في المبلغ أو دفعة مكررة');
    await expect(reasonInput).toBeVisible({ timeout: 15000 });
    await reasonInput.fill('اختبار إلغاء معزول قبل إطلاق المكتب الأول');

    const voidResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/rest/v1/rpc/request_receipt_void_atomic')
    ));
    await dialog.getByRole('button', { name: 'إرسال طلب الإلغاء' }).click();
    const voidResponse = await voidResponsePromise;
    expect(voidResponse.ok()).toBe(true);
    await expect(dialog).toBeHidden();
    await expect(receiptRow).toContainText('مرحّل');
    await expect(page.getByText('اختبار إلغاء معزول قبل إطلاق المكتب الأول')).toBeVisible();

    // Exercise the separate checker half of the maker-checker boundary through
    // the real browser as well. Clearing browser storage signs out the maker;
    // the checker identity was created by the isolated seed script.
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.context().clearCookies();
    await login(page, CHECKER_EMAIL, CHECKER_PASSWORD);
    await page.goto('/receipts');

    const pendingRequest = page.getByText('اختبار إلغاء معزول قبل إطلاق المكتب الأول').first();
    await expect(pendingRequest).toBeVisible({ timeout: 15000 });
    const approveResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/rest/v1/rpc/approve_receipt_void_atomic')
    ));
    await page.getByRole('button', { name: 'اعتماد وتنفيذ الإلغاء' }).click();
    const approveResponse = await approveResponsePromise;
    expect(approveResponse.ok()).toBe(true);
    await expect(page.getByText('اختبار إلغاء معزول قبل إطلاق المكتب الأول')).toHaveCount(0);

    const checkerSearchInput = page.getByPlaceholder('رقم الإيصال أو المرجع أو المستأجر أو العقار');
    await checkerSearchInput.fill(PAYMENT_REFERENCE);
    const voidedReceiptRow = page.getByRole('table', { name: 'جدول الإيصالات' })
      .getByRole('row').filter({ hasText: 'مستأجر اختبار المكتب الواحد' }).first();
    await expect(voidedReceiptRow).toContainText('ملغي');
    expect(serverErrors).toEqual([]);
  });

  test('opens the core single-office workspaces responsively with real seeded data', async ({ page }) => {
    await login(page);

    const routes = [
      { path: '/properties', evidence: 'عقار اختبار المكتب الواحد' },
      { path: '/properties?section=units', evidence: 'SO-E2E-1' },
      { path: '/contracts', evidence: 'مستأجر اختبار المكتب الواحد' },
      { path: '/financials?section=collections&view=invoices', evidence: 'الفواتير' },
      { path: '/financials?section=collections&view=receipts', evidence: 'الإيصالات' },
      { path: '/reports', evidence: 'التقارير' },
      { path: '/maintenance', evidence: 'الصيانة' },
      { path: '/settings', evidence: 'الإعدادات' },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.getByText(route.evidence, { exact: false }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText('تعذر تحديد الشركة النشطة')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    }
  });
});
