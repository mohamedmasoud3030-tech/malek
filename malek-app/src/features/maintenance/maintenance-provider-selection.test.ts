import { describe, expect, it } from 'vitest';
import { getCompatibleServiceProviderOptions } from './useMaintenancePageController';

const providers = [
  { id: 'provider-hvac', name: 'HVAC', phone: null, categoryIds: ['category-hvac'] },
  { id: 'provider-plumbing', name: 'Plumbing', phone: null, categoryIds: ['category-plumbing'] },
  { id: 'provider-multi', name: 'Multi', phone: null, categoryIds: ['category-hvac', 'category-plumbing'] },
];

describe('Maintenance Service Provider selection', () => {
  it('shows all active provider options before a service type is selected', () => {
    expect(getCompatibleServiceProviderOptions(providers, null).map((provider) => provider.id)).toEqual([
      'provider-hvac', 'provider-plumbing', 'provider-multi',
    ]);
  });

  it('only offers providers that support the selected maintainable category', () => {
    expect(getCompatibleServiceProviderOptions(providers, 'category-hvac').map((provider) => provider.id)).toEqual([
      'provider-hvac', 'provider-multi',
    ]);
    expect(getCompatibleServiceProviderOptions(providers, 'category-plumbing').map((provider) => provider.id)).toEqual([
      'provider-plumbing', 'provider-multi',
    ]);
  });

  it('returns an honest empty option set when no active provider supports the category', () => {
    expect(getCompatibleServiceProviderOptions(providers, 'category-electrical')).toEqual([]);
  });
});
