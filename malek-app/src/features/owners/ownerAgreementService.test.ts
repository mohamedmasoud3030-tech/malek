import { describe, expect, it } from 'vitest';
import {
  assertAgreementOwnerHasOwnership,
  formatAgreementError,
  getAgreementActiveOn,
  getEligibleAgreementOwners,
  groupAgreementsByTemporalStatus,
  normalizePropertyOwnershipPayload,
  propertyOwnershipCoversAgreementRange,
  type OwnerAgreement,
} from './ownerAgreementService';
import type { PropertyOwnerWithOwner } from './services/owner-service';
import { ownerRowFixtureDefaults, propertyOwnerRowFixtureDefaults } from '@/test/ownerRowFixture';

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
    company_id: 'company-1',
    reference: `AGR-${id}`,
    current_version_id: null,
  };
}

function ownershipLink(
  ownerId: string,
  startsOn: string | null,
  endsOn: string | null,
  id = `link-${ownerId}`,
): PropertyOwnerWithOwner {
  return {
    ...propertyOwnerRowFixtureDefaults,
    id,
    property_id: 'property-1',
    owner_id: ownerId,
    ownership_percentage: 100,
    is_primary: true,
    starts_on: startsOn,
    ends_on: endsOn,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    owner: {
      ...ownerRowFixtureDefaults,
      id: ownerId,
      full_name: `مالك ${ownerId}`,
      display_name: null,
      phone: null,
      email: null,
      national_id: null,
      tax_number: null,
      address: null,
      notes: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
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

describe('groupAgreementsByTemporalStatus', () => {
  it('separates current scheduled and ended agreements without hiding future relationships', () => {
    const grouped = groupAgreementsByTemporalStatus([
      agreement('ended', '2025-01-01', '2025-12-31'),
      agreement('current', '2026-01-01', '2026-12-31'),
      agreement('scheduled', '2027-01-01', null),
    ], '2026-07-13');

    expect(grouped.current.map((item) => item.id)).toEqual(['current']);
    expect(grouped.scheduled.map((item) => item.id)).toEqual(['scheduled']);
    expect(grouped.ended.map((item) => item.id)).toEqual(['ended']);
  });
});

describe('owner agreement ownership windows', () => {
  it('matches the database rule for inclusive, finite, and open-ended ownership coverage', () => {
    const finite = ownershipLink('owner-1', '2026-01-01', '2026-12-31');
    const open = ownershipLink('owner-2', null, null);

    expect(propertyOwnershipCoversAgreementRange(finite, '2026-01-01', '2026-12-31')).toBe(true);
    expect(propertyOwnershipCoversAgreementRange(finite, '2025-12-31', '2026-12-31')).toBe(false);
    expect(propertyOwnershipCoversAgreementRange(finite, '2026-01-01', '2027-01-01')).toBe(false);
    expect(propertyOwnershipCoversAgreementRange(finite, '2026-01-01', null)).toBe(false);
    expect(propertyOwnershipCoversAgreementRange(open, '2026-01-01', null)).toBe(true);
  });

  it('offers only covering property owners and blocks a doomed RPC submission', () => {
    const finite = ownershipLink('owner-1', '2026-01-01', '2026-12-31');
    const open = ownershipLink('owner-2', null, null);
    const duplicateOpen = ownershipLink('owner-2', '2025-01-01', null, 'link-owner-2-secondary');
    const links = [finite, open, duplicateOpen];

    expect(getEligibleAgreementOwners(links, '2026-06-01', '2026-12-31').map((owner) => owner.id)).toEqual(['owner-1', 'owner-2']);
    expect(getEligibleAgreementOwners(links, '2026-06-01', null).map((owner) => owner.id)).toEqual(['owner-2']);

    expect(() => assertAgreementOwnerHasOwnership(links, {
      owner_id: 'owner-1',
      starts_on: '2026-06-01',
      ends_on: null,
    })).toThrow('لا يملك العقار طوال فترة الاتفاقية');

    expect(() => assertAgreementOwnerHasOwnership(links, {
      owner_id: 'owner-2',
      starts_on: '2026-06-01',
      ends_on: null,
    })).not.toThrow();
  });

  it('does not offer or accept an inactive owner for a new operating agreement', () => {
    const inactive = ownershipLink('owner-inactive', null, null);
    inactive.owner!.is_active = false;

    expect(getEligibleAgreementOwners([inactive], '2026-07-27', null)).toEqual([]);
    expect(() => assertAgreementOwnerHasOwnership([inactive], {
      owner_id: 'owner-inactive',
      starts_on: '2026-07-27',
      ends_on: null,
    })).toThrow('غير نشط');
  });
});

describe('formatAgreementError', () => {
  it('localizes overlap, ownership, and historical contract coverage violations', () => {
    expect(formatAgreementError('violates exclusion constraint owner_agreements_no_overlap')).toContain('نفس الفترة الزمنية');
    expect(formatAgreementError('مالك الاتفاقية لا يملك العقار طوال فترة الاتفاقية.')).toContain('راجع تواريخ الملكية');
    expect(formatAgreementError('contract is outside the agreement period')).toContain('عقداً محفوظاً');
  });
});

describe('owner agreement data boundary', () => {
  it('queries owner_agreements directly instead of the property_owners ownership-link table', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('./ownerAgreementService.ts', import.meta.url), 'utf8'));

    expect(source).toContain("from('owner_agreements')");
    expect(source).not.toContain("from('property_owners')");
    expect(source).not.toContain('property_owners!inner');
  });
});

describe('normalizePropertyOwnershipPayload (TD-01 atomic ownership payload)', () => {
  it('defaults to a single primary owner at 100% when no split is supplied', () => {
    expect(normalizePropertyOwnershipPayload('owner-1')).toEqual([
      { owner_id: 'owner-1', ownership_percentage: 100, is_primary: true },
    ]);
  });

  it('fails closed on an explicitly empty payload (same as the RPC)', () => {
    expect(() => normalizePropertyOwnershipPayload('owner-1', [])).toThrow('يجب تحديد مالك أساسي واحد فقط في نسب الملكية');
  });

  it('passes a valid explicit split through unchanged', () => {
    const split = [
      { owner_id: 'owner-1', ownership_percentage: 60, is_primary: true },
      { owner_id: 'owner-2', ownership_percentage: 40, is_primary: false },
    ];
    expect(normalizePropertyOwnershipPayload('owner-1', split)).toEqual(split);
  });

  it('fails closed when the split does not total exactly 100', () => {
    expect(() => normalizePropertyOwnershipPayload('owner-1', [
      { owner_id: 'owner-1', ownership_percentage: 60, is_primary: true },
      { owner_id: 'owner-2', ownership_percentage: 30, is_primary: false },
    ])).toThrow('مجموع نسب الملكية يجب أن يساوي 100% بالضبط');
  });

  it('fails closed on duplicate owners', () => {
    expect(() => normalizePropertyOwnershipPayload('owner-1', [
      { owner_id: 'owner-1', ownership_percentage: 50, is_primary: true },
      { owner_id: 'owner-1', ownership_percentage: 50, is_primary: false },
    ])).toThrow('لا يمكن تكرار المالك نفسه في نسب الملكية');
  });

  it('fails closed unless exactly one primary owner matching the property owner exists', () => {
    expect(() => normalizePropertyOwnershipPayload('owner-1', [
      { owner_id: 'owner-2', ownership_percentage: 60, is_primary: true },
      { owner_id: 'owner-1', ownership_percentage: 40, is_primary: false },
    ])).toThrow('المالك الأساسي في بيانات الملكية يختلف عن المالك المحدد للعقار');

    expect(() => normalizePropertyOwnershipPayload('owner-1', [
      { owner_id: 'owner-1', ownership_percentage: 50, is_primary: true },
      { owner_id: 'owner-2', ownership_percentage: 50, is_primary: true },
    ])).toThrow('يجب تحديد مالك أساسي واحد فقط في نسب الملكية');

    expect(() => normalizePropertyOwnershipPayload('owner-1', [
      { owner_id: 'owner-1', ownership_percentage: 50, is_primary: false },
      { owner_id: 'owner-2', ownership_percentage: 50, is_primary: false },
    ])).toThrow('يجب تحديد مالك أساسي واحد فقط في نسب الملكية');
  });

  it('fails closed on out-of-range percentages', () => {
    expect(() => normalizePropertyOwnershipPayload('owner-1', [
      { owner_id: 'owner-1', ownership_percentage: 101, is_primary: true },
    ])).toThrow('أكبر من صفر وألا تتجاوز 100%');
    expect(() => normalizePropertyOwnershipPayload('owner-1', [
      { owner_id: 'owner-1', ownership_percentage: 0, is_primary: true },
    ])).toThrow('أكبر من صفر وألا تتجاوز 100%');
  });
});
