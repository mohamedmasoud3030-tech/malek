import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

describe('UX completion contract', () => {
  it('keeps all shared button sizes at or above the 44px touch target', () => {
    const button = source('components/ui/button.tsx');
    expect(button).toContain("xs: 'min-h-11 min-w-11");
    expect(button).toContain("sm: 'min-h-11 min-w-11");
    expect(button).toContain("md: 'min-h-11 min-w-11");
    expect(button).toContain("icon: 'size-11");
  });

  it('keeps finance UX free of hardcoded OMR presentation fallbacks', () => {
    const reportWorkspace = source('features/reports/components/ReportsWorkspace.tsx');
    const deposits = source('features/financials/deposits/deposits-workspace.tsx');
    const expenses = source('features/financials/expenses/expenses-page.tsx');
    const banking = source('features/financials/reconciliation/bank-reconciliation-page.tsx');
    const commissions = source('features/commissions/components/commissions-view.tsx');

    for (const file of [reportWorkspace, deposits, expenses, banking, commissions]) {
      expect(file).not.toContain('unit="OMR"');
      expect(file).not.toContain("unit='OMR'");
    }
    expect(deposits).not.toContain('OMR_CURRENCY_CONFIG');
  });

  it('keeps high-volume registers as desktop tables with mobile cards', () => {
    const files = [
      'features/financials/deposits/deposits-workspace.tsx',
      'features/owners/components/OwnerSettlementWorkspace.tsx',
      'features/financials/reconciliation/bank-reconciliation-page.tsx',
      'features/commissions/components/commissions-view.tsx',
      'features/financials/components/overdue-invoices-table.tsx',
      'features/utilities/components/utilities-workspace.tsx',
      'features/lands/components/lands-view.tsx',
      'features/communication/components/communication-hub-view.tsx',
      'features/automation/components/automation-center-view.tsx',
      'features/audit/components/audit-log-view.tsx',
    ];

    for (const file of files) {
      const code = source(file);
      expect(code, file).toContain('EntityTable');
    }

    for (const file of files.filter((file) => !file.includes('audit-log-view'))) {
      expect(source(file), file).toContain('MobileCard');
    }
  });

  it('never asks users to type technical UUID references in lands or communication', () => {
    const lands = source('features/lands/components/lands-view.tsx');
    const communication = source('features/communication/components/communication-hub-view.tsx');

    expect(lands).not.toContain('معرف المالك');
    expect(lands).toContain('اختر المالك من السجل بدل إدخال UUID');
    expect(communication).not.toContain('معرف الربط');
    expect(communication).not.toContain('معرف الكيان');
  });

  it('keeps owner actions contextual and hides internal record identifiers', () => {
    const owners = source('features/owners/components/owner-workspace-table.tsx');
    expect(owners).not.toContain('معرّف السجل');
    expect(owners).not.toContain('<Link to="/reports"');
    expect(owners).toContain('التفاصيل');
    expect(owners).toContain('العلاقات');
    expect(owners).toContain('تعديل');
  });

  it('requires confirmation before utility meter and bill archive actions', () => {
    const utilities = source('features/utilities/components/utilities-workspace.tsx');
    expect(utilities).toContain('أرشفة عداد المرافق؟');
    expect(utilities).toContain('أرشفة فاتورة المرافق؟');
    expect(utilities).toContain('meterToArchive');
    expect(utilities).toContain('billToArchive');
  });

  it('keeps generic data errors and settings load failures from exposing raw provider messages', () => {
    const dataError = source('components/data-error-screen.tsx');
    const settings = source('features/settings/settings-page.tsx');
    expect(dataError).toContain('SAFE_DATA_ERROR_FALLBACK');
    expect(settings).not.toContain('companySettingsQuery.error.message');
  });
});
