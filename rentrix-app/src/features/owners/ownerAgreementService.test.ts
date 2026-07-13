import { describe, expect, it } from 'vitest';
import { getAgreementActiveOn, type OwnerAgreement } from './ownerAgreementService';

function agreement(id: string, starts_on: string, ends_on: string | null): OwnerAgreement {
  return {
    id,
    owner_id: 'owner-1',
    property_id: 'property-1',
    agreement_type: 'property_management',
    commission_type: 'RATE',
    commission_value: 10,
    starts_on,
    ends_on,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('getAgreementActiveOn', () => {
  it('does not present a future agreement as the current office agreement', () => {
    const current = agreement('current', '2026-01-01', '2026-12-31');
    const scheduled = agreement('scheduled', '2027-01-01', null);

    expect(getAgreementActiveOn([scheduled, current], '2026-07-13')?.id).toBe('current');
  });

  it('keeps an agreement active through its inclusive end date', () => {
    const current = agreement('current', '2026-01-01', '2026-07-13');

    expect(getAgreementActiveOn([current], '2026-07-13')?.id).toBe('current');
    expect(getAgreementActiveOn([current], '2026-07-14')).toBeNull();
  });
});
