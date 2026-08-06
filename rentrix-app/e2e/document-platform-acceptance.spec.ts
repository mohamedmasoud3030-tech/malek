import { expect, test, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  COMPANY_NAME,
  COMPANY_TAX_NUMBER,
  IDS,
  OWNER_NAME,
  RECEIPT_REFERENCE,
  TENANT_NAME,
  installFakeSupabaseBackend,
} from './support/fake-supabase-backend';
import { installAcceptanceBrowser } from './support/document-acceptance-session';
import { auditDocumentFileName, isA4Portrait, parsePdfArtifact } from './support/pdf-artifact';

/**
 * PR 3 — Browser acceptance for the document/print/PDF platform.
 *
 * These tests drive the REAL production surfaces end to end:
 *   invoice workspace, receipt detail, contract detail, reports statements,
 *   accounting reports → real action handlers → `documentService` →
 *   DocumentEngine → DocumentRenderer → real popup windows and real
 *   application/pdf downloads inspected as artifacts.
 *
 * The only stubbed boundary is the Supabase HTTP API (no live project exists
 * in hermetic CI); the seeded rows mirror `supabase/migrations` shapes.
 */

const DESKTOP = 'chromium-desktop';
const MOBILE = 'chromium-mobile';
const TABLET = 'chromium-tablet';

const POPUP_BLOCKED_MESSAGE = 'تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع ثم إعادة المحاولة.';
const FONT_FAILED_MESSAGE = 'تعذر تحميل الخط العربي المطلوب للطباعة. يرجى إعادة المحاولة أو التحقق من الاتصال بالإنترنت.';
const READINESS_NOTICE = 'أكمل بيانات الشركة الأساسية في الإعدادات قبل طباعة هذا المستند.';

/** Every seeded UUID plus its historical `id.slice(0, 8)` abbreviation. */
const FORBIDDEN_ID_FRAGMENTS = Object.values(IDS).flatMap((id) => [id, id.slice(0, 8)]);

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name === TABLET, 'PR 3 acceptance covers desktop and mobile; tablet coverage stays in the readiness smoke.');
});

/* ------------------------------------------------------------------ */
/* Shared helpers                                                       */
/* ------------------------------------------------------------------ */

async function expectNoUnexpectedConsoleErrors(page: Page, collected: string[]): Promise<void> {
  const allowed = [
    'Supabase environment is incomplete. Runtime diagnostics will be shown in UI.',
    'Failed to load resource',
    'the server responded with a status of',
    'Download the React DevTools',
    '[vite]',
  ];
  const unexpected = collected.filter((text) => !allowed.some((fragment) => text.includes(fragment)));
  expect(unexpected).toEqual([]);
}

function watchConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function openPrintPopup(page: Page, trigger: () => Promise<unknown>): Promise<Page> {
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 30_000 }),
    trigger(),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(popup.locator('html')).toHaveAttribute('lang', 'ar');
  return popup;
}

async function assertPopupIdentity(popup: Page, expectedFragments: readonly string[]): Promise<string> {
  await popup.waitForFunction(() => document.body !== null && (document.body.textContent ?? '').length > 0);
  const bodyText = await popup.evaluate(() => document.body.innerText);
  const title = await popup.title();
  // Real company identity only — never the MALEK product brand fallback.
  expect(bodyText).toContain(COMPANY_NAME);
  expect(title).toContain(COMPANY_NAME);
  expect(bodyText).not.toContain('MALEK');
  expect(title).not.toContain('MALEK');
  for (const fragment of expectedFragments) {
    expect(bodyText).toContain(fragment);
  }
  // A shortened UUID must never surface as a document reference.
  for (const forbidden of FORBIDDEN_ID_FRAGMENTS) {
    expect(bodyText).not.toContain(forbidden);
    expect(title).not.toContain(forbidden);
  }
  return bodyText;
}

async function assertA4PrintContract(popup: Page): Promise<void> {
  const hasA4Rule = await popup.evaluate(() =>
    Array.from(document.querySelectorAll('style')).some((style) => (style.textContent ?? '').includes('size: A4 portrait')),
  );
  expect(hasA4Rule).toBe(true);

  // The renderer must actually invoke the browser print dialog on the popup
  // (intercepted and counted — the native dialog itself is not automatable).
  await popup.waitForFunction(() => (window as unknown as { __printCalls?: number }).__printCalls === 1, undefined, { timeout: 30_000 });
}

async function popupToPdfBuffer(popup: Page): Promise<Buffer> {
  // CDP's printToPDF walks the print lifecycle (beforeprint/afterprint). The
  // production renderer closes the popup on `afterprint`, which would destroy
  // the target mid-capture — neutralize the self-close for the artifact pass.
  await popup.evaluate(() => {
    window.close = () => undefined;
  });
  const session = await popup.context().newCDPSession(popup);
  try {
    const { data } = await session.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
    return Buffer.from(data, 'base64');
  } finally {
    await session.detach().catch(() => undefined);
  }
}

async function downloadPdf(page: Page, trigger: () => Promise<unknown>): Promise<{ download: Download; buffer: Buffer }> {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 120_000 }),
    trigger(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();
  const buffer = await readFile(path ?? '');
  return { download, buffer };
}

function assertRealPdf(buffer: Buffer): ReturnType<typeof parsePdfArtifact> {
  const summary = parsePdfArtifact(buffer);
  expect(summary.hasPdfMagic).toBe(true);
  expect(summary.hasEofMarker).toBe(true);
  expect(summary.pageCount).toBeGreaterThan(0);
  expect(summary.bytes).toBeGreaterThan(10_000);
  return summary;
}

/**
 * Clicks a secondary PageHeader action on any viewport. Desktop renders the
 * button inline; mobile collapses secondary actions into an accessible
 * overflow bottom sheet («إجراءات إضافية») — both are real production paths.
 */
async function clickHeaderSecondaryAction(page: Page, name: string | RegExp): Promise<void> {
  const viewport = page.viewportSize();
  const isMobileWidth = (viewport?.width ?? 1440) < 640;
  if (!isMobileWidth) {
    await page
      .locator('[data-secondary-actions-desktop]')
      .getByRole('button', { name, exact: typeof name === 'string' })
      .click();
    return;
  }
  await page.getByRole('button', { name: 'إجراءات إضافية' }).click();
  await page
    .locator('[data-secondary-actions-mobile]')
    .getByRole('button', { name, exact: typeof name === 'string' })
    .click();
}

async function expectHeaderSecondaryActionDisabled(page: Page, name: string): Promise<void> {
  const viewport = page.viewportSize();
  const isMobileWidth = (viewport?.width ?? 1440) < 640;
  if (!isMobileWidth) {
    await expect(page.locator('[data-secondary-actions-desktop]').getByRole('button', { name, exact: true })).toBeDisabled();
    return;
  }
  await page.getByRole('button', { name: 'إجراءات إضافية' }).click();
  await expect(page.locator('[data-secondary-actions-mobile]').getByRole('button', { name, exact: true })).toBeDisabled();
  await page.locator('[data-secondary-actions-mobile]').getByRole('button', { name: 'إغلاق', exact: true }).click();
}

async function lastProductionDownloadName(page: Page): Promise<string> {
  const names = await page.evaluate(() => (window as unknown as { __downloadNames?: string[] }).__downloadNames ?? []);
  expect(names.length).toBeGreaterThan(0);
  return names[names.length - 1];
}

function reportPanel(page: Page, title: string) {
  return page
    .getByRole('heading', { name: title, exact: true })
    .locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');
}

/* ------------------------------------------------------------------ */
/* 1. Invoice                                                           */
/* ------------------------------------------------------------------ */

test.describe('الفاتورة — invoice acceptance', () => {
  test('print opens a real scoped A4 RTL popup with the true company identity', async ({ page }) => {
    test.setTimeout(90_000);
    const consoleErrors = watchConsoleErrors(page);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto('/invoices');
    await expect(page.getByRole('heading', { name: 'الفواتير', level: 1, exact: true })).toBeVisible();
    const printButton = page.getByRole('button', { name: 'طباعة', exact: true }).first();
    await expect(printButton).toBeVisible({ timeout: 20_000 });

    const popup = await openPrintPopup(page, () => printButton.click());
    await assertPopupIdentity(popup, [TENANT_NAME, '420', 'إيجار شهر يوليو 2026']);
    await assertA4PrintContract(popup);

    // Real print-layout artifact from the actual popup.
    const pdfBuffer = await popupToPdfBuffer(popup);
    const summary = assertRealPdf(pdfBuffer);
    expect(isA4Portrait(summary)).toBe(true);

    await popup.close();
    await expectNoUnexpectedConsoleErrors(page, consoleErrors);
  });

  test('download produces a real PDF artifact with a safe, reference-based file name', async ({ page }) => {
    test.setTimeout(90_000);
    const consoleErrors = watchConsoleErrors(page);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto('/invoices');
    await expect(page.getByRole('heading', { name: 'الفواتير', level: 1, exact: true })).toBeVisible();
    const pdfButton = page.getByRole('button', { name: 'PDF', exact: true }).first();
    await expect(pdfButton).toBeVisible({ timeout: 20_000 });

    const { download, buffer } = await downloadPdf(page, () => pdfButton.click());
    const summary = assertRealPdf(buffer);
    expect(isA4Portrait(summary)).toBe(true);
    expect(summary.pageCount).toBeGreaterThanOrEqual(1);

    const audit = auditDocumentFileName(download.suggestedFilename(), [IDS.invoiceUnpaid, IDS.invoiceUnpaid.slice(0, 8)]);
    expect(audit.passes, `file name must be safe: ${download.suggestedFilename()}`).toBe(true);
    expect(download.suggestedFilename()).toMatch(/^invoice-/);

    await expectNoUnexpectedConsoleErrors(page, consoleErrors);
  });

  test('double-clicking print/PDF never duplicates the operation', async ({ page }) => {
    test.setTimeout(120_000);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto('/invoices');
    await expect(page.getByRole('heading', { name: 'الفواتير', level: 1, exact: true })).toBeVisible();

    const popups: Page[] = [];
    page.context().on('page', (opened) => popups.push(opened));
    const downloads: Download[] = [];
    page.on('download', (download) => downloads.push(download));

    const printButton = page.getByRole('button', { name: 'طباعة', exact: true }).first();
    await expect(printButton).toBeVisible({ timeout: 20_000 });
    await printButton.dblclick();
    // The first render stays in flight for the whole capture window; a second
    // popup would appear immediately if single-flight protection were broken.
    await page.waitForTimeout(2000);
    expect(popups.length).toBe(1);
    const [popup] = popups;
    await popup.waitForLoadState('domcontentloaded');
    await popup.close();

    const pdfButton = page.getByRole('button', { name: 'PDF', exact: true }).first();
    await pdfButton.dblclick();
    await page.waitForEvent('download', { timeout: 120_000 });
    await page.waitForTimeout(2500);
    expect(downloads.length).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Receipt                                                           */
/* ------------------------------------------------------------------ */

test.describe('الإيصال — receipt acceptance', () => {
  test('receipt print and PDF use the real receipt reference, never a UUID slice', async ({ page }) => {
    test.setTimeout(120_000);
    const consoleErrors = watchConsoleErrors(page);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto(`/receipts?receiptId=${IDS.payment}`);
    await expect(page.getByText(RECEIPT_REFERENCE).first()).toBeVisible({ timeout: 20_000 });

    const printButton = page.getByRole('button', { name: /طباعة A4/ });
    await expect(printButton).toBeVisible();
    const popup = await openPrintPopup(page, () => printButton.click());
    await assertPopupIdentity(popup, [RECEIPT_REFERENCE, TENANT_NAME, '441']);
    await assertA4PrintContract(popup);
    const printArtifact = assertRealPdf(await popupToPdfBuffer(popup));
    expect(isA4Portrait(printArtifact)).toBe(true);
    await popup.close();

    const { download, buffer } = await downloadPdf(page, () => clickHeaderSecondaryAction(page, 'تنزيل PDF'));
    const summary = assertRealPdf(buffer);
    expect(isA4Portrait(summary)).toBe(true);

    const audit = auditDocumentFileName(download.suggestedFilename(), [IDS.payment, IDS.payment.slice(0, 8), IDS.receipt, IDS.receipt.slice(0, 8)]);
    expect(audit.passes, `file name must be safe: ${download.suggestedFilename()}`).toBe(true);
    expect(download.suggestedFilename()).toContain(RECEIPT_REFERENCE);

    await expectNoUnexpectedConsoleErrors(page, consoleErrors);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Contract                                                          */
/* ------------------------------------------------------------------ */

test.describe('العقد — contract acceptance', () => {
  test('contract detail prints and exports through the real page actions', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, 'desktop exercises the direct header actions');
    const consoleErrors = watchConsoleErrors(page);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto(`/contracts/${IDS.contract}`);
    await expect(page.getByRole('heading', { name: 'تفاصيل العقد', exact: true })).toBeVisible({ timeout: 20_000 });

    const printButton = page.getByRole('button', { name: 'طباعة', exact: true });
    await expect(printButton).toBeVisible();
    const popup = await openPrintPopup(page, () => printButton.click());
    const bodyText = await assertPopupIdentity(popup, [TENANT_NAME, 'عقد إيجار ساري المفعول', '420']);
    // The page header abbreviates the contract UUID for navigation, but the
    // document itself must never carry that fragment.
    expect(bodyText).not.toContain(IDS.contract.slice(0, 8));
    await assertA4PrintContract(popup);
    const printArtifact = assertRealPdf(await popupToPdfBuffer(popup));
    expect(isA4Portrait(printArtifact)).toBe(true);
    await popup.close();

    const exportButton = page.getByRole('button', { name: 'تصدير PDF', exact: true });
    const { download, buffer } = await downloadPdf(page, () => exportButton.click());
    const summary = assertRealPdf(buffer);
    expect(isA4Portrait(summary)).toBe(true);
    const audit = auditDocumentFileName(download.suggestedFilename(), [IDS.contract, IDS.contract.slice(0, 8)]);
    expect(audit.passes, `file name must be safe: ${download.suggestedFilename()}`).toBe(true);
    expect(download.suggestedFilename()).toMatch(/^contract-/);

    await expectNoUnexpectedConsoleErrors(page, consoleErrors);
  });
});

/* ------------------------------------------------------------------ */
/* 4 & 5. Owner + tenant statements (reports workspace)                 */
/* ------------------------------------------------------------------ */

test.describe('كشوف الحسابات — statements acceptance', () => {
  async function openStatements(page: Page): Promise<void> {
    await page.goto('/reports?section=statements');
    await page.getByRole('button', { name: 'تعديل النطاق' }).click();
    await expect(page.getByLabel('العقد لكشف المستأجر')).toBeVisible({ timeout: 30_000 });
  }

  async function applyReportFilters(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'تطبيق وعرض النتائج' }).click();
    await expect(page.getByLabel('العقد لكشف المستأجر')).toBeHidden({ timeout: 15_000 });
  }

  test('tenant statement prints and downloads as a multi-page A4 PDF', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, 'statements matrix runs on desktop');
    test.setTimeout(120_000);
    const consoleErrors = watchConsoleErrors(page);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await openStatements(page);
    await page.getByLabel('العقد لكشف المستأجر').selectOption(IDS.contract);
    await applyReportFilters(page);
    const tenantPanel = reportPanel(page, 'كشف حساب المستأجر');
    await expect(tenantPanel.getByText('مطالبة إيجار شهر 01/2026 — الوحدة 301').first()).toBeVisible({ timeout: 30_000 });

    const popup = await openPrintPopup(page, () => tenantPanel.getByRole('button', { name: 'طباعة الكشف' }).click());
    await assertPopupIdentity(popup, [TENANT_NAME, 'كشف']);
    await assertA4PrintContract(popup);
    await popup.close();

    const { download, buffer } = await downloadPdf(page, () => tenantPanel.getByRole('button', { name: 'تنزيل PDF' }).click());
    const summary = assertRealPdf(buffer);
    expect(isA4Portrait(summary)).toBe(true);
    // 22 movement lines per table chunk plus headers/totals: the seeded
    // statement must span multiple A4 pages.
    expect(summary.pageCount).toBeGreaterThanOrEqual(2);
    // No blank trailing page: every captured page carries real pixels.
    expect(summary.smallestImageStream).toBeGreaterThan(10_000);
    const productionName = await lastProductionDownloadName(page);
    expect(productionName).toMatch(/^tenant-statement-/);
    const audit = auditDocumentFileName(productionName, FORBIDDEN_ID_FRAGMENTS);
    expect(audit.passes, `file name must be safe: ${productionName}`).toBe(true);
    // Headless-shell flattens non-ASCII suggested names to `download`; real
    // browsers keep the Arabic name. Both outcomes are accepted here.
    expect([productionName, 'download']).toContain(download.suggestedFilename());

    await expectNoUnexpectedConsoleErrors(page, consoleErrors);
  });

  test('owner statement prints and downloads with the true owner identity', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, 'statements matrix runs on desktop');
    test.setTimeout(120_000);
    const consoleErrors = watchConsoleErrors(page);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await openStatements(page);
    await page.getByLabel('المالك للكشف').selectOption(IDS.owner);
    await applyReportFilters(page);
    const ownerPanel = reportPanel(page, 'كشف حساب المالك');
    await expect(ownerPanel.getByText(/تحصيل إيجار|عمولة الإدارة/).first()).toBeVisible({ timeout: 30_000 });

    const popup = await openPrintPopup(page, () => ownerPanel.getByRole('button', { name: 'طباعة الكشف' }).click());
    await assertPopupIdentity(popup, [OWNER_NAME]);
    await assertA4PrintContract(popup);
    await popup.close();

    const { download, buffer } = await downloadPdf(page, () => ownerPanel.getByRole('button', { name: 'تنزيل PDF' }).click());
    const summary = assertRealPdf(buffer);
    expect(isA4Portrait(summary)).toBe(true);
    expect(summary.pageCount).toBeGreaterThanOrEqual(1);
    const productionName = await lastProductionDownloadName(page);
    expect(productionName).toMatch(/^owner-statement-/);
    const audit = auditDocumentFileName(productionName, FORBIDDEN_ID_FRAGMENTS);
    expect(audit.passes, `file name must be safe: ${productionName}`).toBe(true);
    expect([productionName, 'download']).toContain(download.suggestedFilename());

    await expectNoUnexpectedConsoleErrors(page, consoleErrors);
  });
});

/* ------------------------------------------------------------------ */
/* 6. Long multi-page financial report                                  */
/* ------------------------------------------------------------------ */

test.describe('التقارير المالية — long report acceptance', () => {
  test('trial balance renders a long multi-page PDF with no clipped rows and no trailing blank page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, 'long report matrix runs on desktop');
    test.setTimeout(240_000);
    const consoleErrors = watchConsoleErrors(page);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto('/reports?section=accounting');
    const trialBalancePanel = reportPanel(page, 'ميزان المراجعة');
    // All 150 seeded accounts must reach the panel before output is produced.
    await expect(trialBalancePanel.getByText('حساب أصول تشغيلية رقم 75 — فرع صحار').first()).toBeVisible({ timeout: 30_000 });
    await expect(trialBalancePanel.getByText('حساب التزامات وإيرادات رقم 75 — فرع صحار').first()).toBeVisible({ timeout: 30_000 });

    // Print path: scoped popup with the full account table.
    const popup = await openPrintPopup(page, () => trialBalancePanel.getByRole('button', { name: 'طباعة الميزان' }).click());
    await assertPopupIdentity(popup, ['ميزان المراجعة', 'حساب أصول تشغيلية رقم 75 — فرع صحار']);
    await assertA4PrintContract(popup);
    await popup.close();

    // PDF path: real artifact, multiple pages, every page carries content.
    const { download, buffer } = await downloadPdf(page, () => trialBalancePanel.getByRole('button', { name: 'PDF', exact: true }).click());
    const summary = assertRealPdf(buffer);
    expect(isA4Portrait(summary)).toBe(true);
    expect(summary.pageCount).toBeGreaterThanOrEqual(5);
    expect(summary.pageCount).toBeLessThanOrEqual(50);
    expect(summary.smallestImageStream).toBeGreaterThan(10_000);
    const audit = auditDocumentFileName(download.suggestedFilename(), FORBIDDEN_ID_FRAGMENTS);
    expect(audit.passes).toBe(true);
    expect(download.suggestedFilename()).toMatch(/^trial-balance-/);

    await expectNoUnexpectedConsoleErrors(page, consoleErrors);
  });
});

/* ------------------------------------------------------------------ */
/* 7. Readiness gate — incomplete company settings                      */
/* ------------------------------------------------------------------ */

test.describe('بوابة الجاهزية — company identity not confirmed', () => {
  test('document actions are disabled and the readiness notice replaces them', async ({ page }) => {
    test.setTimeout(90_000);
    const consoleErrors = watchConsoleErrors(page);
    await installAcceptanceBrowser(page);
    // The settings read fails, so the canonical adapter never confirms a real
    // company identity: `isReady` must stay false and every output action must
    // be blocked with the Arabic readiness notice — no brand fallback may fire.
    await installFakeSupabaseBackend(page, 'settings-unavailable');

    // Receipt detail: buttons stay visible but disabled, notice is shown.
    await page.goto(`/receipts?receiptId=${IDS.payment}`);
    await expect(page.getByText(RECEIPT_REFERENCE).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /طباعة A4/ })).toBeDisabled();
    await expectHeaderSecondaryActionDisabled(page, 'تنزيل PDF');
    await expect(page.getByRole('alert').getByText(READINESS_NOTICE)).toBeVisible();

    // Invoice workspace: no print/PDF affordance exists while not ready.
    await page.goto('/invoices');
    await expect(page.getByRole('heading', { name: 'الفواتير', level: 1, exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'طباعة', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'PDF', exact: true })).toHaveCount(0);

    // Reports statements: actions disabled with the same notice contract.
    await page.goto('/reports?section=statements');
    await page.getByRole('button', { name: 'تعديل النطاق' }).click();
    await expect(page.getByLabel('العقد لكشف المستأجر')).toBeVisible({ timeout: 30_000 });
    await page.getByLabel('العقد لكشف المستأجر').selectOption(IDS.contract);
    await page.getByRole('button', { name: 'تطبيق وعرض النتائج' }).click();
    const tenantPanel = reportPanel(page, 'كشف حساب المستأجر');
    await expect(tenantPanel.getByRole('button', { name: 'طباعة الكشف' })).toBeDisabled({ timeout: 30_000 });
    await expect(tenantPanel.getByRole('button', { name: 'تنزيل PDF' })).toBeDisabled();
    await expect(page.getByRole('alert').getByText(READINESS_NOTICE).first()).toBeVisible();

    await expectNoUnexpectedConsoleErrors(page, consoleErrors);
  });
});

/* ------------------------------------------------------------------ */
/* 8. Failure surfacing                                                 */
/* ------------------------------------------------------------------ */

test.describe('ظهور الأخطاء — failure surfacing', () => {
  test('a blocked popup produces the Arabic user-facing error instead of silence', async ({ page }) => {
    test.setTimeout(60_000);
    await installAcceptanceBrowser(page, { blockPopups: true });
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto(`/receipts?receiptId=${IDS.payment}`);
    await expect(page.getByText(RECEIPT_REFERENCE).first()).toBeVisible({ timeout: 20_000 });

    const popups: Page[] = [];
    page.context().on('page', (opened) => popups.push(opened));

    await page.getByRole('button', { name: /طباعة A4/ }).click();
    await expect(page.getByText(POPUP_BLOCKED_MESSAGE)).toBeVisible({ timeout: 15_000 });
    expect(popups.length).toBe(0);
  });

  test('renderer failures surface their real message on both print and download paths', async ({ page }) => {
    test.setTimeout(90_000);
    await installAcceptanceBrowser(page, { failFontLoading: true });
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto(`/receipts?receiptId=${IDS.payment}`);
    await expect(page.getByText(RECEIPT_REFERENCE).first()).toBeVisible({ timeout: 20_000 });

    const popups: Page[] = [];
    page.context().on('page', (opened) => popups.push(opened));
    const downloads: Download[] = [];
    page.on('download', (download) => downloads.push(download));

    await page.getByRole('button', { name: /طباعة A4/ }).click();
    await expect(page.getByText(FONT_FAILED_MESSAGE)).toBeVisible({ timeout: 30_000 });

    await clickHeaderSecondaryAction(page, 'تنزيل PDF');
    await expect(page.getByText(FONT_FAILED_MESSAGE).nth(1)).toBeVisible({ timeout: 30_000 });

    expect(popups.length).toBe(0);
    expect(downloads.length).toBe(0);
    // No orphan offscreen render containers may remain after failures.
    await expect(page.locator('[data-document-render-root]')).toHaveCount(0);
  });
});

/* ------------------------------------------------------------------ */
/* 9. Mobile coverage                                                   */
/* ------------------------------------------------------------------ */

test.describe('الجوال — mobile acceptance', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== MOBILE, 'mobile matrix runs in the mobile project');
  });

  test('invoice mobile cards print and export real PDFs', async ({ page }) => {
    test.setTimeout(120_000);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto('/invoices');
    await expect(page.getByRole('heading', { name: 'الفواتير', level: 1, exact: true })).toBeVisible();
    const printButton = page.getByRole('button', { name: 'طباعة', exact: true }).first();
    await expect(printButton).toBeVisible({ timeout: 20_000 });

    const popup = await openPrintPopup(page, () => printButton.click());
    await assertPopupIdentity(popup, [TENANT_NAME, '420']);
    await assertA4PrintContract(popup);
    await popup.close();

    const pdfButton = page.getByRole('button', { name: 'PDF', exact: true }).first();
    const { download, buffer } = await downloadPdf(page, () => pdfButton.click());
    const summary = assertRealPdf(buffer);
    expect(isA4Portrait(summary)).toBe(true);
    expect(auditDocumentFileName(download.suggestedFilename(), FORBIDDEN_ID_FRAGMENTS).passes).toBe(true);
  });

  test('receipt detail prints on mobile', async ({ page }) => {
    test.setTimeout(120_000);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto(`/receipts?receiptId=${IDS.payment}`);
    await expect(page.getByText(RECEIPT_REFERENCE).first()).toBeVisible({ timeout: 20_000 });
    const popup = await openPrintPopup(page, () => page.getByRole('button', { name: /طباعة A4/ }).click());
    await assertPopupIdentity(popup, [RECEIPT_REFERENCE]);
    await assertA4PrintContract(popup);
    await popup.close();
  });

  test('contract actions stay reachable through the action menu on mobile', async ({ page }) => {
    test.setTimeout(120_000);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto(`/contracts/${IDS.contract}`);
    await expect(page.getByRole('heading', { name: 'تفاصيل العقد', exact: true })).toBeVisible({ timeout: 20_000 });

    // On narrow viewports the direct header buttons are hidden; the contract
    // action menu is a real listbox dropdown. Open it, then print from it.
    await page.getByRole('button', { name: 'إجراءات العقد' }).click();
    await expect(page.getByRole('option', { name: 'طباعة العقد' })).toBeVisible({ timeout: 15_000 });
    const popup = await openPrintPopup(page, () => page.getByRole('option', { name: 'طباعة العقد' }).click());
    await assertPopupIdentity(popup, [TENANT_NAME, 'عقد إيجار ساري المفعول']);
    await assertA4PrintContract(popup);
    await popup.close();
  });

  test('incomplete settings keep mobile actions disabled with the readiness notice', async ({ page }) => {
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'settings-unavailable');

    await page.goto(`/receipts?receiptId=${IDS.payment}`);
    await expect(page.getByText(RECEIPT_REFERENCE).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /طباعة A4/ })).toBeDisabled();
    await expect(page.getByRole('alert').getByText(READINESS_NOTICE)).toBeVisible();
  });
});

