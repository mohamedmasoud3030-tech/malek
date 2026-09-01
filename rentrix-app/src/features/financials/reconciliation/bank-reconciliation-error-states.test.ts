import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Bank reconciliation must never paint a successful empty list or zero KPI
 * grid when the accounts/lines queries fail. That false calm caused operators
 * to believe there was no bank activity.
 */
describe('bank reconciliation error vs empty honesty', () => {
  const page = readFileSync(
    resolve(import.meta.dirname, './bank-reconciliation-page.tsx'),
    'utf8',
  );

  it('renders ErrorState for accounts and lines failures with retry', () => {
    expect(page).toMatch(/import\s+\{[^}]*ErrorState[^}]*\}\s+from '@\/components\/ui\/error-state'/);
    expect(page).toContain('ctrl.accountsQuery.isError');
    expect(page).toContain('ctrl.linesQuery.isError');
    expect(page).toContain('تعذر تحميل الحسابات البنكية');
    expect(page).toContain('تعذر تحميل حركات كشف البنك');
    expect(page).toContain('onRetry={() => { void ctrl.accountsQuery.refetch(); }}');
    expect(page).toContain('onRetry={() => { void ctrl.linesQuery.refetch(); }}');
  });

  it('gates empty-state cards behind authoritative or cached payloads', () => {
    expect(page).toContain('!ctrl.accountsQuery.isLoading && !hasBlockingAccountsError && ctrl.accounts.length === 0');
    expect(page).toContain('!ctrl.linesQuery.isLoading && !hasBlockingLinesError && ctrl.lines.length === 0');
    expect(page).toContain('!hasBlockingLinesError ? (');
    expect(page).toContain('<BankStatementLinesTable');
  });

  it('does not show false zero KPIs for blocking errors but preserves stale populated KPIs', () => {
    expect(page).toContain('!hasBlockingAccountsError && !hasBlockingLinesError ? (');
    expect(page).toContain('hasStaleReadError');
    expect(page).toContain('<DataRefreshAlert');
    expect(page).toContain('<FinanceKpiGrid desktopColumns={4}>');
  });
});

describe('payment terms settings error honesty', () => {
  const section = readFileSync(
    resolve(import.meta.dirname, '../../settings/payment-terms-settings-section.tsx'),
    'utf8',
  );

  it('shows an alert on load failure instead of the empty catalog copy', () => {
    expect(section).toContain('paymentTermsQuery.isError');
    expect(section).toContain('تعذر تحميل شروط السداد');
    expect(section).toContain(
      '!paymentTermsQuery.isLoading && !paymentTermsQuery.isError && terms.length === 0',
    );
  });
});

describe('bank reconciliation mobile register hierarchy', () => {
  const page = readFileSync(
    resolve(import.meta.dirname, './bank-reconciliation-page.tsx'),
    'utf8',
  );

  it('surfaces amount as the mobile primary datum for unmatched money work', () => {
    expect(page).not.toContain('mobileVisibleSecondaryKey="amount"');
    expect(page).toContain("priority: 'identity'");
    expect(page).toContain("priority: 'primary'");
    expect(page).toContain("priority: 'actions'");
  });
});
