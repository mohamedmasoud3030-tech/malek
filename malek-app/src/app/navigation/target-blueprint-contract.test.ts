import { describe, expect, it } from 'vitest';
import { navGroups } from './app-nav-items';

const DAILY_TOP_LEVEL_ROUTES = [
  '/dashboard',
  '/properties',
  '/contracts',
  '/financials',
  '/maintenance',
  '/reports',
  '/settings',
] as const;

const ADVANCED_DEEP_LINKS = [
  '/automation',
  '/data-integrity',
  '/audit-log',
  '/system',
  '/leads',
  '/communication',
  '/documents-vault',
  '/deposits',
  '/invoices',
  '/expenses',
  '/arrears',
  '/owner-settlements',
  '/bank-reconciliation',
  '/units',
  '/utilities',
  '/accounting',
  '/change-password',
  '/landing',
] as const;

describe('MALEK Target Blueprint — daily product IA contract', () => {
  it('keeps exactly the seven daily product spaces', () => {
    const routes = navGroups.flatMap(([, items]) => items.map(([to]) => to));
    expect(routes).toEqual(DAILY_TOP_LEVEL_ROUTES);
  });

  it('keeps advanced and legacy capabilities out of daily navigation', () => {
    const routes = new Set(navGroups.flatMap(([, items]) => items.map(([to]) => to)));
    for (const route of ADVANCED_DEEP_LINKS) expect(routes.has(route)).toBe(false);
  });
});
