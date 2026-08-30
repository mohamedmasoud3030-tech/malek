import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ACCOUNTING_REPORT_VIEWS, getVisibleReportSubViews } from './report-view-registry';

const reportsDir = resolve(dirname(fileURLToPath(import.meta.url)));
const reportsPage = readFileSync(resolve(reportsDir, 'reports-page.tsx'), 'utf8');
const i18nResources = readFileSync(resolve(reportsDir, '../../lib/i18n.ts'), 'utf8');
const primaryNavigation = readFileSync(resolve(reportsDir, 'workspace/ReportsPrimaryNavigation.tsx'), 'utf8');
const catalogue = readFileSync(resolve(reportsDir, 'directory/report-directory-groups.ts'), 'utf8');
const registry = readFileSync(resolve(reportsDir, 'report-workspaces.ts'), 'utf8');

describe('reports center — MALEK workspace consolidation contract', () => {
  it('keeps one compact primary navigation as the reports experience', () => {
    expect(reportsPage).toContain('<ReportsPrimaryNavigation');
    expect(reportsPage).toContain('data-active-report-workspace');
    expect(reportsPage).not.toContain('<ReportDirectory');
    expect(reportsPage).not.toContain('MobileReportChooser');
  });

  it('shows five plain-language destinations without duplicate search and pinned layers', () => {
    for (const label of ['الملخص', 'التحصيل', 'العقارات والعقود', 'التشغيل', 'الكشوف']) {
      expect(primaryNavigation).toContain(label);
    }
    expect(reportsPage).not.toContain('بحث في مركز التقارير');
    expect(reportsPage).not.toContain('الأكثر استخدامًا');
  });

  it('keeps specialist financial review as one secondary destination', () => {
    expect(primaryNavigation).toContain('مراجعة متقدمة');
    expect(primaryNavigation).toContain("onOpen('financial_review', 'accounting_reports')");
  });

  it('exposes the approved workspace outcomes without accounting-shaped daily navigation', () => {
    for (const label of [
      'أداء المكتب',
      'التحصيل والمتأخرات',
      'العقود والإشغال',
      'التشغيل والمصروفات',
      'العقارات والوحدات',
      'الكشوف',
      'المراجعة المالية',
      'ملخص الفترة',
      'المتأخرات والأعمار',
      'المتابعة',
      'حركة التحصيل',
      'الإشغال والشغور',
      'العقود القريبة من الانتهاء',
      'نظرة تشغيلية',
      'الخدمات والمرافق',
      'ميزان المراجعة والقوائم',
      'دفتر الأستاذ والشجرة',
      'تسوية الإيرادات',
    ]) {
      expect(registry).toContain(label);
    }
    // Party-perspective doorways live in the directory catalogue.
    for (const label of ['كشف المالك', 'كشف المستأجر', 'التسويات والحركة المرتبطة']) {
      expect(catalogue).toContain(label);
    }
    // Business groups never expose the internal accounting section.
    expect(registry).not.toContain("defaultSection: 'accounting',\n    defaultView: 'overview'");
  });

  it('keeps raw accounting views available only to specialist navigation', () => {
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
    expect(i18nResources).toContain('ملخصات واضحة وكشوف جاهزة');
  });
});
