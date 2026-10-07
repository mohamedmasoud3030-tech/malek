import { describe, expect, it } from 'vitest';
import { resolveTenantPortalAuthorization } from './tenant-portal-authority';

const TOKEN = 'c3000000-0000-4000-8000-000000000002';

describe('resolveTenantPortalAuthorization', () => {
  it('requires the secure tenant link token', () => {
    expect(resolveTenantPortalAuthorization(undefined)).toEqual({
      authorized: false,
      reason: 'TENANT_LINK_MISSING',
    });
    expect(resolveTenantPortalAuthorization('')).toEqual({
      authorized: false,
      reason: 'TENANT_LINK_MISSING',
    });
  });

  it('rejects malformed identifiers and office data as tenant credentials', () => {
    for (const token of [
      'tenant-1',
      'ADMIN',
      'company-id:tenant-id',
      'c3000000-0000-0000-0000-000000000002',
    ]) {
      expect(resolveTenantPortalAuthorization(token)).toEqual({
        authorized: false,
        reason: 'TENANT_LINK_INVALID',
      });
    }
  });

  it('accepts only a well-formed high-entropy UUID bearer token', () => {
    expect(resolveTenantPortalAuthorization(TOKEN)).toEqual({
      authorized: true,
      token: TOKEN,
    });
  });

  it('normalizes token casing and whitespace without accepting tenant/company scopes', () => {
    const upper = TOKEN.toUpperCase();
    expect(resolveTenantPortalAuthorization(`  ${upper}  `)).toEqual({
      authorized: true,
      token: TOKEN,
    });
  });
});
