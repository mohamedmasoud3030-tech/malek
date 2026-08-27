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
    const reportWorkspace = source('features/reports/workspace/ReportsShell.tsx');
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

  it('keeps high-volume registers on the shared compact responsive table', () => {
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

    for (const file of files) {
      expect(source(file), file).not.toContain('renderMobileCard');
      expect(source(file), file).not.toContain('enableViewModeToggle');
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

  it('keeps statements and deposits free of technical implementation copy and raw identifiers', () => {
    const depositWorkspace = source('features/financials/deposits/deposits-workspace.tsx');
    const depositForms = source('features/financials/deposits/deposit-action-forms.tsx');
    const depositController = source('features/financials/deposits/use-deposit-workspace-controller.ts');
    const statements = source('features/reports/components/statements/statement-account-panels.tsx');
    const system = source('features/system/system-page.tsx');

    expect(depositWorkspace).not.toContain('RPC ذري');
    expect(depositForms).not.toContain('RPC ذري');
    expect(depositForms).not.toContain('evidence://');
    expect(depositForms).not.toContain('.id.slice(0, 8)');
    expect(depositForms).toContain('getActionableSupabaseErrorMessage');
    expect(depositController).toContain('getActionableSupabaseErrorMessage');
    expect(depositController).not.toContain('error instanceof Error ? error.message');

    expect(statements).not.toContain('من RPC');
    expect(statements).not.toContain('formatShortId(');
    expect(statements).not.toContain('statement.commissionType ??');
    expect(statements).not.toContain('settlement في مصدر الكشف');
    expect(statements).toContain("if (type === 'RATE') return `نسبة");
    expect(statements).toContain("if (type === 'FIXED_MONTHLY') return `مبلغ شهري");

    expect(system).not.toContain('SQL مباشرة');
    expect(system).not.toContain('بلا RPC');
    expect(system).not.toContain('DDL');
  });

  it('keeps owner, people, and password surfaces from exposing provider errors or names', () => {
    const ownerPreview = source('features/owners/components/OwnerPreviewDialog.tsx');
    const personForm = source('features/people/person-form-modal.tsx');
    const password = source('features/auth/change-password-page.tsx');

    expect(ownerPreview).toContain('getActionableSupabaseErrorMessage');
    expect(ownerPreview).not.toContain('detailQuery.error.message');
    expect(personForm).toContain('getActionableSupabaseErrorMessage');
    expect(personForm).not.toContain('error instanceof Error ? error.message');
    expect(password).not.toContain('جلسة Supabase');
  });
});