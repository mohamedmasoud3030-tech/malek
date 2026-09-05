import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  IDS,
  installFakeSupabaseBackend,
} from './support/fake-supabase-backend';
import { buildAcceptanceSession } from './support/document-acceptance-session';

/**
 * Fresh runtime evidence for the premium reports catalog batch.
 *
 * Runs the REAL app against the hermetic fake Supabase acceptance backend:
 * catalog-only landing (five products, zero KPI/charts/filters), one real
 * route per product, print popup in Arabic RTL, a genuine multi-page PDF
 * artifact, and the truthful share fallback. Screenshots land in
 * `e2e/evidence/reports-premium-catalog/` for PR review.
 *
 * The Google Fonts CDN is unreachable in offline/sandbox runs, so when a
 * local @fontsource/cairo checkout is available we serve the same font face
 * over the intercepted stylesheet URL (visual evidence only; behavior is
 * font-independent).
 */

const EVIDENCE_DIR = 'e2e/evidence/reports-premium-catalog';
const CAIRO_FILES = process.env.CAIRO_WOFF2_DIR ?? '';
const sessionPayload = JSON.stringify(buildAcceptanceSession());

function cairoCss(): string | null {
  if (!CAIRO_FILES || !existsSync(CAIRO_FILES)) return null;
  const faces: string[] = [];
  for (const weight of [400, 500, 600, 700, 800, 900]) {
    for (const subset of ['latin', 'arabic']) {
      const file = `${CAIRO_FILES}/cairo-${subset}-${weight}-normal.woff2`;
      if (!existsSync(file)) continue;
      const b64 = readFileSync(file).toString('base64');
      faces.push(
        `@font-face{font-family:'Cairo';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`,
      );
    }
  }
  return faces.length > 0 ? faces.join('\n') : null;
}

async function preparedContext(
  browser: import('@playwright/test').Browser,
  options: { width: number; height: number; theme?: 'light' | 'dark' },
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: options.width, height: options.height },
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const fontCss = cairoCss();
  await context.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/css; charset=utf-8',
      body: fontCss ?? '',
    }),
  );
  await context.route('https://fonts.gstatic.com/**', (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
  const theme = options.theme ?? 'light';
  await context.addInitScript(
    ({ session, selectedTheme }) => {
      try {
        window.localStorage.setItem('rentrix-auth-session', session);
        // The real theme surface (store-backed) reads this key — seeding it
        // exercises the production theme path instead of overriding it.
        window.localStorage.setItem('rentrix-theme', selectedTheme);
      } catch {
        /* storage unavailable — the guards below fail visibly */
      }
      // Init scripts run at document-start, where `documentElement` can still
      // be null — an unguarded property access here once aborted the whole
      // script (silently losing the print stub below), so guard it.
      const apply = () => {
        const root = document.documentElement;
        if (root) root.setAttribute('dir', 'rtl');
      };
      apply();
      document.addEventListener('DOMContentLoaded', apply, { once: true });
      // Headless Chrome fires `afterprint` for a no-op print(), and the print
      // engine closes the popup there — before evidence can be captured. The
      // popup document itself is the real A4 output; stub only the dialog call
      // (same technique as the repository's own acceptance harness).
      const originalOpen = window.open.bind(window);
      Object.defineProperty(window, 'open', {
        configurable: true,
        value: (...openArgs: Parameters<typeof originalOpen>) => {
          const opened = originalOpen(...openArgs);
          if (opened) {
            // `window.print` is [Replaceable] in Chromium — a plain assignment
            // from the opener does not stick; defineProperty does.
            try {
              Object.defineProperty(opened, 'print', {
                configurable: true,
                value: () => undefined,
              });
            } catch {
              /* headless without the stub — the popup may close early and the assertions fail visibly */
            }
            try {
              Object.defineProperty(opened, 'close', {
                configurable: true,
                value: () => undefined,
              });
            } catch {
              /* same — assertions stay honest */
            }
          }
          return opened;
        },
      });
    },
    { session: sessionPayload, selectedTheme: theme },
  );
  return context;
}

async function seed(page: Page): Promise<void> {
  await installFakeSupabaseBackend(page);
}

async function open(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  const current = await page.evaluate(
    () => document.documentElement.dataset.theme,
  );
  if (current === theme) return;
  await page.locator('[data-header-theme-toggle]').click();
  await page.waitForTimeout(250);
}

async function capture(
  page: Page,
  name: string,
  options: { viewportOnly?: boolean } = {},
): Promise<void> {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.waitForTimeout(450);
  await page.screenshot({
    path: `${EVIDENCE_DIR}/${name}.png`,
    fullPage: !options.viewportOnly,
  });
}

const summary: Record<string, unknown> = {};

test('premium reports catalog — full product journey with print/PDF/share evidence', async ({
  browser,
}) => {
  test.setTimeout(420_000);
  const facts: Record<string, unknown>[] = [];

  /* 1 — /reports is the catalog: five products, no KPI/charts/filters. */
  let context = await preparedContext(browser, { width: 1440, height: 1000 });
  let page = await context.newPage();
  await seed(page);
  await open(page, '/reports');
  const cards = page.locator('[data-report-product]');
  await expect(cards).toHaveCount(5);
  await expect(
    page.locator('[data-report-product="owner-comprehensive-statement"]'),
  ).toContainText('كشف المالك الشامل');
  summary.landing = {
    cards: await cards.count(),
    kpiLayer: await page.locator('[data-report-summary-layer]').count(),
    filterSurface: await page.locator('[data-report-filter-surface]').count(),
    charts: await page.locator('canvas, svg.recharts-surface').count(),
    money: await page.evaluate(() =>
      /\d{3,}(?:[.,]\d+)?\s*(OMR|ر\.ع)/i.test(document.body.innerText),
    ),
  };
  await capture(page, '01-catalog-desktop-light');
  await setTheme(page, 'dark');
  await page.waitForTimeout(300);
  await capture(page, '02-catalog-desktop-dark');

  // Keyboard-first opening: focus the card action, Enter → real route.
  await setTheme(page, 'light');
  await page
    .locator('[data-report-product="owner-comprehensive-statement"] button')
    .first()
    .focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/reports/owner-comprehensive-statement');
  facts.push({
    id: 'catalog-opens-real-route',
    url: new URL(page.url()).pathname,
  });
  await context.close();

  /* 2 — mobile catalog: two columns at 390 and 360, no horizontal overflow. */
  for (const [width, theme, name] of [
    [390, 'light', '03-catalog-mobile-390-light'],
    [360, 'dark', '04-catalog-mobile-360-dark'],
  ] as const) {
    context = await preparedContext(browser, { width, height: 844, theme });
    page = await context.newPage();
    await seed(page);
    await open(page, '/reports');
    const grid = await page.evaluate(() => {
      const el = document.querySelector('[data-reports-premium-catalog] > div');
      if (!el) return { columns: -1, overflow: -1 };
      const columns =
        getComputedStyle(el).gridTemplateColumns.split(' ').length;
      return {
        columns,
        overflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      };
    });
    facts.push({ id: `catalog-mobile-${width}`, theme, ...grid });
    await capture(page, name);
    await context.close();
  }

  /* 3 — owner flagship: preview, print popup (RTL A4), real PDF, share fallback. */
  context = await preparedContext(browser, { width: 1440, height: 1000 });
  page = await context.newPage();
  await seed(page);
  await open(
    page,
    `/reports/owner-comprehensive-statement?ownerId=${IDS.owner}&from=2026-01-01&to=2026-12-31`,
  );
  await expect(
    page.locator('[data-report-product-page="owner-comprehensive-statement"]'),
  ).toBeVisible();
  const headerText = (
    await page.locator('[data-report-product-header]').innerText()
  ).replace(/\s+/g, ' ');
  facts.push({ id: 'owner-header', text: headerText.slice(0, 180) });
  await capture(page, '05-owner-report-desktop-light');

  // Print → the scoped A4 RTL popup (never the app screen).
  const popupPromise = page.waitForEvent('popup', { timeout: 60_000 });
  await page.getByRole('button', { name: 'طباعة A4' }).first().click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForTimeout(2_500);
  const printDoc = await popup.evaluate(() => ({
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
    hasTable: document.querySelectorAll('table').length,
    repeatingHeads: document.querySelectorAll('thead').length,
    companyOnDocument: document.body.innerText.includes(
      'شركة الأفق لإدارة الأملاك',
    ),
    omrThreeDecimals: (document.body.innerText.match(/\d+\.\d{3}/g) ?? [])
      .length,
    avoidBreakRules: [...document.querySelectorAll('[style]')].some((el) =>
      (el.getAttribute('style') ?? '').includes('break-inside'),
    ),
  }));
  facts.push({ id: 'owner-print-popup', ...printDoc });
  expect(printDoc.dir).toBe('rtl');
  expect(printDoc.lang).toBe('ar');
  expect(printDoc.hasTable).toBeGreaterThan(0);
  await popup.screenshot({
    path: `${EVIDENCE_DIR}/06-owner-print-popup-top.png`,
  });
  await popup.evaluate(() =>
    window.scrollTo(0, Math.max(0, document.body.scrollHeight * 0.5)),
  );
  await popup.waitForTimeout(400);
  await popup.screenshot({
    path: `${EVIDENCE_DIR}/07-owner-print-popup-tables.png`,
  });
  await popup.close().catch(() => undefined);

  // PDF: a real application/pdf artifact (multi-page handled by the engine).
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 120_000 }),
    page.getByRole('button', { name: 'PDF', exact: true }).first().click(),
  ]);
  const pdfPath = `${EVIDENCE_DIR}/08-owner-report.pdf`;
  await download.saveAs(pdfPath);
  const pdfBytes = readFileSync(pdfPath);
  const latin = pdfBytes.toString('latin1');
  facts.push({
    id: 'owner-pdf-artifact',
    suggested: download.suggestedFilename(),
    bytes: pdfBytes.length,
    magic: pdfBytes.subarray(0, 5).toString(),
    pages: (latin.match(/\/Type\s*\/Page[^s]/g) ?? []).length,
  });
  expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-');

  // Share: emulate a browser without the Web Share API (e.g. Firefox on
  // Linux) — headless Chromium's navigator.share would hang without ever
  // showing a sheet. The app's honest fallback must download the PDF from
  // the same stamp, copy a safe link, and toast about both.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: () => false,
      configurable: true,
    });
  });
  const [shareDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 120_000 }),
    page.getByRole('button', { name: 'مشاركة' }).first().click(),
  ]);
  await expect(page.getByText('الرابط الآمن')).toBeVisible({ timeout: 10_000 });
  const fallback = await page.evaluate(() => {
    const toastText = document.body.innerText;
    const clipPromise = navigator.clipboard.readText().catch(() => '');
    return clipPromise.then((clip) => ({
      mentionsSecureLink:
        toastText.includes('الرابط الآمن') ||
        toastText.includes('تم نسخ رابط التقرير'),
      clip: clip.slice(0, 140),
    }));
  });
  facts.push({
    id: 'owner-share-fallback',
    ...fallback,
    shareDownloadName: shareDownload.suggestedFilename(),
  });
  expect(fallback.mentionsSecureLink).toBe(true);
  expect(fallback.clip).toContain('/reports/owner-comprehensive-statement');
  await capture(page, '09-owner-report-after-share');
  await context.close();

  /* 4 — tenant product (dark) reuses the shared action bar. */
  context = await preparedContext(browser, {
    width: 1440,
    height: 1000,
    theme: 'dark',
  });
  page = await context.newPage();
  await seed(page);
  await open(
    page,
    `/reports/tenant-statement?contractId=${IDS.contract}&from=2026-01-01&to=2026-12-31`,
  );
  await expect(
    page.locator('[data-report-product-page="tenant-statement"]'),
  ).toBeVisible();
  await capture(page, '10-tenant-report-desktop-dark');
  await context.close();

  /* 5 — collections product: sub-target tabs + honest empty state. */
  context = await preparedContext(browser, { width: 1440, height: 1000 });
  page = await context.newPage();
  await seed(page);
  await open(
    page,
    '/reports/collections-arrears-cheques?view=period&from=2026-01-01&to=2026-12-31',
  );
  facts.push({
    id: 'collections-tabs',
    tabs: await page.locator('[data-report-product-tabs] [role="tab"]').count(),
  });
  await capture(page, '11-collections-period');
  await open(
    page,
    '/reports/collections-arrears-cheques?view=period&from=2020-01-01&to=2020-01-31',
  );
  await capture(page, '12-collections-empty-state');
  await context.close();

  /* 6 — portfolio product: charts are allowed inside the detail route. */
  context = await preparedContext(browser, { width: 1440, height: 1000 });
  page = await context.newPage();
  await seed(page);
  await open(
    page,
    '/reports/portfolio-property-performance?view=office&from=2026-01-01&to=2026-12-31',
  );
  facts.push({
    id: 'portfolio-visuals',
    visualsInsideDetail: await page
      .locator(
        '[data-report-product-content] svg, [data-report-product-content] canvas',
      )
      .count(),
  });
  await capture(page, '13-portfolio-office');
  await context.close();

  /* 7 — financial pack (trial balance from the seeded 150-account ledger). */
  context = await preparedContext(browser, { width: 1440, height: 1000 });
  page = await context.newPage();
  await seed(page);
  await open(
    page,
    '/reports/financial-settlement-pack?view=statements&asOf=2026-12-31',
  );
  facts.push({
    id: 'financial-pack',
    trialBalanceVisible: await page
      .getByText('ميزان المراجعة')
      .first()
      .isVisible()
      .catch(() => false),
  });
  await page
    .getByText('ميزان المراجعة')
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => undefined);
  await capture(page, '14-financial-pack', { viewportOnly: true });
  await context.close();

  /* 8 — legacy deep links redirect to their canonical product route. */
  context = await preparedContext(browser, { width: 1440, height: 1000 });
  page = await context.newPage();
  await seed(page);
  await open(
    page,
    '/reports?section=accounting&view=general_ledger&from=2026-01-01&to=2026-12-31',
  );
  await expect(page).toHaveURL(
    /\/reports\/financial-settlement-pack\?view=ledger&from=2026-01-01&to=2026-12-31/,
  );
  await expect(
    page.locator('[data-report-product-page="financial-settlement-pack"]'),
  ).toBeVisible();
  facts.push({
    id: 'legacy-redirect',
    canonicalPath: await page.evaluate(
      () => window.location.pathname + window.location.search,
    ),
    productPage: await page
      .locator('[data-report-product-page="financial-settlement-pack"]')
      .count(),
  });
  await capture(page, '15-legacy-redirect-product');

  await open(page, '/reports/ghost-report-404');
  facts.push({
    id: 'unknown-product',
    honestState: await page.locator('[data-report-product-not-found]').count(),
  });
  await capture(page, '16-unknown-product');
  await context.close();

  /* 9 — mobile detail page keeps the two-pane actions reachable. */
  context = await preparedContext(browser, { width: 390, height: 844 });
  page = await context.newPage();
  await seed(page);
  await open(
    page,
    `/reports/owner-comprehensive-statement?ownerId=${IDS.owner}&from=2026-01-01&to=2026-12-31`,
  );
  facts.push({
    id: 'owner-mobile',
    overflow: await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  });
  await capture(page, '17-owner-report-mobile-390');
  await context.close();

  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(
    `${EVIDENCE_DIR}/evidence.json`,
    JSON.stringify({ summary, facts }, null, 2),
  );
  // The catalog contract itself is asserted hard — if it regressed to a
  // dashboard, this evidence run must fail.
  expect(summary.landing).toEqual(
    expect.objectContaining({
      cards: 5,
      kpiLayer: 0,
      charts: 0,
      filterSurface: 0,
      money: false,
    }),
  );
});
