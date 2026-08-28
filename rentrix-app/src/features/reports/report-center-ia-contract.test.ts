import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ACCOUNTING_REPORT_VIEWS, getVisibleReportSubViews } from './report-view-registry';

const reportsDir = resolve(dirname(fileURLToPath(import.meta.url)));
const reportsPage = readFileSync(resolve(reportsDir, 'reports-page.tsx'), 'utf8');
const i18nResources = readFileSync(resolve(reportsDir, '../../lib/i18n.ts'), 'utf8');
const directory = readFileSync(resolve(reportsDir, 'directory/ReportDirectory.tsx'), 'utf8');
const catalogue = readFileSync(resolve(reportsDir, 'directory/report-directory-groups.ts'), 'utf8');

describe('reports center — MALEK target blueprint contract', () => {
  it('keeps the decision-first directory as the primary reports experience', () => {
    expect(reportsPage).toContain('<ReportDirectory');
    expect(reportsPage).toContain('data-active-report-workspace');
    expect(reportsPage).not.toContain('directoryOpen');
    expect(reportsPage).not.toContain('SectionTabs');
  });

  it('keeps search, frequent reports and business-domain tabs visible', () => {
    expect(directory).toContain('بحث في مركز التقارير');
    expect(directory).toContain('الأكثر استخدامًا');
    expect(directory).toContain("id: 'all'");
    expect(directory).toContain('أداء المكتب');
    expect(directory).toContain('التحصيل والمتأخرات');
    expect(directory).toContain('العقود والإشغال');
    expect(directory).toContain('المصروفات والصيانة');
    expect(directory).toContain('الملاك والمستأجرون');
    expect(directory).toContain('العقارات والوحدات');
  });

  it('exposes blueprint report outcomes without creating accounting-shaped daily navigation', () => {
    for (const label of [
      'أداء المكتب',
      'أداء العقار',
      'أداء الوحدة',
      'الإشغال والشغور',
      'التحصيل',
      'المتأخرات',
      'كشف المالك',
      'كشف المستأجر',
      'الصيانة',
      'العقود والتجديدات',
      'التسويات',
    ]) {
      expect(catalogue).toContain(label);
    }
    expect(catalogue).not.toContain("section: 'accounting'");
  });

  it('keeps raw accounting available only to specialist deep links', () => {
    expect(ACCOUNTING_REPORT_VIEWS.map((view) => view.id)).toEqual([
      'accounting_reports',
      'general_ledger',
      'deferred_revenue',
    ]);
    expect(ACCOUNTING_REPORT_VIEWS.every((view) => view.showInPrimaryNavigation === false)).toBe(true);
    expect(getVisibleReportSubViews('accounting')).toEqual([]);
  });

  it('keeps headline language source-authoritative', () => {
    expect(reportsPage).toContain("translateSharedLabel('reportsPageDescription')");
    expect(i18nResources).toContain('من المصدر المعتمد');
  });
});
