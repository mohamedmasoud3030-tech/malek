import { describe, expect, it } from 'vitest';
import { isPathAvailableInEdition } from './product-edition';

describe('product edition route surface', () => {
  it('keeps the existing standard edition unchanged', () => {
    for (const pathname of ['/lands', '/leads', '/communication', '/ai-assistant', '/owner-portal', '/tenant-portal', '/settings/automation']) {
      expect(isPathAvailableInEdition(pathname, 'standard')).toBe(true);
    }
  });

  it('keeps the coherent property-operation spine and its financial routes', () => {
    for (const pathname of ['/dashboard', '/properties', '/owners', '/people', '/tenants', '/contracts', '/financials', '/commissions', '/reports', '/maintenance', '/service-providers', '/utilities', '/documents-vault', '/settings/company', '/settings/security']) {
      expect(isPathAvailableInEdition(pathname, 'property-operations')).toBe(true);
    }
  });

  it('excludes only deliberate add-on surfaces in the curated edition', () => {
    for (const pathname of ['/lands', '/lands/123', '/leads', '/communication', '/ai-assistant', '/owner-portal', '/tenant-portal', '/settings/automation']) {
      expect(isPathAvailableInEdition(pathname, 'property-operations')).toBe(false);
    }
    expect(isPathAvailableInEdition('/landscape', 'property-operations')).toBe(true);
  });
});
