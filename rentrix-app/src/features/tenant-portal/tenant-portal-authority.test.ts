import { describe, expect, it } from 'vitest';
import {
  TENANT_PORTAL_CLAIM_SOURCE,
  evaluateTenantPortalClaim,
  resolveTenantPortalAuthorization,
} from './tenant-portal-authority';

const COMPANY = 'c3000000-0000-4000-8000-000000000001';
const TENANT = 'c3000000-0000-4000-8000-000000000002';
const officeRole = 'ADMIN';

describe('evaluateTenantPortalClaim', () => {
  it('accepts exactly the portal claim shape with two UUID scopes', () => {
    expect(
      evaluateTenantPortalClaim({ source: TENANT_PORTAL_CLAIM_SOURCE, companyId: COMPANY, tenantId: TENANT }),
    ).toEqual({ authorized: true, companyId: COMPANY, tenantId: TENANT });
  });

  it('rejects machine-readable claims missing the portal source marker', () => {
    for (const claim of [
      { source: 'office_session', companyId: COMPANY, tenantId: TENANT },
      { source: 'company_members', companyId: COMPANY, tenantId: TENANT },
      { source: undefined, companyId: COMPANY, tenantId: TENANT },
    ]) {
      expect(evaluateTenantPortalClaim(claim)).toEqual({
        authorized: false,
        reason: 'TENANT_CLAIM_INVALID',
      });
    }
  });

  it('rejects malformed or non-UUID scopes fail closed', () => {
    for (const claim of [
      { source: TENANT_PORTAL_CLAIM_SOURCE, companyId: 'abc', tenantId: TENANT },
      { source: TENANT_PORTAL_CLAIM_SOURCE, companyId: COMPANY, tenantId: 'tenant-1' },
      { source: TENANT_PORTAL_CLAIM_SOURCE, companyId: COMPANY },
      null,
      'not-an-object',
    ]) {
      expect(evaluateTenantPortalClaim(claim)).toEqual({
        authorized: false,
        reason: 'TENANT_CLAIM_INVALID',
      });
    }
  });

  it('never grants access from an office role or bare record id', () => {
    // An office role is not a tenant claim; the portal must not accept it.
    expect(
      evaluateTenantPortalClaim({ source: TENANT_PORTAL_CLAIM_SOURCE, role: officeRole, tenantId: TENANT }),
    ).toEqual({ authorized: false, reason: 'TENANT_CLAIM_INVALID' });
  });
});

describe('resolveTenantPortalAuthorization', () => {
  it('requires a session before any claim evaluation', () => {
    expect(resolveTenantPortalAuthorization(false, { source: TENANT_PORTAL_CLAIM_SOURCE, companyId: COMPANY, tenantId: TENANT }))
      .toEqual({ authorized: false, reason: 'NO_SESSION' });
  });

  it('returns the deferred denial while the upstream tenant read model is unavailable', () => {
    expect(resolveTenantPortalAuthorization(true)).toEqual({
      authorized: false,
      reason: 'TENANT_AUTHORIZATION_UNAVAILABLE',
    });
  });

  it('accepts a valid claim only when a session exists', () => {
    expect(resolveTenantPortalAuthorization(true, { source: TENANT_PORTAL_CLAIM_SOURCE, companyId: COMPANY, tenantId: TENANT }))
      .toEqual({ authorized: true, companyId: COMPANY, tenantId: TENANT });
  });
});
