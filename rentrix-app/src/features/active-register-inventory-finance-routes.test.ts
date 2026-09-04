import { describe, expect, it } from 'vitest';
import { ACTIVE_REGISTER_INVENTORY } from './active-register-inventory';
import { FINANCE_VIEWS, resolveFinanceLocation } from './finance/shell/financeShellModel';
import type { AuthorizationContext } from './auth/permissions';

/**
 * Contract guard (Architecture Census P1-A):
 *
 * The active-register inventory ships canonical deep-link routes for each
 * register component. For Money (`/financials?section=…&view=…`) entries the
 * section/view pair in that metadata MUST agree with the canonical
 * `financeShellModel`. The resolver (`resolveFinanceLocation`) still normalises
 * legacy deep links at runtime, but the inventory metadata must not drift from
 * the shell model — a stale `section=` here previously masked that fixed-monthly
 * accruals canonically live under the `fees` section, not `funds`.
 */

const admin: AuthorizationContext = { userId: 'u-admin', email: null, role: 'ADMIN' };

function parseFinancialsRoute(route: string): { section: string; view: string } | null {
  const match = route.match(/^\/financials\?section=([^&]+)(?:&view=([^&]+))?/);
  if (!match) return null;
  return { section: match[1], view: match[2] ?? '' };
}

describe('active-register inventory — Money route metadata parity with financeShellModel', () => {
  it('pins fixed-monthly accruals to the canonical fees section (not the stale funds section)', () => {
    const accrualEntry = ACTIVE_REGISTER_INVENTORY.find((entry) =>
      entry.component.includes('fixed-monthly-accruals/fixed-monthly-accrual-workspace'),
    );
    expect(accrualEntry, 'fixed-monthly-accrual workspace must be present in the inventory').toBeDefined();

    const routes = accrualEntry!.routes.filter((route) => route.startsWith('/financials'));
    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      const parsed = parseFinancialsRoute(route);
      expect(parsed, `route ${route} must parse as a /financials section/view deep link`).not.toBeNull();
      // The canonical section for fixed-monthly accruals is `fees` in the shell model.
      expect(parsed!.section).toBe('fees');
      expect(parsed!.view).toBe('fixed_monthly_accruals');
    }

    // The shell model itself agrees: the view is owned by the fees section.
    expect(FINANCE_VIEWS.find((view) => view.id === 'fixed_monthly_accruals')?.sectionId).toBe('fees');
  });

  it('keeps every inventory /financials deep link coherent: resolving it lands on the section it declares', () => {
    for (const entry of ACTIVE_REGISTER_INVENTORY) {
      for (const route of entry.routes) {
        const parsed = parseFinancialsRoute(route);
        if (!parsed) continue;

        const resolved = resolveFinanceLocation(parsed.section, parsed.view, admin);

        // The declared section must equal the section the resolver canonicalises
        // to for an authorised admin. This is the metadata↔shell-model parity
        // guard: if the resolver re-homes a view (e.g. funds→fees), the inventory
        // route metadata must be updated in the same change.
        expect(
          resolved.resolvedSectionId,
          `${entry.component} declares section=${parsed.section} but financeShellModel resolves it to section=${resolved.resolvedSectionId}; update the inventory route to the canonical section`,
        ).toBe(parsed.section);

        // When a view is declared it must resolve to that same view.
        if (parsed.view) {
          expect(
            resolved.resolvedViewId,
            `${entry.component} declares view=${parsed.view} but resolver lands on view=${resolved.resolvedViewId}`,
          ).toBe(parsed.view);
        }
      }
    }
  });

  it('still normalises the legacy funds/fixed_monthly_accruals deep link to fees at runtime', () => {
    // Compatibility must be preserved: old bookmarks using the pre-canonical
    // funds section are silently re-homed to fees by the resolver.
    expect(resolveFinanceLocation('funds', 'fixed_monthly_accruals', admin)).toMatchObject({
      resolvedSectionId: 'fees',
      resolvedViewId: 'fixed_monthly_accruals',
    });
  });
});
