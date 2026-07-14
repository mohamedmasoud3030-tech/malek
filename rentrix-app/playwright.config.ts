import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 5173);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const isExternalTarget = Boolean(process.env.E2E_BASE_URL);
const isCredentialedStaging = process.env.E2E_ENVIRONMENT_KIND === 'staging';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: isCredentialedStaging ? 0 : process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: isCredentialedStaging
    ? [['list']]
    : process.env.CI
      ? [['list'], ['html', { open: 'never' }]]
      : [['list']],
  use: {
    baseURL,
    trace: isCredentialedStaging ? 'off' : 'retain-on-failure',
    screenshot: isCredentialedStaging ? 'off' : 'only-on-failure',
    video: isCredentialedStaging ? 'off' : 'retain-on-failure',
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
  },
  webServer: isExternalTarget
    ? undefined
    : {
        command: 'pnpm dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? 'https://example.supabase.co',
          VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? 'test-anon-key',
          VITE_E2E: 'true',
        },
      },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'chromium-tablet',
      use: { ...devices['iPad Mini'], browserName: 'chromium', viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'], browserName: 'chromium', viewport: { width: 375, height: 812 } },
    },
  ],
});
