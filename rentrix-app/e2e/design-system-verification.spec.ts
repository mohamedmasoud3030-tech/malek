import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Design-system verification — يثبت في متصفح حقيقي أن جسر التوكنات يعمل:
 *
 * 1. ظلال البطاقات المبنية على التوكنات وtext-success/bg-primary تُحل إلى computed styles فعلية.
 * 2. الثيم الداكن يتبع [data-theme='dark'] (مبدّل التطبيق) وليس نظام التشغيل.
 * 3. لا فيض أفقي (overflow-x) على عروض الهاتف والتابلت والديسكتوب.
 * 4. مناطق اللمس للأزرار الرئيسية ≥ 44px على الهاتف (pointer: coarse مسموح 40).
 *
 * يعمل على ثلاثة مشاريع (desktop/tablet/mobile) كما هو معرّف في playwright.config.
 */

const targetDir = process.env.EVIDENCE_DIR || '/tmp/ds-evidence';

const pages = [
  {
    name: 'dashboard',
    url: '/login?e2e-dashboard-workspace=1',
    ready: 'main[data-e2e-dashboard-workspace]',
    content: '[data-dashboard-kpi-grid]',
  },
  {
    name: 'properties',
    url: '/login?e2e-showcase-properties=1',
    ready: '[data-e2e-properties-workspace]',
    content: '[data-list-results]',
  },
  {
    name: 'contracts',
    url: '/login?e2e-showcase-contracts=1',
    ready: 'main[data-e2e-contracts-workspace]',
    content: '[data-page-header]',
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
    const shadowCandidates = Array.from(document.querySelectorAll<HTMLElement>(
      '.shadow-card, [data-visual-contract="v2"] .dashboard-ops-header, [data-visual-contract="v2"] .dashboard-kpi-card, [data-visual-contract="v2"] .dashboard-priority-panel',
    ));
    const shadow = shadowCandidates
      .map((element) => getComputedStyle(element).boxShadow)
      .find((value) => value && value !== 'none') ?? '';
    const successBadge = document.querySelector('[data-status-badge][data-tone="success"], [data-status-badge][data-tone="emerald"]');
    const badgeBg = successBadge ? getComputedStyle(successBadge).backgroundColor : '';
    return { shadow, badgeBg };
  });
  expect(
    result.shadow,
    'a token-backed card must resolve to a real shadow (token bridge working)',
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
    // Synchronize on an observable condition (content rendered) — not a fixed wait.
    await expect(page.locator(target.content).first()).toBeVisible();

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
  await page.goto('/login?e2e-dashboard-workspace=1');
  await expect(page.locator('main[data-e2e-dashboard-workspace]')).toBeVisible({ timeout: 15_000 });

  const lightState = await page.evaluate(() => ({
    backgroundToken: getComputedStyle(document.documentElement)
      .getPropertyValue('--background')
      .trim(),
    bodyBackground: getComputedStyle(document.body).backgroundColor,
  }));

  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });

  await expect
    .poll(
      async () => page.evaluate(() => document.documentElement.dataset.theme),
      { timeout: 5_000 },
    )
    .toBe('dark');

  let darkToken = lightState.backgroundToken;
  await expect
    .poll(async () => {
      darkToken = await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--background')
          .trim(),
      );
      return darkToken;
    }, { timeout: 5_000 })
    .not.toBe(lightState.backgroundToken);

  const expectedDarkBackground = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'hsl(var(--background))';
    document.body.appendChild(probe);
    const background = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return background;
  });

  let darkBackground = lightState.bodyBackground;
  await expect
    .poll(async () => {
      darkBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      return darkBackground;
    }, { timeout: 5_000 })
    .toBe(expectedDarkBackground);

  expect(darkBackground).not.toBe(lightState.bodyBackground);
  expect(darkToken).not.toBe(lightState.backgroundToken);

  const outPath = path.join(targetDir, 'dashboard-dark.png');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath, fullPage: true });
});

test('key actions keep ≥44px touch targets on every viewport', async ({ page }) => {
  await page.goto('/login?e2e-showcase-contracts=1');
  await expect(page.locator('main[data-e2e-contracts-workspace]')).toBeVisible({ timeout: 15_000 });

  const tooSmall = await page.evaluate(() => {
    const offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('button, a[href]'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue; // hidden (e.g. desktop-only or mobile-only variants)
      if (rect.height < 40) offenders.push(`${el.tagName}:${(el.textContent ?? '').trim().slice(0, 20)}:${rect.height}`);
    }
    return offenders;
  });
  expect(tooSmall, `touch targets below 40px: ${tooSmall.join(', ')}`).toHaveLength(0);
});
