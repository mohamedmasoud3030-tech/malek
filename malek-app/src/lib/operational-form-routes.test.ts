import { describe, expect, it } from 'vitest';
import { isOperationalFormRoute } from './operational-form-routes';

describe('protected operational form scope', () => {
  it.each([
    '/dashboard',
    '/properties',
    '/properties/property-1',
    '/people',
    '/tenants/tenant-1',
    '/owners',
    '/contracts/contract-1',
    '/maintenance',
    '/settings',
    '/ai-assistant',
    '/help',
    '/admin-support',
    '/communication',
  ])('enables the operational form contract for %s', (pathname) => {
    expect(isOperationalFormRoute(pathname)).toBe(true);
  });

  it.each([
    '/financials',
    '/receipts',
    '/reports',
    '/commissions',
    '/landing',
    '/units',
    '/portfolio',
    '/relationships',
    '/utilities',
    '/documents-vault',
    '/invoices',
    '/expenses',
    '/arrears',
  ])('keeps Finance, Reporting and legacy aliases outside the operational form scope for %s', (pathname) => {
    expect(isOperationalFormRoute(pathname)).toBe(false);
  });
});
