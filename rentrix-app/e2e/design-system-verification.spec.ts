import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Design-system verification — يثبت في متصفح حقيقي أن جسر التوكنات يعمل:
 *
 * 1. shadow-card/text-success/bg-primary … إلخ أصبحت فئات فعلية (computed styles).
 * 2. الثيم الداكن يتبع [data-theme='dark'] (مبدّل التطبيق) وليس نظام التشغيل.
 * 3. لا فيض أفقي (overflow-x) على عروض الهاتف والتابلت والديسكتوب.
 * 4. مناطق اللمس للأزرار الرئيسية ≥ 44px على الهاتف (pointer: coarse مسموح 40).
 *
 * يعمل على ثلاثة مشاريع (desktop/tablet/mobile) كما هو معرّف في playwright.config.
 * ON-DEMAND spec — لا يعمل في CI حاليًا (لا متصفحات هناك).
 */

const targetDir = process.env.EVIDENCE_DIR || '/tmp/ds-evidence';

const pages = [
  {
    name: 'dashboard',
    url: '/login?e2e-dashboard-workspace=1',
    ready: 'main[data-e2e-dashboard-workspace]',
  },
  {
    name: 'properties',
    url: '/login?e2e-showcase-properties=1',
    ready: '[data-e2e-properties-workspace]',
  },
  {
    name: 'contracts',
    url: '/login?e2e-showcase-contracts=1',
    ready: 'main[data-e2e-contracts-workspace]',
  },
] as const;

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    metrics.scrollWidth,
    `${label}: horizontal overflow detected (scrollWidth ${metrics.scrollWidth} > innerWidth ${metrics.innerWidth})`,
  ).toBeLessThanOrEqual(metrics.innerWidth + 1);
}

async function expectTokenUtilitiesReal(page: Page) {
  const result = await page.evaluate(() => {
    const shadowHost = document.querySelector('.shadow-card');
    const shadow = shadowHost ? getComputedStyle(shadowHost).boxShadow : '';
    const successBadge = document.querySelector('[data-status-badge][data-tone="success"], [data-status-badge][data-tone="emerald"]');
    const badgeBg = successBadge ? getComputedStyle(successBadge).backgroundColor : '';
    return { shadow, badgeBg };
  });
  expect(
    result.shadow,
    'shadow-card must resolve to a real shadow (token bridge working)',
  ).not.toBe('');
  expect(result.shadow).not.toBe('none');
  if (result.badgeBg) {
    expect(result.badgeBg).not.toBe('rgba(0, 0, 0, 0)');
  }
}

for (const target of pages) {
  test(`${target.name}: renders without horizontal overflow and with real token utilities`, async ({ page }, testInfo) => {
    await page.goto(target.url);
    await expect(page.locator(target.ready).first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);

    await expectNoHorizontalOverflow(page, `${target.name} @${testInfo.project.name}`);
    await expectTokenUtilitiesReal(page);

    const outPath = path.join(targetDir, `${target.name}-${testInfo.project.name}.png`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath, fullPage: true });
  });
}

test('contracts: unified PageHeader renders h1 with record count badge', async ({ page }) => {
  await page.goto('/login?e2e-showcase-contracts=1');
  await expect(page.locator('main[data-e2e-contracts-workspace]')).toBeVisible({ timeout: 15_000 });

  const header = page.locator('[data-page-header]');
  await expect(header.locator('h1')).toHaveText('العقود');
  await expect(header.getByLabel(/عدد السجلات/)).toBeVisible();
  await expect(page.locator('[data-list-controls]')).toBeVisible();
});

test('theme dark follows the app toggle (data-theme), not prefers-color-scheme', async ({ page }) => {
  // 1) Load in light theme and record the body background.
  await page.goto('/login?e2e-dashboard-workspace=1');
  await expect(page.locator('main[data-e2e-dashboard-workspace]')).toBeVisible({ timeout: 15_000 });
  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  // 2) Flip the app theme attribute exactly like ui-store does, then poll:
  //    custom-property inheritance may apply a frame after the DOM write.
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  let darkBg = lightBg;
  await expect
    .poll(async () => {
      darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      return darkBg;
    }, { timeout: 5_000 })
    .not.toBe(lightBg);
  const channels = darkBg.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
  expect(
    Math.max(...channels),
    `dark background must be dark, got ${darkBg}`,
  ).toBeLessThan(80);

  const outPath = path.join(targetDir, 'dashboard-dark.png');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath, fullPage: true });
});

test('mobile: key actions keep ≥44px touch targets', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile', 'touch-target audit runs on the mobile project');
  await page.goto('/login?e2e-showcase-contracts=1');
  await expect(page.locator('main[data-e2e-contracts-workspace]')).toBeVisible({ timeout: 15_000 });

  const tooSmall = await page.evaluate(() => {
    const offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('button, a[href]'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue; // hidden
      if (rect.height < 40) offenders.push(`${el.tagName}:${(el.textContent ?? '').trim().slice(0, 20)}:${rect.height}`);
    }
    return offenders;
  });
  expect(tooSmall, `touch targets below 40px on mobile: ${tooSmall.join(', ')}`).toHaveLength(0);
});
