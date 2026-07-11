import { describe, expect, it } from 'vitest';
import { getDocumentCapability, listDocumentCapabilities } from './DocumentService';

describe('document service boundary', () => {
  it('exposes local template capabilities without a provider dependency', () => {
    const capabilities = listDocumentCapabilities();
    expect(capabilities.find((item) => item.type === 'contract')).toMatchObject({
      templateAvailable: true,
      externalProviderRequired: false,
    });
    expect(capabilities.find((item) => item.type === 'trial_balance')).toMatchObject({
      templateAvailable: false,
      externalProviderRequired: true,
    });
  });

  it('returns undefined for unregistered document types', () => {
    expect(getDocumentCapability('unknown')).toBeUndefined();
  });
});
