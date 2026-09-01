import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ACCOUNTING_REPORT_VIEWS, ANALYTICS_REPORT_VIEWS } from './report-view-registry';
import { LEGACY_REPORT_DESTINATION_MAP, REPORT_PRODUCTS } from './report-products';

const reportsDir = resolve(dirname(fileURLToPath(import.meta.url)));
const reportsPage = readFileSync(resolve(reportsDir, 'reports-page.tsx'), 'utf8');
const catalogSource = readFileSync(resolve(reportsDir, 'components/ReportsCatalog.tsx'), 'utf8');

describe('reports center — premium report catalog contract', () => {
  it('publishes exactly the five approved report products', () => {
    expect(REPORT_PRODUCTS.map((product) => product.title)).toEqual([
      'كشف المالك الشامل',
      'كشف حساب المستأجر',
      'التحصيل والمتأخرات والشيكات',
      'أداء المحفظة والعقارات',
      'الحزمة المالية والتسويات',
    ]);
    expect(REPORT_PRODUCTS).toHaveLength(5);
    expect(new Set(REPORT_PRODUCTS.map((product) => product.id)).size).toBe(5);
  });

  it('makes the bare /reports page a catalog rather than a dashboard', () => {
    expect(reportsPage).toContain('<ReportsCatalog />');
    expect(catalogSource).toContain('data-reports-premium-catalog');
    expect(catalogSource).not.toMatch(/KpiCard|ResponsiveChart|ChartContainer|formatMoney|financialSummary|collectionRate/);
    expect(catalogSource).not.toContain('ReportDirectory');
    expect(catalogSource).not.toContain('Dialog');
  });

  it('keeps the catalog at least two columns on mobile and three/four on larger screens', () => {
    expect(catalogSource).toContain('grid-cols-2');
    expect(catalogSource).toContain('lg:grid-cols-3');
    expect(catalogSource).toContain('2xl:grid-cols-4');
    expect(catalogSource).not.toContain('grid-cols-1');
  });

  it('opens durable report URLs and leaves legacy workspace links compatible', () => {
    expect(catalogSource).toContain("to: '/reports'");
    expect(catalogSource).toContain('report: product.id');
    expect(reportsPage).toContain('data-open-report-product');
    expect(reportsPage).toContain('data-legacy-report-location');
    expect(reportsPage).toContain('<ReportsPrimaryNavigation');
  });

  it('assigns every useful legacy analytics/accounting view to a premium product', () => {
    for (const view of [...ANALYTICS_REPORT_VIEWS, ...ACCOUNTING_REPORT_VIEWS]) {
      expect(LEGACY_REPORT_DESTINATION_MAP[view.id], `${view.id} must have a premium destination`).toBeTruthy();
    }
    expect(LEGACY_REPORT_DESTINATION_MAP.statements).toBe('owner-comprehensive-statement');
  });

  it('does not invent a post-dated-cheque custody lifecycle', () => {
    expect(reportsPage).toContain('لا توجد في نموذج البيانات الحالي دورة حيازة موثقة للشيك المؤجل');
    expect(reportsPage).toContain('لا يعرض MALEK حالات شيكات مصطنعة');
  });

  it('keeps specialist accounting inside the financial pack rather than top-level catalog noise', () => {
    const financialPack = REPORT_PRODUCTS.find((product) => product.id === 'financial-settlement-pack');
    expect(financialPack?.targets.map((target) => target.view)).toEqual([
      '',
      'accounting_reports',
      'general_ledger',
      'deferred_revenue',
    ]);
    expect(REPORT_PRODUCTS.some((product) => product.id === ('general-ledger' as never))).toBe(false);
  });
});
