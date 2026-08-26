import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AuthorizationContext } from '@/features/auth/permissions';
import {
  FINANCE_SECTIONS,
  FINANCE_VIEWS,
  getPermittedSections,
  getPermittedViews,
  resolveFinanceLocation,
} from './finance-shell-model';

const admin: AuthorizationContext = { userId: 'u-admin', email: null, role: 'ADMIN' };
const user: AuthorizationContext = { userId: 'u-user', email: null, role: 'USER' };

describe('Money workspace route model', () => {
  it('locks the six decision-oriented Money sections (fees separated from funds)', () => {
    expect(FINANCE_SECTIONS.map((section) => [section.id, section.label])).toEqual([
      ['overview', 'وضع المال'],
      ['collections', 'المستحقات والتحصيل'],
      ['expenses', 'المصروفات والعمولات'],
      ['fees', 'الأتعاب والاستحقاقات'],
      ['funds', 'التأمينات والملاك'],
      ['banking', 'البنوك والمطابقة'],
    ]);
    const sectionIds = new Set(FINANCE_SECTIONS.map((section) => section.id));
    for (const view of FINANCE_VIEWS) expect(sectionIds.has(view.sectionId)).toBe(true);
  });

  it('makes commissions a first-class Money view under expenses', () => {
    const commissions = FINANCE_VIEWS.find((view) => view.id === 'commissions');
    expect(commissions).toMatchObject({ sectionId: 'expenses', permission: 'commissions.view', label: 'العمولات' });
    expect(resolveFinanceLocation('commissions', '', admin)).toMatchObject({ resolvedSectionId: 'expenses', resolvedViewId: 'commissions', isLegacyCommissionsLink: false });
    expect(resolveFinanceLocation('expenses', 'commissions', admin)).toMatchObject({ resolvedSectionId: 'expenses', resolvedViewId: 'commissions', isLegacyCommissionsLink: false });
  });

  it('keeps all legacy finance spellings stable inside Money', () => {
    expect(resolveFinanceLocation('invoices', '', admin)).toMatchObject({ resolvedSectionId: 'collections', resolvedViewId: 'invoices' });
    expect(resolveFinanceLocation('receipts', '', admin)).toMatchObject({ resolvedSectionId: 'collections', resolvedViewId: 'receipts' });
    expect(resolveFinanceLocation('arrears', '', admin)).toMatchObject({ resolvedSectionId: 'collections', resolvedViewId: 'arrears' });
    expect(resolveFinanceLocation('deposits', '', admin)).toMatchObject({ resolvedSectionId: 'funds', resolvedViewId: 'deposits' });
    expect(resolveFinanceLocation('owner_settlements', '', admin)).toMatchObject({ resolvedSectionId: 'funds', resolvedViewId: 'owner_settlements' });
    expect(resolveFinanceLocation('bank_reconciliation', '', admin)).toMatchObject({ resolvedSectionId: 'banking', resolvedViewId: 'bank_reconciliation' });
    expect(resolveFinanceLocation('fixed_monthly_accruals', '', admin)).toMatchObject({ resolvedSectionId: 'fees', resolvedViewId: 'fixed_monthly_accruals' });
    // Legacy ?section=funds&view=fixed_monthly_accruals should resolve to fees
    expect(resolveFinanceLocation('funds', 'fixed_monthly_accruals', admin)).toMatchObject({ resolvedSectionId: 'fees', resolvedViewId: 'fixed_monthly_accruals' });
    expect(resolveFinanceLocation('', '', admin)).toMatchObject({ resolvedSectionId: 'overview', resolvedViewId: 'overview' });
  });

  it('normalizes structurally incoherent section/view pairs safely', () => {
    expect(resolveFinanceLocation('banking', 'invoices', admin)).toMatchObject({ resolvedSectionId: 'banking', resolvedViewId: 'bank_reconciliation' });
  });

  it('keeps permissionless read views available without widening protected Money views', () => {
    const userViews = getPermittedViews(user).map((view) => view.id);
    expect(userViews).toEqual(expect.arrayContaining(['overview', 'invoices', 'receipts']));
    expect(userViews).not.toContain('commissions');
    expect(userViews).not.toContain('arrears');
    expect(getPermittedSections(user).map((section) => section.id)).toEqual(['overview', 'collections']);
    expect(getPermittedSections(admin).map((section) => section.id)).toEqual(['overview', 'collections', 'expenses', 'fees', 'funds', 'banking']);
  });

  it('keeps the legacy financials renderer and canonical FinancePage on shared shell vocabulary', () => {
    const financialsSource = readFileSync(resolve(import.meta.dirname, 'financials-page.tsx'), 'utf8');
    const financePageSource = readFileSync(resolve(import.meta.dirname, '../finance/FinancePage.tsx'), 'utf8');
    expect(financialsSource).toContain("from './finance-shell-model'");
    expect(financePageSource).toContain("from './shell/financeShellModel'");
    expect(financialsSource).not.toContain('export const FINANCE_SECTIONS: readonly FinanceSectionDefinition[]');
    expect(financePageSource).not.toContain('export const FINANCE_SECTIONS');
    expect(financePageSource).toContain('<CommissionsWorkspace embedded />');
  });
});
