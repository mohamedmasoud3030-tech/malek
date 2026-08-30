import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AuthorizationContext } from '@/features/auth/permissions';
import {
  FINANCE_SECTIONS,
  FINANCE_VIEWS,
  getPermittedSections,
  getPermittedViews,
  resolveFinanceLocation,
} from './financeShellModel';

const admin: AuthorizationContext = { userId: 'u-admin', email: null, role: 'ADMIN' };
const user: AuthorizationContext = { userId: 'u-user', email: null, role: 'USER' };

describe('canonical Money workspace route model', () => {
  it('keeps six finance capabilities with five routine sections and the legacy overview hidden', () => {
    expect(FINANCE_SECTIONS.map((section) => [section.id, section.label, section.showInPrimaryNavigation])).toEqual([
      ['collections', 'التحصيل', true],
      ['fees', 'دخل المكتب', true],
      ['expenses', 'المصروفات', true],
      ['funds', 'أموال الملاك', true],
      ['banking', 'البنوك', true],
      ['overview', 'وضع المال', false],
    ]);
    const sectionIds = new Set(FINANCE_SECTIONS.map((section) => section.id));
    for (const view of FINANCE_VIEWS) expect(sectionIds.has(view.sectionId)).toBe(true);
  });

  it('keeps commissions a first-class Money view under fees (office income) without making it a routine drawer destination', () => {
    expect(FINANCE_VIEWS.find((view) => view.id === 'commissions')).toMatchObject({
      sectionId: 'fees', permission: 'commissions.view', label: 'العمولات',
    });
    expect(resolveFinanceLocation('commissions', '', admin)).toMatchObject({
      resolvedSectionId: 'fees', resolvedViewId: 'commissions', isLegacyCommissionsLink: false,
    });
  });

  it('preserves specialist and legacy finance deep links inside the canonical Money route', () => {
    expect(resolveFinanceLocation('invoices', '', admin)).toMatchObject({ resolvedSectionId: 'collections', resolvedViewId: 'invoices' });
    expect(resolveFinanceLocation('receipts', '', admin)).toMatchObject({ resolvedSectionId: 'collections', resolvedViewId: 'receipts' });
    expect(resolveFinanceLocation('arrears', '', admin)).toMatchObject({ resolvedSectionId: 'collections', resolvedViewId: 'arrears' });
    expect(resolveFinanceLocation('deposits', '', admin)).toMatchObject({ resolvedSectionId: 'funds', resolvedViewId: 'deposits' });
    expect(resolveFinanceLocation('owner_settlements', '', admin)).toMatchObject({ resolvedSectionId: 'funds', resolvedViewId: 'owner_settlements' });
    expect(resolveFinanceLocation('bank_reconciliation', '', admin)).toMatchObject({ resolvedSectionId: 'banking', resolvedViewId: 'bank_reconciliation' });
    expect(resolveFinanceLocation('funds', 'fixed_monthly_accruals', admin)).toMatchObject({ resolvedSectionId: 'fees', resolvedViewId: 'fixed_monthly_accruals' });
  });

  it('normalizes incoherent section/view pairs safely', () => {
    expect(resolveFinanceLocation('banking', 'invoices', admin)).toMatchObject({
      resolvedSectionId: 'banking', resolvedViewId: 'bank_reconciliation',
    });
  });

  it('does not widen protected Money views and keeps routine navigation focused', () => {
    const userViews = getPermittedViews(user).map((view) => view.id);
    expect(userViews).toEqual(expect.arrayContaining(['invoices', 'receipts']));
    expect(userViews).not.toContain('commissions');
    expect(userViews).not.toContain('arrears');
    // A plain USER only holds the collections basics; the hidden legacy
    // overview section never surfaces in primary navigation for anyone.
    expect(getPermittedSections(user).map((section) => section.id)).toEqual(['collections']);
    expect(getPermittedSections(admin).map((section) => section.id)).toEqual([
      'collections', 'fees', 'expenses', 'funds', 'banking',
    ]);
    expect(getPermittedViews(admin).map((view) => view.id)).toEqual(expect.arrayContaining([
      'commissions', 'deposits', 'owner_settlements', 'fixed_monthly_accruals', 'bank_reconciliation',
    ]));
  });

  it('keeps FinancePage as the sole renderer over this model', () => {
    const financePage = readFileSync(new URL('../FinancePage.tsx', import.meta.url), 'utf8');
    expect(financePage).toContain("from './shell/financeShellModel'");
    expect(financePage).not.toContain('export const FINANCE_SECTIONS');
    expect(financePage).toContain('<CommissionsWorkspace embedded />');
    expect(financePage).toContain("import('@/features/financials/invoices/invoices-page')");
    expect(financePage).toContain("import('@/features/financials/receipts/receipts-page')");
  });
});
