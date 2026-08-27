import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const reportsDir = resolve(dirname(fileURLToPath(import.meta.url)));
const reportsPage = readFileSync(resolve(reportsDir, 'reports-page.tsx'), 'utf8');
const directory = readFileSync(resolve(reportsDir, 'directory/ReportDirectory.tsx'), 'utf8');
const catalogue = readFileSync(resolve(reportsDir, 'directory/report-directory-groups.ts'), 'utf8');

describe('reports center IA contract', () => {
  it('keeps the report directory visible as the primary reports experience', () => {
    expect(reportsPage).toContain('data-reports-center-header');
    expect(reportsPage).toContain('<ReportDirectory');
    expect(reportsPage).toContain('data-active-report-workspace');
    expect(reportsPage).not.toContain('directoryOpen');
    expect(reportsPage).not.toContain('مكتبة التقارير');
  });

  it('keeps search, pinned reports, and domain tabs visible in the center', () => {
    expect(directory).toContain('بحث في مركز التقارير');
    expect(directory).toContain('المفضلة والتقارير المثبتة');
    expect(directory).toContain("id: 'all'");
    expect(directory).toContain('المالية والتحصيل');
    expect(directory).toContain('التأجير والإشغال');
    expect(directory).toContain('الصيانة');
    expect(directory).toContain('الملاك');
    expect(directory).toContain('التحليلات');
  });

  it('exposes the real operational report families without inventing frontend balances', () => {
    expect(catalogue).toContain('مسير التحصيل');
    expect(catalogue).toContain('المتأخرات وأعمار الديون');
    expect(catalogue).toContain('انتهاء العقود والتجديد');
    expect(catalogue).toContain('كشف حساب المالك');
    expect(catalogue).toContain('تحليل الصيانة');
    expect(catalogue).toContain('أداء العقارات');
    expect(directory).toContain('المصادر المعتمدة');
  });
});
