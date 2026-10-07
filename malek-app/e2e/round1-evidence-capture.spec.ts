import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { expectValidScreenshotTarget, type ScreenshotValidityTarget } from './support/screenshot-validity';

const shouldCapture = process.env.UPDATE_ROUND1_EVIDENCE === '1';
const evidenceDirectory = fileURLToPath(new URL('../../docs/execution/evidence/pr-1749-round1/', import.meta.url));

const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 375, height: 812 },
] as const;

type EvidenceTarget = ScreenshotValidityTarget & Readonly<{
  name: string;
  fileStem: string;
  scrollRatio?: number;
}>;

const targets: readonly EvidenceTarget[] = [
  { name: 'Today dashboard first viewport', fileStem: 'dashboard-first', route: '/login?e2e-dashboard-workspace=1', expectedUrlIncludes: 'e2e-dashboard-workspace=1', identityMarker: 'main[data-e2e-dashboard-workspace]', identityText: /اليوم|نبض المكتب/, scrollRatio: 0 },
  { name: 'Today dashboard mid', fileStem: 'dashboard-mid', route: '/login?e2e-dashboard-workspace=1', expectedUrlIncludes: 'e2e-dashboard-workspace=1', identityMarker: 'main[data-e2e-dashboard-workspace]', identityText: /اليوم|نبض المكتب/, scrollRatio: 0.5 },
  { name: 'Today dashboard lower', fileStem: 'dashboard-lower', route: '/login?e2e-dashboard-workspace=1', expectedUrlIncludes: 'e2e-dashboard-workspace=1', identityMarker: 'main[data-e2e-dashboard-workspace]', identityText: /اليوم|نبض المكتب/, scrollRatio: 1 },
  { name: 'Portfolio property register', fileStem: 'portfolio-register', route: '/login?e2e-showcase-properties=1', expectedUrlIncludes: 'e2e-showcase-properties=1', identityMarker: 'main[data-e2e-properties-workspace]', identityText: /العقارات/ },
  { name: 'Leasing contracts register', fileStem: 'leasing-contracts', route: '/login?e2e-showcase-contracts=1', expectedUrlIncludes: 'e2e-showcase-contracts=1', identityMarker: 'main[data-e2e-contracts-workspace]', identityText: /العقود/ },
  { name: 'Actual contract detail workspace', fileStem: 'contract-detail', route: '/login?e2e-contract-detail-workspace=1', expectedUrlIncludes: 'e2e-contract-detail-workspace=1', identityMarker: 'main[data-e2e-contract-detail-workspace]', identityText: /مساحة عمل العقد|CON-2026-01749/, entityMarker: 'CON-2026-01749' },
  { name: 'Money overview and invoices', fileStem: 'money-overview-invoices', route: '/login?e2e-showcase-financials=1', expectedUrlIncludes: 'e2e-showcase-financials=1', identityMarker: 'main[data-e2e-financials-workspace]', identityText: /الملخص المالي|جدول الفواتير/ },
  { name: 'Services maintenance workflow', fileStem: 'services-maintenance', route: '/login?e2e-showcase-maintenance=1', expectedUrlIncludes: 'e2e-showcase-maintenance=1', identityMarker: 'main[data-e2e-maintenance-workspace]', identityText: /الصيانة|بلاغات/ },
  { name: 'Settings authority', fileStem: 'settings', route: '/login?e2e-settings-workspace=1', expectedUrlIncludes: 'e2e-settings-workspace=1', identityMarker: 'main[data-e2e-settings-workspace]', identityText: /إعدادات المكتب/ },
  { name: 'Dense shared entity-form dialog fixture', fileStem: 'dense-entity-form-dialog', route: '/login?e2e-form-contract=1&surface=dialog', expectedUrlIncludes: 'e2e-form-contract=1', identityMarker: 'main[data-e2e-form-contract]', identityText: /اختبار عقد الفورم المشترك|إضافة جهة اتصال/, entityMarker: 'إضافة جهة اتصال' },
];

test.describe('Round 1 evidence capture', () => {
  test.skip(!shouldCapture, 'Set UPDATE_ROUND1_EVIDENCE=1 to regenerate governed evidence.');

  test('captures only route and identity validated targets', async ({ page }) => {
    await mkdir(evidenceDirectory, { recursive: true });
    const ledger: Array<Record<string, string>> = [];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const target of targets) {
        await page.goto(target.route, { waitUntil: 'domcontentloaded' });
        const validity = await expectValidScreenshotTarget(page, target);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));

        if (target.scrollRatio !== undefined) {
          await page.locator(target.identityMarker).evaluate((element, ratio) => {
            const scrollSurface = element as HTMLElement;
            scrollSurface.scrollTop = (scrollSurface.scrollHeight - scrollSurface.clientHeight) * ratio;
          }, target.scrollRatio);
        }

        await page.waitForTimeout(150);
        const viewportLabel = `${viewport.width}x${viewport.height}`;
        const file = `${target.fileStem}-${viewportLabel}.png`;
        await page.screenshot({ path: `${evidenceDirectory}${file}`, animations: 'disabled' });
        ledger.push({
          target: target.name,
          route: target.route,
          viewport: viewportLabel,
          identityMarker: target.identityMarker,
          url: validity.url,
          validity: validity.status,
          file,
        });
      }
    }

    await writeFile(`${evidenceDirectory}validity-ledger.json`, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  });
});
