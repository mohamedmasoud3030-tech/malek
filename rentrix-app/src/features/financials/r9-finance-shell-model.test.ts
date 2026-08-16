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
  it('locks the five decision-oriented Money sections', () => {
    expect(FINANCE_SECTIONS.map((section) => [section.id, section.label])).toEqual([
      ['overview', 'وضع المال'],
      ['collections', 'المستحقات والتحصيل'],
      ['expenses', 'المصروفات والعمولات'],
      ['funds', 'التأمينات والملاك'],
      ['banking', 'البنوك والمطابقة'],
    ]);
    const sectionIds = new Set(FINANCE_SECTIONS.map((section) => section.id));
    for (const view of FINANCE_VIEWS) expect(sectionIds.has(view.sectionId)).toBe(true);
  });

  it('makes commissions a first-class Money view under expenses', () => {
    const commissions = FINANCE_VIEWS.find((view) => view.id === 'commissions');
    expect(commissions).toMatchObject({ sectionId: 'expenses', permission: 'commissions.view', label: 'العمولات' });
    expect(resolveFinanceLocation('commissions', '', admin)).toMatchObject({
      resolvedSectionId: 'expenses',
      resolvedViewId: 'commissions',
      isLegacyCommissionsLink: false,
    });
    expect(resolveFinanceLocation('expenses', 'commissions', admin)).toMatchObject({
      resolvedSectionId: 'expenses',
      resolvedViewId: 'commissions',
      isLegacyCommissionsLink: false,
    });
  });

  it('keeps all legacy finance spellings stable inside Money', () => {
    expect(resolveFinanceLocation('invoices', '', admin)).toMatchObject({ resolvedSectionId: 'collections', resolvedViewId: 'invoices' });
    expect(resolveFinanceLocation('receipts', '', admin)).toMatchObject({ resolvedSectionId: 'collections', resolvedViewId: 'receipts' });
    expect(resolveFinanceLocation('arrears', '', admin)).toMatchObject({ resolvedSectionId: 'collections', resolvedViewId: 'arrears' });
    expect(resolveFinanceLocation('deposits', '', admin)).toMatchObject({ resolvedSectionId: 'funds', resolvedViewId: 'deposits' });
    expect(resolveFinanceLocation('owner_settlements', '', admin)).toMatchObject({ resolvedSectionId: 'funds', resolvedViewId: 'owner_settlements' });
    expect(resolveFinanceLocation('bank_reconciliation', '', admin)).toMatchObject({ resolvedSectionId: 'banking', resolvedViewId: 'bank_reconciliation' });
    expect(resolveFinanceLocation('', '', admin)).toMatchObject({ resolvedSectionId: 'overview', resolvedViewId: 'overview' });
  });

  it('normalizes structurally incoherent section/view pairs safely', () => {
    expect(resolveFinanceLocation('banking', 'invoices', admin)).toMatchObject({
      resolvedSectionId: 'banking',
      resolvedViewId: 'bank_reconciliation',
    });
  });

  it('keeps permissionless read views available without widening protected Money views', () => {
    const userViews = getPermittedViews(user).map((view) => view.id);
    expect(userViews).toEqual(expect.arrayContaining(['overview', 'invoices', 'receipts']));
    expect(userViews).not.toContain('commissions');
    expect(userViews).not.toContain('arrears');
    expect(getPermittedSections(user).map((section) => section.id)).toEqual(['overview', 'collections']);
    expect(getPermittedSections(admin).map((section) => section.id)).toEqual(['overview', 'collections', 'expenses', 'funds', 'banking']);
  });

  it('keeps one navigation model shared by both the legacy renderer and Money route wrapper', () => {
    const financialsSource = readFileSync(resolve(import.meta.dirname, 'financials-page.tsx'), 'utf8');
    const moneySource = readFileSync(resolve(import.meta.dirname, 'money-page.tsx'), 'utf8');
    expect(financialsSource).toContain("from './finance-shell-model'");
    expect(moneySource).toContain("from './finance-shell-model'");
    expect(financialsSource).not.toContain('export const FINANCE_SECTIONS: readonly FinanceSectionDefinition[]');
    expect(moneySource).not.toContain('export const FINANCE_SECTIONS');
  });
});
