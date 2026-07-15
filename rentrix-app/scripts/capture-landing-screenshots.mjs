// Capture REAL screenshots of the Rentrix app for the /landing marketing page.
//
// Usage (run against a LIVE instance of the app):
//   1) Start the app with the e2e fixture enabled (for the reports shot, no backend needed):
//        VITE_E2E=1 pnpm dev            # then open http://localhost:5173
//   2) For authenticated screens, provide credentials + the app URL:
//        APP_URL=http://localhost:5173 \
//        RENTRIX_EMAIL=you@example.com \
//        RENTRIX_PASSWORD=**** \
//        node scripts/capture-landing-screenshots.mjs
//
// Output: public/landing/{dashboard,properties,contracts,workspace}.png
// The landing page references these via <ProductScreenshot src="/landing/...png" />
// and falls back to a mock if a file is missing.

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const OUT = 'public/landing';
const EMAIL = process.env.RENTRIX_EMAIL;
const PASSWORD = process.env.RENTRIX_PASSWORD;
const E2E = process.env.VITE_E2E === '1';

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 2 });

async function shot(name, path, opts = {}) {
  console.log(`→ capturing ${name} (${path})`);
  await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle', timeout: 60000 });
  if (opts.waitSelector) {
    await page.waitForSelector(opts.waitSelector, { timeout: 60000 }).catch(() => {});
  }
  await page.waitForTimeout(opts.wait ?? 2000);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: opts.full !== false });
  console.log(`✓ saved public/landing/${name}.png`);
}

if (E2E) {
  // Reports workspace e2e fixture (renders real components, no backend needed).
  // Saved as workspace.png to match the showcase reference on the landing page.
  await shot('workspace', '/login?e2e-reports-workspace=1', {
    waitSelector: '[data-e2e-reports-workspace]',
    full: false,
  });
}

if (EMAIL && PASSWORD) {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' });
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
