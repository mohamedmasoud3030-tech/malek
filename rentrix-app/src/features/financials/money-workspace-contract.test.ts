import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FINANCE_VIEWS, resolveFinanceLocation } from './finance-shell-model';
import type { AuthorizationContext } from '@/features/auth/permissions';

const admin: AuthorizationContext = { userId: 'admin', email: null, role: 'ADMIN' };
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Money workspace contract', () => {
  it('owns commissions inside /financials without changing the commission business workspace', () => {
    const money = read('./money-page.tsx');
    const commissions = read('../commissions/commissions-page.tsx');
    const route = read('../../routes/_protected.financials.tsx');

    expect(route).toContain('MoneyPage as FinancialsRouteComponent');
    expect(money).toContain('<CommissionsWorkspace embedded />');
    expect(money).toContain("to: '/financials'");
    expect(money).not.toContain("to: '/commissions'");
    expect(commissions).toContain('usePayCommissionAtomic');
    expect(commissions).toContain('useReverseCommissionAtomic');
  });

  it('keeps commissions permissioned and resolves legacy commission search state in-place', () => {
    const view = FINANCE_VIEWS.find((candidate) => candidate.id === 'commissions');
    expect(view).toMatchObject({ sectionId: 'expenses', permission: 'commissions.view' });
    expect(resolveFinanceLocation('commissions', '', admin)).toMatchObject({ resolvedSectionId: 'expenses', resolvedViewId: 'commissions' });
    expect(resolveFinanceLocation('expenses', 'commissions', admin)).toMatchObject({ resolvedSectionId: 'expenses', resolvedViewId: 'commissions' });
  });

  it('uses a real shared panel id for both Money tab layers', () => {
    const money = read('./money-page.tsx');
    expect(money).toContain("const COMMISSIONS_PANEL_ID = 'money-commissions-panel'");
    expect(money.match(/panelId=\{COMMISSIONS_PANEL_ID\}/g)).toHaveLength(2);
    expect(money).toContain('id={COMMISSIONS_PANEL_ID}');
  });
});
