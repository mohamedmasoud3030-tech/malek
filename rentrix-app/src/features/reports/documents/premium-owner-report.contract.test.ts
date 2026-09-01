import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = resolve(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(resolve(here, 'premium-owner-report.ts'), 'utf8');
const statements = readFileSync(resolve(here, '../components/StatementsSection.tsx'), 'utf8');

describe('premium owner statement — preservation and evidence contract', () => {
  it('enriches the Golden Owner Report rather than replacing its financial truth', () => {
    expect(source).toContain('buildOwnerReportPayload');
    expect(source).toContain('loadOwnerReportContext');
    expect(source).toContain('groups: [base.groups[0], assetGroup, ...base.groups.slice(1)]');
    expect(statements).toContain('loadPremiumOwnerReportPayload');
  });

  it('uses only existing RLS-scoped read services for unit and collection evidence', () => {
    for (const authority of ['listContractsForProperty', 'listUnits', 'loadInvoices', 'loadPayments', 'buildVacancyAnalytics']) {
      expect(source).toContain(authority);
    }
    expect(source).not.toMatch(/\.insert\(|\.update\(|\.delete\(|supabase\.rpc\(/);
  });

  it('keeps the owner-facing unit and collection evidence in the printed product', () => {
    for (const label of [
      'العقارات والوحدات والعقود',
      'المستأجر',
      'الإيجار',
      'استحقاقات وتحصيلات الوحدات للفترة',
      'المستحق',
      'المحصل',
      'غير المسدد',
      'حالة السداد',
      'آخر تحصيل',
      'مرجع الاستحقاق',
      'الوحدات الشاغرة ومدد الشغور',
      'مدة الشغور',
    ]) {
      expect(source).toContain(label);
    }
  });

  it('states missing vacancy action data truthfully instead of fabricating workflow', () => {
    expect(source).toContain('لا يوجد إجراء موثّق في بيانات الوحدة الحالية');
  });
});
