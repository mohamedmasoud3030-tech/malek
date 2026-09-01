import { expect, test } from '@playwright/test';
import { classifyScreenshotTarget } from './support/screenshot-validity';

const targets = [
  {
    name: 'dashboard workspace',
    route: '/login?e2e-dashboard-workspace=1',
    expectedUrlIncludes: 'e2e-dashboard-workspace=1',
    identityMarker: 'main[data-e2e-dashboard-workspace]',
    identityText: /لوحة التحكم|نبض المكتب/,
  },
  {
    name: 'contracts register',
    route: '/login?e2e-showcase-contracts=1',
    expectedUrlIncludes: 'e2e-showcase-contracts=1',
    identityMarker: 'main[data-e2e-contracts-workspace]',
    identityText: /العقود/,
  },
  {
    name: 'contract detail',
    route: '/login?e2e-contract-detail-workspace=1',
    expectedUrlIncludes: 'e2e-contract-detail-workspace=1',
    identityMarker: 'main[data-e2e-contract-detail-workspace]',
    identityText: /CON-2026-01749|مساحة عمل العقد/,
    entityMarker: 'CON-2026-01749',
  },
  {
    name: 'financial overview',
    route: '/login?e2e-showcase-financials=1',
    expectedUrlIncludes: 'e2e-showcase-financials=1',
    identityMarker: 'main[data-e2e-financials-workspace]',
    identityText: /الملخص المالي|جدول الفواتير/,
  },
  {
    name: 'maintenance workspace',
    route: '/login?e2e-showcase-maintenance=1',
    expectedUrlIncludes: 'e2e-showcase-maintenance=1',
    identityMarker: 'main[data-e2e-maintenance-workspace]',
    identityText: /الصيانة|بلاغات/,
  },
  {
    name: 'settings workspace',
    route: '/login?e2e-settings-workspace=1',
    expectedUrlIncludes: 'e2e-settings-workspace=1',
    identityMarker: 'main[data-e2e-settings-workspace]',
    identityText: /إعدادات المكتب/,
  },
] as const;

test.describe('Round 1 screenshot validity protocol', () => {
  for (const target of targets) {
    test(`${target.name} proves route and page identity before capture`, async ({ page }) => {
      await page.goto(target.route, { waitUntil: 'domcontentloaded' });
      const result = await classifyScreenshotTarget(page, target);
      expect(result, result.reason).toMatchObject({ status: 'VALID' });
    });
  }
});
