import { describe, expect, it } from 'vitest';
import { buildCompanySettingsSearch, resolveGovernanceHubNavigation } from './governance-hub-navigation';

const visible = [
  { id: 'company' },
  { id: 'users-permissions' },
  { id: 'cost-centers' },
  { id: 'security' },
] as const;

describe('resolveGovernanceHubNavigation', () => {
  it('keeps canonical governance sections at the hub level', () => {
    const result = resolveGovernanceHubNavigation({
      requestedSection: 'users-permissions',
      requestedCompanySection: 'documents',
      visibleSections: visible,
    });

    expect(result.hubSection).toBe('users-permissions');
    expect(result.companySection).toBe('documents');
    expect(result.legacyCompanySection).toBeNull();
  });

  it('resolves canonical nested company settings', () => {
    const result = resolveGovernanceHubNavigation({
      requestedSection: 'company',
      requestedCompanySection: 'finance-readiness',
      visibleSections: visible,
    });

    expect(result.hubSection).toBe('company');
    expect(result.companySection).toBe('finance-readiness');
    expect(result.legacyCompanySection).toBeNull();
  });

  it('normalizes non-colliding legacy company-section links into company', () => {
    const result = resolveGovernanceHubNavigation({
      requestedSection: 'documents',
      requestedCompanySection: undefined,
      visibleSections: visible,
    });

    expect(result.hubSection).toBe('company');
    expect(result.companySection).toBe('documents');
    expect(result.legacyCompanySection).toBe('documents');
  });

  it('preserves colliding governance ids instead of stealing them as company aliases', () => {
    const result = resolveGovernanceHubNavigation({
      requestedSection: 'cost-centers',
      requestedCompanySection: 'office',
      visibleSections: visible,
    });

    expect(result.hubSection).toBe('cost-centers');
    expect(result.legacyCompanySection).toBeNull();
  });

  it('fails safely to the first visible hub section and office company section', () => {
    const result = resolveGovernanceHubNavigation({
      requestedSection: 'not-real',
      requestedCompanySection: 'not-real-either',
      visibleSections: visible,
    });

    expect(result.hubSection).toBe('company');
    expect(result.companySection).toBe('office');
  });

  it('does not expose a legacy company alias when company settings are not visible', () => {
    const result = resolveGovernanceHubNavigation({
      requestedSection: 'documents',
      requestedCompanySection: undefined,
      visibleSections: [{ id: 'security' }],
    });

    expect(result.hubSection).toBe('security');
    expect(result.legacyCompanySection).toBeNull();
    expect(result.canOpenCompany).toBe(false);
  });
});

describe('buildCompanySettingsSearch', () => {
  it('preserves unrelated search state while canonicalizing the company section', () => {
    expect(buildCompanySettingsSearch({ sub: 'keep-me', section: 'old' }, 'documents')).toEqual({
      sub: 'keep-me',
      section: 'company',
      companySection: 'documents',
    });
  });
});
