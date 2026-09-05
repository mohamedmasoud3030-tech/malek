import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const src = (...parts: string[]) =>
  fs.readFileSync(path.resolve(process.cwd(), 'src', ...parts), 'utf8');

describe('cross-workspace stale-data safety contracts', () => {
  it('keeps settings drafts visible but makes stale settings inert and unsavable', () => {
    const page = src('features/settings/settings-page.tsx');
    expect(page).toContain('companySettingsQuery.isError && !draft');
    expect(page).toContain('data-stale-settings-content');
    expect(page).toContain('inert={companySettingsQuery.isError ?');
    expect(page).toContain('isSaving || companySettingsQuery.isError');
  });

  it('fails closed for invoice mutations and documents when reads are unconfirmed', () => {
    const controller = src(
      'features/financials/invoices/useInvoiceWorkspaceController.ts',
    );
    expect(controller).toContain('hasAuthoritativeInvoiceList');
    expect(controller).toContain('hasAuthoritativeInvoiceDetail');
    expect(controller).toContain('&& hasAuthoritativeInvoiceList');
    expect(controller).toContain('&& hasAuthoritativeInvoiceDetail');
  });

  it('discloses incomplete reports and blocks export until all sources recover', () => {
    const model = src('features/reports/use-reports-workspace.ts');
    const productPage = src('features/reports/premium/report-product-page.tsx');
    expect(model).toContain('retryFailedSources');
    expect(model).toContain('isIncomplete: firstError != null');
    expect(productPage).toContain('نتائج التقرير غير مكتملة');
    expect(productPage).toContain('canExportReports && !model.isIncomplete');
  });

  it('preserves cached support requests with an explicit retry', () => {
    const support = src('features/help-support/help-support-page.tsx');
    expect(support).toContain('requests.isError && requests.data');
    expect(support).toContain('void requests.refetch()');
    expect(support).toContain('requests.isError && !requests.data');
  });

  it('prevents stale permission decisions and permission overwrites', () => {
    const roles = src(
      'features/governance-hub/components/UserRolesWorkspace.tsx',
    );
    expect(roles).toContain('hasUsersReadError && hasCachedUsersSnapshot');
    expect(roles).toContain(
      "pendingPermission={hasUsersReadError ? '__stale__'",
    );
    expect(roles).toContain(
      'requestsQuery.isError || decisionMutation.isPending',
    );
  });
});
