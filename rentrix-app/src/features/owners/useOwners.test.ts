import { describe, expect, it } from 'vitest';
import { ownerKeys } from './useOwners';

describe('owner read query keys', () => {
  it('keeps stable keys for detail reads', () => {
    expect(ownerKeys.detailSnapshot('owner-1')).toEqual(['owners', 'detail-snapshot', 'owner-1']);
    expect(ownerKeys.propertiesWithOwners()).toEqual(['owners', 'properties-with-owners']);
  });
});
