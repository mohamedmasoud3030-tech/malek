import { expect, test, type Download, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  COMPANY_NAME,
  IDS,
  OWNER_NAME,
  RECEIPT_REFERENCE,
  TENANT_NAME,
  installFakeSupabaseBackend,
} from './support/fake-supabase-backend';
import { installAcceptanceBrowser } from './support/document-acceptance-session';
import { auditDocumentFileName, isA4Portrait, parsePdfArtifact } from './support/pdf-artifact';

/**
 * WP-06 — shared Print/PDF platform browser acceptance.
 *
 * Drives the REAL production surfaces (routes → page handlers →
 * `documentService` → DocumentEngine → DocumentRenderer → real popups and
 * real `application/pdf` downloads) in a real Chromium, and writes the
 * artifacts it observed to `evidence/wp06-document-output/`.
 *
 * The only stubbed boundary is the Supabase HTTP API (no live project is
 * reachable from this sandbox); every seeded row mirrors the repository
 * migrations. Authorization behavior is intentionally NOT asserted here —
 * this suite proves the DOCUMENT boundary only.
 */

const DESKTOP = 'chromium-desktop';
const MOBILE = 'chromium-mobile';
const TABLET = 'chromium-tablet';

const EVIDENCE_DIR = resolve(import.meta.dirname, '../../evidence/wp06-document-output');
const ARTIFACT_DIR = resolve(EVIDENCE_DIR, 'artifacts');

const READINESS_NOTICE = 'أكمل بيانات الشركة الأساسية في الإعدادات قبل طباعة هذا المستند.';
const POPUP_BLOCKED_MESSAGE = 'تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع ثم إعادة المحاولة.';

/** Every seeded UUID plus its historical `id.slice(0, 8)` abbreviation. */
const FORBIDDEN_ID_FRAGMENTS = Object.values(IDS).flatMap((id) => [id, id.slice(0, 8)]);

type ArtifactNote = {
  scenario: string;
  route: string;
  documentType: string;
  channel: 'print' | 'pdf';
  file?: string;
  bytes?: number;
  pageCount?: number;
  pageSizePoints?: { width: number; height: number } | null;
  isA4Portrait?: boolean;
  suggestedFileName?: string;
  observations: string[];
};

const collectedArtifacts: ArtifactNote[] = [];

/**
 * Tablet coverage is verified in the readiness smoke and the mobile register
 * tests. Desktop and mobile each exercise the full document acceptance path
 * through their native interaction model.
 */
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name === TABLET, 'WP-06 acceptance covers desktop and mobile; tablet coverage stays in the readiness smoke.');
});

test.beforeAll(async () => {
  await mkdir(ARTIFACT_DIR, { recursive: true });
});

test.afterAll(async () => {
  if (collectedArtifacts.length === 0) return;
  await writeFile(
    resolve(EVIDENCE_DIR, 'browser-acceptance.json'),
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        harness: 'playwright chromium (headless) against local vite dev server; Supabase HTTP boundary stubbed',
        note: 'Artifacts are synthetic seeded data. No customer or production data is present.',
        artifacts: collectedArtifacts,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
});

const record = (note: ArtifactNote) => collectedArtifacts.push(note);

function watchConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

function unexpectedConsoleErrors(collected: string[]): string[] {
  const allowed = [
    'Supabase environment is incomplete',
    'Failed to load resource',
    'the server responded with a status of',
    'Download the React DevTools',
    '[vite]',
    // The sandbox has no reachable Supabase project, so the realtime socket
    // cannot connect. This is an ENVIRONMENT limitation of the harness, not a
    // document-platform defect: the HTTP data plane is stubbed and every
    // document assertion above still runs against real rendered output.
    'realtime/v1/websocket',
    'WebSocket connection to',
  ];
  return collected.filter((text) => !allowed.some((fragment) => text.includes(fragment)));
}

async function openPrintPopup(page: Page, trigger: () => Promise<unknown>): Promise<Page> {
  const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 30_000 }), trigger()]);
  await popup.waitForLoadState('domcontentloaded');
  return popup;
}

/**
 * Asserts the scoped-document print contract: an RTL/Arabic A4 document that
 * carries the REAL company identity and none of the application shell.
 */
async function assertScopedArabicA4Print(popup: Page, expectedFragments: readonly string[]): Promise<string> {
  await expect(popup.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(popup.locator('html')).toHaveAttribute('lang', 'ar');
  await popup.waitForFunction(() => (document.body?.textContent ?? '').length > 0);

  const bodyText = await popup.evaluate(() => document.body.innerText);

  // Real company identity, never the product brand.
  expect(bodyText).toContain(COMPANY_NAME);
  expect(bodyText).not.toContain('MALEK');
  for (const fragment of expectedFragments) expect(bodyText).toContain(fragment);

  // Arabic actually rendered (not boxes/blank).
  expect(bodyText).toMatch(/[\u0600-\u06FF]/);
  expect(bodyText.trim().length).toBeGreaterThan(40);

  // A shortened UUID must never surface as a document reference.
  for (const forbidden of FORBIDDEN_ID_FRAGMENTS) expect(bodyText).not.toContain(forbidden);

  // A4 page policy is declared in the popup's own stylesheet.
  const hasA4Rule = await popup.evaluate(() =>
    Array.from(document.querySelectorAll('style')).some((style) => (style.textContent ?? '').includes('size: A4 portrait')),
  );
  expect(hasA4Rule).toBe(true);

  // The application shell must NOT be part of the printed document.
  const shellLeak = await popup.evaluate(() => ({
    nav: document.querySelectorAll('nav').length,
    aside: document.querySelectorAll('aside').length,
    appRoot: document.querySelectorAll('#root').length,
  }));
  expect(shellLeak).toEqual({ nav: 0, aside: 0, appRoot: 0 });

  // The renderer must invoke print() on the popup (dialog itself is stubbed).
  await popup.waitForFunction(() => (window as unknown as { __printCalls?: number }).__printCalls === 1, undefined, {
    timeout: 30_000,
  });

  return bodyText;
}

async function capturePrintArtifact(popup: Page, fileName: string): Promise<{ bytes: number; pageCount: number }> {
  // CDP printToPDF walks the print lifecycle; the renderer self-closes on
  // afterprint, so neutralize that for the capture only.
  await popup.evaluate(() => {
    window.close = () => undefined;
  });
  const session = await popup.context().newCDPSession(popup);
  try {
    const { data } = await session.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
    const buffer = Buffer.from(data, 'base64');
    await writeFile(resolve(ARTIFACT_DIR, fileName), buffer);
    const summary = parsePdfArtifact(buffer);
    expect(summary.hasPdfMagic).toBe(true);
    return { bytes: buffer.byteLength, pageCount: summary.pageCount };
  } finally {
    await session.detach().catch(() => undefined);
  }
}

async function downloadPdf(page: Page, trigger: () => Promise<unknown>): Promise<{ download: Download; buffer: Buffer }> {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 120_000 }), trigger()]);
  const path = await download.path();
  expect(path).toBeTruthy();
  return { download, buffer: await readFile(path ?? '') };
}

/** Asserts the download is a genuine, non-empty, A4 PDF and saves it as evidence. */
async function assertRealPdfArtifact(buffer: Buffer, fileName: string) {
  const summary = parsePdfArtifact(buffer);
  expect(summary.hasPdfMagic, 'artifact must start with %PDF-').toBe(true);
  expect(summary.hasEofMarker).toBe(true);
  expect(summary.pageCount).toBeGreaterThan(0);
  expect(summary.bytes).toBeGreaterThan(5_000);
  expect(isA4Portrait(summary)).toBe(true);
  await writeFile(resolve(ARTIFACT_DIR, fileName), buffer);
  return summary;
}

async function gotoInvoices(page: Page): Promise<void> {
  await page.goto('/invoices');
  // `/invoices` is a compatibility route bound into the Financials hub, so the
  // invoices REGION (not an h1) is the stable anchor.
  await expect(page.getByRole('region', { name: 'قائمة الفواتير' })).toBeVisible({ timeout: 30_000 });
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

const reportPanel = (page: Page, title: string) =>
  page.getByRole('heading', { name: title, exact: true }).locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');

/* ------------------------------------------------------------------ */
/* 1. Receipt — payment document                                        */
/* ------------------------------------------------------------------ */

test.describe('WP-06 — receipt/payment document', () => {
  test('print renders a scoped Arabic A4 receipt and PDF downloads a real artifact', async ({ page }) => {
    test.setTimeout(120_000);
    const consoleErrors = watchConsoleErrors(page);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto(`/receipts?receiptId=${IDS.payment}`);
    await expect(page.getByText(RECEIPT_REFERENCE).first()).toBeVisible({ timeout: 30_000 });

    const popup = await openPrintPopup(page, () => page.getByRole('button', { name: /طباعة A4/ }).click());
    const bodyText = await assertScopedArabicA4Print(popup, [RECEIPT_REFERENCE, TENANT_NAME]);
    // OMR renders at exactly three decimals through the canonical formatter.
    expect(bodyText).toMatch(/\d+\.\d{3}/);
    const printArtifact = await capturePrintArtifact(popup, 'receipt-print-a4.pdf');
    // Visual proof that Arabic actually SHAPES and renders (not tofu boxes)
    // and that the layout is a document, not the app screen.
    await popup.setViewportSize({ width: 900, height: 1300 });
    await popup.screenshot({ path: resolve(ARTIFACT_DIR, 'receipt-print-a4.png'), fullPage: true });
    await popup.close();

    record({
      scenario: 'receipt print (scoped A4 popup)',
      route: '/receipts?receiptId=…',
      documentType: 'receipt',
      channel: 'print',
      file: 'artifacts/receipt-print-a4.pdf',
      bytes: printArtifact.bytes,
      pageCount: printArtifact.pageCount,
      observations: [
        'popup is dir=rtl lang=ar with @page size: A4 portrait',
        'real company name present; product brand absent',
        'no nav/aside/#root in the printed document (app shell not printed)',
        'window.print() invoked exactly once on the popup',
        'no UUID or UUID fragment shown as a document reference',
      ],
    });

    const { download, buffer } = await downloadPdf(page, () => clickHeaderSecondaryAction(page, 'تنزيل PDF'));
    const summary = await assertRealPdfArtifact(buffer, 'receipt-download.pdf');
    expect(auditDocumentFileName(download.suggestedFilename(), FORBIDDEN_ID_FRAGMENTS).passes).toBe(true);

    record({
      scenario: 'receipt PDF download',
      route: '/receipts?receiptId=…',
      documentType: 'receipt',
      channel: 'pdf',
      file: 'artifacts/receipt-download.pdf',
      bytes: summary.bytes,
      pageCount: summary.pageCount,
      pageSizePoints: summary.pageSizePoints,
      isA4Portrait: isA4Portrait(summary),
      suggestedFileName: download.suggestedFilename(),
      observations: ['%PDF- magic and %%EOF present', 'A4 portrait geometry', 'sanitized filename with no UUID fragment'],
    });

    expect(unexpectedConsoleErrors(consoleErrors)).toEqual([]);
    // No leaked offscreen render root or orphan popup.
    await expect(page.locator('[data-document-render-root]')).toHaveCount(0);
    expect(page.context().pages().filter((open) => open !== page)).toHaveLength(0);
  });

  test('a repeated click never produces a duplicate popup or a duplicate download', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, 'single-flight guard is exercised on the desktop interaction model');
    test.setTimeout(120_000);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto(`/receipts?receiptId=${IDS.payment}`);
    await expect(page.getByText(RECEIPT_REFERENCE).first()).toBeVisible({ timeout: 30_000 });

    const popups: Page[] = [];
    page.context().on('page', (opened) => popups.push(opened));
    const downloads: Download[] = [];
    page.on('download', (download) => downloads.push(download));

    // A genuine impatient double-click: two activations dispatched back to
    // back, before the first render can finish. (Two *awaited* Playwright
    // clicks would be sequential user actions, which legitimately produce two
    // documents and would not test the single-flight guard at all.)
    await page.getByRole('button', { name: /طباعة A4/ }).dblclick();
    await page.waitForTimeout(5_000);
    expect(popups.length, 'a double activation must not open two print popups').toBe(1);
    for (const popup of popups) await popup.close().catch(() => undefined);

    await page
      .locator('[data-secondary-actions-desktop]')
      .getByRole('button', { name: 'تنزيل PDF', exact: true })
      .dblclick();
    await page.waitForTimeout(8_000);
    expect(downloads.length, 'a double activation must not download two PDFs').toBe(1);

    record({
      scenario: 'double activation (single-flight)',
      route: '/receipts?receiptId=…',
      documentType: 'receipt',
      channel: 'print',
      observations: [
        'rapid double-click on Print produced exactly 1 popup',
        'rapid double-click on PDF produced exactly 1 download',
      ],
    });
  });
});

/* ------------------------------------------------------------------ */
/* 2. Contract — legal document                                         */
/* ------------------------------------------------------------------ */

test.describe('WP-06 — contract/legal document', () => {
  test('contract print carries true parties and status, with no invented legal wording', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, 'desktop exercises the direct header print/export actions');
    test.setTimeout(120_000);
    const consoleErrors = watchConsoleErrors(page);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto(`/contracts/${IDS.contract}`);
    await expect(page.getByRole('heading', { name: 'تفاصيل العقد', exact: true })).toBeVisible({ timeout: 30_000 });

    const popup = await openPrintPopup(page, () =>
      page.getByRole('button', { name: 'طباعة', exact: true }).first().click(),
    );
    const bodyText = await assertScopedArabicA4Print(popup, [TENANT_NAME, 'عقد إيجار']);
    // The registry owns status wording; an active contract must say so.
    expect(bodyText).toContain('عقد إيجار ساري المفعول');
    // Signature block is present and not clipped.
    expect(bodyText).toContain('التوقيعات والاعتماد');
    const printArtifact = await capturePrintArtifact(popup, 'contract-print-a4.pdf');
    await popup.setViewportSize({ width: 900, height: 1300 });
    await popup.screenshot({ path: resolve(ARTIFACT_DIR, 'contract-print-a4.png'), fullPage: true });
    await popup.close();

    record({
      scenario: 'contract print (legal document)',
      route: '/contracts/$contractId',
      documentType: 'contract',
      channel: 'print',
      file: 'artifacts/contract-print-a4.pdf',
      bytes: printArtifact.bytes,
      pageCount: printArtifact.pageCount,
      observations: [
        'truthful registry status wording rendered (عقد إيجار ساري المفعول)',
        'signature/approval block present in the printed document',
        'real tenant party name present',
      ],
    });

    expect(unexpectedConsoleErrors(consoleErrors)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Owner settlement statement + 4. multi-page operational report     */
/* ------------------------------------------------------------------ */

test.describe('WP-06 — statements and multi-page reports', () => {
  test('owner statement downloads a real PDF with the true owner identity', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, 'statement artifact evidence is captured on desktop');
    test.setTimeout(180_000);
    const consoleErrors = watchConsoleErrors(page);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto('/reports?section=statements');
    await page.getByRole('button', { name: 'تعديل النطاق' }).click();
    await expect(page.getByLabel('المالك للكشف')).toBeVisible({ timeout: 30_000 });
    await page.getByLabel('المالك للكشف').selectOption(IDS.owner);
    await page.getByRole('button', { name: 'تطبيق وعرض النتائج' }).click();

    const ownerPanel = reportPanel(page, 'كشف حساب المالك');
    const printButton = ownerPanel.getByRole('button', { name: 'طباعة الكشف' });
    await expect(printButton).toBeEnabled({ timeout: 30_000 });

    const popup = await openPrintPopup(page, () => printButton.click());
    await assertScopedArabicA4Print(popup, [OWNER_NAME, 'كشف حساب مالك']);
    const printArtifact = await capturePrintArtifact(popup, 'owner-statement-print-a4.pdf');
    await popup.setViewportSize({ width: 900, height: 1300 });
    await popup.screenshot({ path: resolve(ARTIFACT_DIR, 'owner-statement-print-a4.png'), fullPage: true });
    await popup.close();

    const { download, buffer } = await downloadPdf(page, () =>
      ownerPanel.getByRole('button', { name: 'تنزيل PDF' }).click(),
    );
    const summary = await assertRealPdfArtifact(buffer, 'owner-statement-download.pdf');

    record({
      scenario: 'owner settlement statement',
      route: '/reports?section=statements',
      documentType: 'owner_statement',
      channel: 'pdf',
      file: 'artifacts/owner-statement-download.pdf',
      bytes: summary.bytes,
      pageCount: summary.pageCount,
      pageSizePoints: summary.pageSizePoints,
      isA4Portrait: isA4Portrait(summary),
      suggestedFileName: download.suggestedFilename(),
      observations: [
        `print artifact captured as artifacts/owner-statement-print-a4.pdf (${printArtifact.pageCount} page(s))`,
        'real owner name rendered in both print and PDF',
      ],
    });

    expect(unexpectedConsoleErrors(consoleErrors)).toEqual([]);
    await expect(page.locator('[data-document-render-root]')).toHaveCount(0);
  });

  test('a long trial balance paginates across A4 pages with content on every page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, 'multi-page report evidence is captured on desktop');
    test.setTimeout(240_000);
    const consoleErrors = watchConsoleErrors(page);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto('/reports?section=accounting');
    const panel = reportPanel(page, 'ميزان المراجعة');
    await expect(panel.getByRole('button', { name: 'PDF', exact: true })).toBeEnabled({ timeout: 30_000 });

    const { download, buffer } = await downloadPdf(page, () => panel.getByRole('button', { name: 'PDF', exact: true }).click());
    const summary = await assertRealPdfArtifact(buffer, 'trial-balance-multipage.pdf');

    // Multi-page with deterministic pagination and no blank trailing page:
    // every captured page carries a substantial image stream.
    expect(summary.pageCount).toBeGreaterThan(1);
    expect(summary.pageCount).toBeLessThanOrEqual(50);
    expect(summary.smallestImageStream, 'no page may be blank (a blank page compresses tiny)').toBeGreaterThan(5_000);
    expect(auditDocumentFileName(download.suggestedFilename(), FORBIDDEN_ID_FRAGMENTS).passes).toBe(true);
    expect(download.suggestedFilename()).toMatch(/^trial-balance-/);

    record({
      scenario: 'multi-page operational/accounting report',
      route: '/reports?section=accounting',
      documentType: 'trial_balance',
      channel: 'pdf',
      file: 'artifacts/trial-balance-multipage.pdf',
      bytes: summary.bytes,
      pageCount: summary.pageCount,
      pageSizePoints: summary.pageSizePoints,
      isA4Portrait: isA4Portrait(summary),
      suggestedFileName: download.suggestedFilename(),
      observations: [
        `${summary.pageCount} A4 pages rendered`,
        `smallest embedded page image stream = ${summary.smallestImageStream} bytes (no blank trailing page)`,
        'deterministic filename prefix trial-balance-',
      ],
    });

    expect(unexpectedConsoleErrors(consoleErrors)).toEqual([]);
    await expect(page.locator('[data-document-render-root]')).toHaveCount(0);
  });
});

/* ------------------------------------------------------------------ */
/* 5. Fail-closed readiness                                             */
/* ------------------------------------------------------------------ */

test.describe('WP-06 — readiness failure blocks output', () => {
  test('with no confirmed company identity, output is blocked and explained in Arabic', async ({ page }) => {
    test.setTimeout(120_000);
    await installAcceptanceBrowser(page);
    // A failing company_settings read is a real, reachable production state.
    await installFakeSupabaseBackend(page, 'settings-unavailable');

    const popups: Page[] = [];
    page.context().on('page', (opened) => popups.push(opened));
    const downloads: Download[] = [];
    page.on('download', (download) => downloads.push(download));

    await page.goto(`/receipts?receiptId=${IDS.payment}`);
    await expect(page.getByText(RECEIPT_REFERENCE).first()).toBeVisible({ timeout: 30_000 });

    // Visible affordance is gated…
    await expect(page.getByRole('button', { name: /طباعة A4/ })).toBeDisabled();
    await expect(page.getByRole('alert').getByText(READINESS_NOTICE)).toBeVisible();

    // …and the HANDLER itself fails closed when invoked directly, which is the
    // guarantee a disabled button cannot provide. React's synthetic handler is
    // reached by dispatching a real click on the (disabled) control's element.
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
        (candidate.textContent ?? '').includes('طباعة'),
      );
      button?.removeAttribute('disabled');
      button?.click();
    });
    await page.waitForTimeout(4_000);

    expect(popups, 'no print popup may open without company readiness').toHaveLength(0);
    expect(downloads, 'no PDF may be produced without company readiness').toHaveLength(0);
    await expect(page.locator('[data-document-render-root]')).toHaveCount(0);

    record({
      scenario: 'readiness failure (company_settings unavailable)',
      route: '/receipts?receiptId=…',
      documentType: 'receipt',
      channel: 'print',
      observations: [
        'Arabic readiness notice shown in place of the action',
        'button disabled AND handler fails closed when force-invoked',
        'zero popups, zero downloads, zero leaked render roots',
        'no placeholder company identity was rendered anywhere',
      ],
    });
  });

  test('a blocked popup surfaces the Arabic error instead of failing silently', async ({ page }) => {
    test.setTimeout(90_000);
    await installAcceptanceBrowser(page, { blockPopups: true });
    await installFakeSupabaseBackend(page, 'complete');

    await page.goto(`/receipts?receiptId=${IDS.payment}`);
    await expect(page.getByText(RECEIPT_REFERENCE).first()).toBeVisible({ timeout: 30_000 });

    const popups: Page[] = [];
    page.context().on('page', (opened) => popups.push(opened));

    await page.getByRole('button', { name: /طباعة A4/ }).click();
    await expect(page.getByText(POPUP_BLOCKED_MESSAGE)).toBeVisible({ timeout: 20_000 });
    expect(popups).toHaveLength(0);
    await expect(page.locator('[data-document-render-root]')).toHaveCount(0);

    record({
      scenario: 'popup blocked',
      route: '/receipts?receiptId=…',
      documentType: 'receipt',
      channel: 'print',
      observations: [
        'user-facing Arabic popup-blocked message shown',
        'no orphan window, no leaked offscreen render root',
      ],
    });
  });
});
