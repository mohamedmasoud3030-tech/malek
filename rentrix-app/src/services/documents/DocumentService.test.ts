import { describe, expect, it } from 'vitest';
import { getDocumentCapability, listDocumentCapabilities } from './DocumentService';

describe('document service boundary', () => {
  it('exposes local template capabilities without a provider dependency', () => {
    const capabilities = listDocumentCapabilities();
    expect(capabilities).toEqual(
      expect.arrayContaining([
        { type: 'contract', templateAvailable: true, externalProviderRequired: false },
        { type: 'invoice', templateAvailable: true, externalProviderRequired: false },
        { type: 'receipt', templateAvailable: true, externalProviderRequired: false },
        { type: 'expense_voucher', templateAvailable: true, externalProviderRequired: false },
        { type: 'payment', templateAvailable: true, externalProviderRequired: false },
        { type: 'owner_statement', templateAvailable: true, externalProviderRequired: false },
        { type: 'tenant_statement', templateAvailable: true, externalProviderRequired: false },
        { type: 'trial_balance', templateAvailable: true, externalProviderRequired: false },
        { type: 'income_statement', templateAvailable: true, externalProviderRequired: false },
        { type: 'balance_sheet', templateAvailable: true, externalProviderRequired: false },
      ]),
    );

    expect(getDocumentCapability('trial_balance')).toEqual({
      type: 'trial_balance',
      templateAvailable: true,
      externalProviderRequired: false,
    });
  });
});
