import { describe, expect, it } from 'vitest';
import { isOperationalFormRoute } from './operational-form-routes';

describe('protected operational form scope', () => {
  it.each([
    '/properties',
    '/properties/property-1',
    '/units',
    '/people',
    '/tenants/tenant-1',
    '/owners',
    '/contracts/contract-1',
    '/maintenance',
    '/settings',
    '/portfolio',
    '/relationships',
  ])('enables the operational form contract for %s', (pathname) => {
    expect(isOperationalFormRoute(pathname)).toBe(true);
  });

  it.each([
    '/financials',
    '/finance/collections',
    '/finance/expenses',
    '/finance/deposits',
    '/finance/banking',
    '/reports',
    '/commissions',
    '/owner-settlements',
    '/dashboard',
  ])('keeps Finance and Reporting outside the operational form scope for %s', (pathname) => {
    expect(isOperationalFormRoute(pathname)).toBe(false);
  });
});
