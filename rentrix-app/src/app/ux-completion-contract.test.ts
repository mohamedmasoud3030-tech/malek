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
    const reportWorkspace = source(
      'features/reports/premium/report-product-page.tsx',
    );
    const deposits = source(
      'features/financials/deposits/deposits-workspace.tsx',
    );
    const expenses = source('features/financials/expenses/expenses-page.tsx');
    const banking = source(
      'features/financials/reconciliation/bank-reconciliation-page.tsx',
    );
    const commissions = source(
      'features/commissions/components/commissions-view.tsx',
    );

    for (const file of [
      reportWorkspace,
      deposits,
      expenses,
      banking,
      commissions,
    ]) {
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
    }
  });

  it('never asks users to type technical references in lands or communication', () => {
    const lands = source('features/lands/components/lands-view.tsx');
    const communication = source(
      'features/communication/components/communication-hub-view.tsx',
    );

    expect(lands).not.toContain('UUID');
    expect(lands).not.toContain('معرف المالك');
    expect(lands).not.toContain('معرف داخلي');
    expect(communication).not.toContain('معرف الربط');
    expect(communication).not.toContain('معرف الكيان');
  });

  it('keeps owner actions contextual and hides internal record identifiers', () => {
    const owners = source(
      'features/owners/components/owner-workspace-table.tsx',
    );
    const ownerDetail = source(
      'features/owners/components/owner-detail-view.tsx',
    );
    expect(owners).not.toContain('معرّف السجل');
    expect(owners).not.toContain('<Link to="/reports"');
    // Owner detail access is the shared preview action across the registers,
    // with the full file only through the explicit action; relationship
    // management lives in the owner file, not the directory row.
    expect(owners).toContain('معاينة');
    expect(owners).toContain('فتح الملف الكامل');
    expect(owners).toContain('تعديل');
    expect(ownerDetail).toContain('<OwnerRelationshipManager');
  });

  it('requires confirmation before utility meter and bill archive actions', () => {
    const utilities = source(
      'features/utilities/components/utilities-workspace.tsx',
    );
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
    const depositWorkspace = source(
      'features/financials/deposits/deposits-workspace.tsx',
    );
    const depositForms = source(
      'features/financials/deposits/deposit-action-forms.tsx',
    );
    const depositController = source(
      'features/financials/deposits/use-deposit-workspace-controller.ts',
    );
    const statements = source(
      'features/reports/components/statements/statement-account-panels.tsx',
    );
    const system = source('features/system/system-page.tsx');

    expect(depositWorkspace).not.toContain('RPC ذري');
    expect(depositForms).not.toContain('RPC ذري');
    expect(depositForms).not.toContain('evidence://');
    expect(depositForms).not.toContain('.id.slice(0, 8)');
    expect(depositForms).toContain('getActionableSupabaseErrorMessage');
    expect(depositController).toContain('getActionableSupabaseErrorMessage');
    expect(depositController).not.toContain(
      'error instanceof Error ? error.message',
    );

    expect(statements).not.toContain('من RPC');
    expect(statements).not.toContain('formatShortId(');
    expect(statements).not.toContain('statement.commissionType ??');
    expect(statements).not.toContain('settlement في مصدر الكشف');
    expect(statements).toContain("if (type === 'RATE') return `نسبة");
    expect(statements).toContain(
      "if (type === 'FIXED_MONTHLY') return `مبلغ شهري",
    );

    expect(system).not.toContain('SQL مباشرة');
    expect(system).not.toContain('بلا RPC');
    expect(system).not.toContain('DDL');
  });

  it('keeps owner, people, password, lands, and property surfaces on safe operator language', () => {
    const ownerPreview = source(
      'features/owners/components/OwnerPreviewDialog.tsx',
    );
    const ownerList = source(
      'features/owners/components/owner-workspace-table.tsx',
    );
    const personForm = source('features/people/person-form-modal.tsx');
    const password = source('features/auth/change-password-page.tsx');
    const lands = source('features/lands/components/lands-view.tsx');
    const propertyForm = source('features/properties/property-form-modal.tsx');

    // The owner Quick Preview is row-data backed (no detail query of its own),
    // so no raw provider message can surface; the register owns safe errors.
    expect(ownerPreview).not.toContain('error.message');
    expect(ownerPreview).not.toContain('detailQuery.error.message');
    expect(ownerList).not.toContain('error.message');
    expect(personForm).toContain('getActionableSupabaseErrorMessage');
    expect(personForm).not.toContain('error instanceof Error ? error.message');
    expect(password).not.toContain('جلسة Supabase');
    expect(lands).toContain('WriteErrorCard');
    expect(lands).not.toContain(
      'writeError instanceof Error ? writeError.message',
    );
    expect(lands).not.toContain('?? row.status');
    expect(lands).not.toContain('?? row.category');
    expect(propertyForm).toContain('getActionableSupabaseErrorMessage');
    expect(propertyForm).not.toContain(
      'error instanceof Error ? error.message',
    );
    expect(propertyForm).not.toContain('عملية ذرية');
  });

  it('keeps specialist work out of routine navigation while preserving deep links', () => {
    const appNav = source('app/navigation/app-nav-items.ts');
    const commands = source('features/command-palette/command-registry.ts');
    const governance = source(
      'features/governance-hub/governance-hub-sections.ts',
    );
    const finance = source('features/finance/shell/financeShellModel.ts');
    const portfolio = source(
      'features/portfolio-hub/portfolio-hub-sections.ts',
    );
    const leasing = source(
      'features/relationships-hub/leasing-hub-sections.ts',
    );
    const operations = source(
      'features/operations-hub/operations-hub.sections.ts',
    );
    const reports = source('features/reports/report-products.ts');
    const settings = source('features/settings/registry/sectionRegistry.ts');
    const routes = source('app/router/route-tree.ts');

    expect(appNav).not.toContain("['/settings', 'automation'");
    expect(commands).not.toContain("id: 'automation'");
    expect(governance).toContain("id: 'automation'");
    expect(governance).toMatch(
      /id: 'automation'[\s\S]*?showInPrimaryNavigation: false/,
    );

    expect(finance).toMatch(/id: 'fees'[\s\S]*?showInPrimaryNavigation: false/);
    expect(finance).toMatch(
      /id: 'funds'[\s\S]*?showInPrimaryNavigation: false/,
    );
    expect(finance).toMatch(
      /id: 'banking'[\s\S]*?showInPrimaryNavigation: false/,
    );
    expect(portfolio).toMatch(
      /id: 'lands'[\s\S]*?showInPrimaryNavigation: false/,
    );
    expect(leasing).toMatch(
      /id: 'people'[\s\S]*?showInPrimaryNavigation: false/,
    );
    expect(leasing).toMatch(
      /id: 'leads'[\s\S]*?showInPrimaryNavigation: false/,
    );
    expect(leasing).toMatch(
      /id: 'communication'[\s\S]*?showInPrimaryNavigation: false/,
    );
    expect(operations).toMatch(
      /id: 'service_providers'[\s\S]*?showInPrimaryNavigation: false/,
    );
    expect(operations).toMatch(
      /id: 'documents_vault'[\s\S]*?showInPrimaryNavigation: false/,
    );
    expect(reports).not.toContain('showInPrimaryNavigation');
    for (const retainedTarget of [
      "id: 'revenue'",
      "id: 'property'",
      "id: 'occupancy'",
      "id: 'maintenance'",
    ]) {
      expect(reports).toContain(retainedTarget);
    }
    expect(settings).toMatch(
      /id: 'finance-readiness'[\s\S]*?showInPrimaryNavigation: false/,
    );
    expect(settings).toMatch(
      /id: 'cost-centers'[\s\S]*?showInPrimaryNavigation: false/,
    );
    expect(settings).toMatch(
      /id: 'payment-terms'[\s\S]*?showInPrimaryNavigation: false/,
    );

    expect(routes).not.toContain("path: '/automation'");
    expect(routes).not.toContain("path: '/documents-vault'");
    expect(routes).toContain("path: '/lands'");
    expect(routes).toContain("path: '/service-providers'");
  });
});
