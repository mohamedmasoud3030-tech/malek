/**
 * R9 — Finance Shell / IA: one route model, stable deep links, clear permissions.
 *
 * The route model (sections/views/permissions/URL resolution) lives in
 * finance-shell-model.ts; financials-page.tsx only renders. This suite locks:
 *   - the FinanceShell IA (Overview/Collections/Expenses/Owner Funds/Banking),
 *   - deep-link stability for every legacy spelling,
 *   - the structural coherence rule (mismatched view normalizes safely),
 *   - permission-driven visibility per role,
 *   - zero duplicated navigation model (page re-exports the single model).
 */
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
const viewer: AuthorizationContext = { userId: 'u-viewer', email: null, role: 'VIEWER' };
const user: AuthorizationContext = { userId: 'u-user', email: null, role: 'USER' };

describe('R9 — FinanceShell IA', () => {
  it('locks the section model: Overview / Collections / Expenses / Owner Funds / Banking', () => {
    expect(FINANCE_SECTIONS.map((s) => s.id)).toEqual(['overview', 'collections', 'expenses', 'funds', 'banking']);
    // Every view belongs to a declared section.
    const sectionIds = new Set(FINANCE_SECTIONS.map((s) => s.id));
    for (const view of FINANCE_VIEWS) {
      expect(sectionIds.has(view.sectionId)).toBe(true);
    }
  });

  it('deep links stay stable across every legacy spelling', () => {
    // Legacy direct-view spellings land on the right section/view.
    expect(resolveFinanceLocation('invoices', '', admin)).toMatchObject({ resolvedSectionId: 'collections', resolvedViewId: 'invoices' });
    expect(resolveFinanceLocation('receipts', '', admin)).toMatchObject({ resolvedSectionId: 'collections', resolvedViewId: 'receipts' });
    expect(resolveFinanceLocation('arrears', '', admin)).toMatchObject({ resolvedSectionId: 'collections', resolvedViewId: 'arrears' });
    expect(resolveFinanceLocation('deposits', '', admin)).toMatchObject({ resolvedSectionId: 'funds', resolvedViewId: 'deposits' });
    expect(resolveFinanceLocation('owner_settlements', '', admin)).toMatchObject({ resolvedSectionId: 'funds', resolvedViewId: 'owner_settlements' });
    expect(resolveFinanceLocation('bank_reconciliation', '', admin)).toMatchObject({ resolvedSectionId: 'banking', resolvedViewId: 'bank_reconciliation' });
    expect(resolveFinanceLocation('banking', '', admin)).toMatchObject({ resolvedSectionId: 'banking', resolvedViewId: 'bank_reconciliation' });
    // Section+view pairs pass through.
    expect(resolveFinanceLocation('funds', 'fixed_monthly_accruals', admin)).toMatchObject({ resolvedSectionId: 'funds', resolvedViewId: 'fixed_monthly_accruals' });
    // Empty URL → overview.
    expect(resolveFinanceLocation('', '', admin)).toMatchObject({ resolvedSectionId: 'overview', resolvedViewId: 'overview' });
  });

  it('flags retired commissions deep links for redirect without crashing', () => {
    const bySection = resolveFinanceLocation('commissions', '', admin);
    expect(bySection.isLegacyCommissionsLink).toBe(true);
    expect(bySection.resolvedSectionId).toBe('expenses'); // safe in-flight fallback
    const byView = resolveFinanceLocation('expenses', 'commissions', admin);
    expect(byView.isLegacyCommissionsLink).toBe(true);
  });

  it('normalizes a structurally incoherent section/view pair safely', () => {
    // ?section=banking&view=invoices — invoices does not belong to banking.
    const resolved = resolveFinanceLocation('banking', 'invoices', admin);
    expect(resolved.resolvedSectionId).toBe('banking');
    expect(resolved.resolvedViewId).toBe('bank_reconciliation');
  });

  it('permission model: VIEWER sees read sections, USER sees almost nothing', () => {
    const viewerViews = getPermittedViews(viewer).map((v) => v.id);
    expect(viewerViews).toContain('arrears');
    expect(viewerViews).toContain('deposits');
    expect(viewerViews).toContain('owner_settlements');
    expect(viewerViews).toContain('bank_reconciliation');
    expect(viewerViews).not.toContain('fixed_monthly_accruals');

    const userSections = getPermittedSections(user).map((s) => s.id);
    // USER has no financial view permissions beyond the permissionless views.
    expect(userSections).toEqual(['overview', 'collections']);

    const adminSections = getPermittedSections(admin).map((s) => s.id);
    expect(adminSections).toEqual(['overview', 'collections', 'expenses', 'funds', 'banking']);
  });

  it('zero duplicated navigation: the page re-exports the single model', () => {
    const pageSource = readFileSync(resolve(import.meta.dirname, 'financials-page.tsx'), 'utf8');
    // The page must NOT define its own model anymore.
    expect(pageSource).not.toContain('export const FINANCE_SECTIONS: readonly FinanceSectionDefinition[]');
    expect(pageSource).not.toContain('export const FINANCE_VIEWS: readonly FinanceViewDefinition[]');
    // It re-exports from the model (compatibility) and resolves via the pure fn.
    expect(pageSource).toContain("from './finance-shell-model'");
    expect(pageSource).toContain('resolveFinanceLocation(rawSection, rawView, authorization)');
  });
});
