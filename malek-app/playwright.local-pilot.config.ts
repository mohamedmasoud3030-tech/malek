import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Deliberately separate from hermetic regression and hosted-release suites.
export default defineConfig({
  ...base,
  testDir: './local-proof',
  testIgnore: [],
  workers: 1,
  retries: 0,
});
