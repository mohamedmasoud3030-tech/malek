// Capture REAL screenshots of the Rentrix app for the /landing marketing page.
//
// The app ships self-contained E2E fixtures (real components, no backend needed)
// that render under /login with ?e2e-*-workspace=1 query params. We point a
// headless browser at those URLs and save real PNGs into public/landing/.
//
// Usage (run against a LOCAL instance started with the e2e fixture enabled):
//   1) Start the app (VITE_E2E turns on the fixtures, placeholder Supabase env
//      keeps the client from throwing on load):
//        VITE_SUPABASE_URL=https://example.supabase.co \
//        VITE_SUPABASE_ANON_KEY=test-anon-key \
//        VITE_E2E=true pnpm dev
//   2) Capture:
//        node scripts/capture-landing-screenshots.mjs
//
// Output: public/landing/{dashboard,workspace,settings,entity-form}.png
// The landing page references these via <ProductScreenshot src="/landing/...png" />
// and falls back to a mock if a file is missing.
//
// (For authenticated screens against a live instance, provide
//  APP_URL / RENTRIX_EMAIL / RENTRIX_PASSWORD — see the branch at the bottom.)

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const OUT = 'public/landing';
const EMAIL = process.env.RENTRIX_EMAIL;
const PASSWORD = process.env.RENTRIX_PASSWORD;
const E2E = process.env.VITE_E2E === '1' || process.env.VITE_E2E === 'true';

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1024 },
  deviceScaleFactor: 2,
});

async function shot(name, path, opts = {}) {
  console.log(`→ capturing ${name} (${path})`);
  await page.goto(`${APP_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  if (opts.waitSelector) {
    await page.waitForSelector(opts.waitSelector, { timeout: 60000 }).catch(() => {});
  }
  // Let web fonts (Arabic) and any lazy layout settle before snapping.
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(opts.wait ?? 2500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: opts.full === true });
  console.log(`✓ saved public/landing/${name}.png`);
}

if (E2E) {
  // Real, populated dashboard (KPIs, alerts, charts) — best hero/showcase shot.
  await shot('dashboard', '/login?e2e-dashboard-workspace=1', {
    waitSelector: '[data-e2e-dashboard-workspace]',
  });
  // Reports workspace (real section structure).
  await shot('workspace', '/login?e2e-reports-workspace=1', {
    waitSelector: '[data-e2e-reports-workspace]',
  });
  // Company settings workspace (real form, populated fields).
  await shot('settings', '/login?e2e-settings-workspace=1', {
    waitSelector: '[data-e2e-settings-workspace]',
  });
  // Shared entity form (overlay) — shows the unified data-entry surface.
  await shot('entity-form', '/login?e2e-form-contract=1&surface=full-page', {
    waitSelector: '[data-e2e-form-contract]',
  });
}

if (EMAIL && PASSWORD) {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-page-layout]', { timeout: 60000 }).catch(() => {});
  await shot('dashboard', '/');
  await shot('properties', '/properties');
  await shot('contracts', '/contracts');
} else {
  console.log('ℹ️  Skipped authenticated shots (set RENTRIX_EMAIL / RENTRIX_PASSWORD to capture them).');
}

await browser.close();
console.log('Done.');
