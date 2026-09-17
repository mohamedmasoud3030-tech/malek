import { defineConfig, devices } from '@playwright/test';

/**
 * Release verification configuration — REAL backends only.
 *
 * Kept deliberately separate from `playwright.config.ts` so that:
 *   - the hermetic suite can never accidentally start depending on live
 *     credentials, and
 *   - the release suites can never be silenced by the hermetic suite's
 *     env-conditional skips.
 *
 * There is NO `webServer` block here. These suites must target an already
 * deployed surface (`E2E_BASE_URL`) so they verify what users actually reach.
 * If `E2E_BASE_URL` is absent the run fails during collection rather than
 * silently testing localhost.
 */
const baseUrl = process.env.E2E_BASE_URL?.trim();
if (!baseUrl) {
  throw new Error(
    'E2E_BASE_URL is required for release verification. Point it at the deployed surface under review '
    + '(for example https://malek-plus.vercel.app). It is never inferred.',
  );
}

const parsedBaseUrl = new URL(baseUrl);
if (parsedBaseUrl.protocol !== 'https:') {
  throw new Error(`E2E_BASE_URL must use HTTPS for release verification, got "${parsedBaseUrl.protocol}".`);
}

export default defineConfig({
  testDir: './e2e/release',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  forbidOnly: true,
  // A release must be reproducible: no retry-driven green.
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: parsedBaseUrl.origin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'ar-EG',
    timezoneId: 'Asia/Muscat',
  },
  projects: [
    {
      name: 'release-chromium',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', viewport: { width: 1440, height: 1000 } },
    },
  ],
});
