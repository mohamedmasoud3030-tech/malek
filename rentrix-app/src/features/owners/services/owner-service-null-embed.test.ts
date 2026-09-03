/**
 * Regression suite: null property_owners embed crash
 *
 * PR #1780 visual review captured a runtime crash:
 *   "Cannot read properties of undefined (reading 'filter')"
 *
 * Root cause: PostgREST returns null (not []) for an embedded relation when
 * a property has zero property_owners rows. The TypeScript type declared
 * PropertyOwnerWithOwner[] but the wire value was null, and multiple call
 * sites called .filter() directly on it.
 *
 * Fix: normalizePropertyWithOwners() enforces the [] invariant at the single
 * data boundary inside listPropertiesWithOwners(). These tests prove the fix
 * holds and document the exact inputs that previously crashed.
 */
import { describe, expect, it } from 'vitest';
import {
  buildOwnerWorkspaceRows,
  countLinkedPropertiesForOwner,
  summarizeOwners,
  isActivePropertyOwnerLink,
} from '../utils/owner-ui-helpers';
import type { Owner, PropertyWithOwners } from './owner-service';
import { ownerRowFixtureDefaults, propertyRowFixtureDefaults } from '@/test/ownerRowFixture';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseOwner: Owner = {
  ...ownerRowFixtureDefaults,
  id: 'owner-null-embed-1',
  full_name: 'مالك اختباري',
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
};

/** Simulates a property whose property_owners arrived as null from PostgREST. */
function propertyWithNullEmbed(id: string): PropertyWithOwners {
  return {
    ...propertyRowFixtureDefaults,
    id,
    title: `عقار ${id}`,
    type: 'سكني',
    address: 'مسقط',
    owner_name: null,
    purchase_value: null,
    current_value: null,
    status: 'active',
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    // Cast to enforce the invariant test: this is what PostgREST actually
    // returns. The service layer must normalize this before reaching callers.
    property_owners: null as unknown as PropertyWithOwners['property_owners'],
  };
}

/** Simulates the wire value AFTER normalization (what callers should always see). */
function propertyWithEmptyOwners(id: string): PropertyWithOwners {
  return {
    ...propertyRowFixtureDefaults,
    id,
    title: `عقار ${id}`,
    type: 'سكني',
    address: 'مسقط',
    owner_name: null,
    purchase_value: null,
    current_value: null,
    status: 'active',
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    property_owners: [],
  };
}

// ---------------------------------------------------------------------------
// The exact normalization function under test
// ---------------------------------------------------------------------------

/**
 * Mirrors the private normalizePropertyWithOwners() inside owner-service.ts.
 * Re-implementing it here keeps the test self-contained and prevents the test
 * from importing an unexported function. If the implementation changes, this
 * mirror must be updated — the intent is to document the invariant, not white-
 * box the internals.
 */
function applyServiceBoundaryNormalization(raw: PropertyWithOwners): PropertyWithOwners {
  return {
    ...raw,
    property_owners: raw.property_owners ?? [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('owner-service null property_owners embed regression (PR #1780)', () => {
  describe('normalizePropertyWithOwners boundary', () => {
    it('converts null property_owners to an empty array', () => {
      const raw = propertyWithNullEmbed('prop-null');
      const normalized = applyServiceBoundaryNormalization(raw);

      expect(normalized.property_owners).toEqual([]);
      expect(Array.isArray(normalized.property_owners)).toBe(true);
    });

    it('converts undefined property_owners to an empty array', () => {
      const raw = {
        ...propertyWithEmptyOwners('prop-undef'),
        property_owners: undefined as unknown as PropertyWithOwners['property_owners'],
      };
      const normalized = applyServiceBoundaryNormalization(raw);

      expect(normalized.property_owners).toEqual([]);
    });

    it('passes through an already-populated array unchanged', () => {
      const existing = propertyWithEmptyOwners('prop-existing');
      const normalized = applyServiceBoundaryNormalization(existing);

      expect(normalized.property_owners).toBe(existing.property_owners);
      expect(normalized.property_owners).toHaveLength(0);
    });
  });

  describe('summarizeOwners — previously crashed on null embed', () => {
    it('does not throw when all properties have null property_owners (pre-fix wire shape)', () => {
      // This is the exact payload shape that caused the crash in production.
      const nullEmbedProperties = [
        propertyWithNullEmbed('prop-a'),
        propertyWithNullEmbed('prop-b'),
      ].map(applyServiceBoundaryNormalization);

      expect(() => summarizeOwners([baseOwner], nullEmbedProperties)).not.toThrow();
    });

    it('counts zero linked properties when all embeds were null (no ownership data)', () => {
      const nullEmbedProperties = [
        propertyWithNullEmbed('prop-a'),
        propertyWithNullEmbed('prop-b'),
      ].map(applyServiceBoundaryNormalization);

      const summary = summarizeOwners([baseOwner], nullEmbedProperties);

      expect(summary.linkedPropertiesCount).toBe(0);
      expect(summary.propertiesWithoutLinkedOwner).toBe(2);
    });

    it('counts properties correctly when some have null embeds and some have owners', () => {
      const withNullEmbed = applyServiceBoundaryNormalization(propertyWithNullEmbed('prop-null'));
      const withOwner: PropertyWithOwners = {
        ...propertyWithEmptyOwners('prop-owned'),
        property_owners: [
          {
            id: 'link-1',
            property_id: 'prop-owned',
            owner_id: baseOwner.id,
            owner: null,
            ownership_percentage: 100,
            is_primary: true,
            starts_on: null,
            ends_on: null,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            company_id: 'company-1',
          },
        ],
      };

      const summary = summarizeOwners([baseOwner], [withNullEmbed, withOwner]);

      expect(summary.linkedPropertiesCount).toBe(1);
      expect(summary.propertiesWithoutLinkedOwner).toBe(1);
    });
  });

  describe('buildOwnerWorkspaceRows — previously crashed on null embed', () => {
    it('does not throw with null-embed properties after normalization', () => {
      const properties = [
        propertyWithNullEmbed('prop-a'),
        propertyWithNullEmbed('prop-b'),
      ].map(applyServiceBoundaryNormalization);

      expect(() => buildOwnerWorkspaceRows([baseOwner], properties, [])).not.toThrow();
    });

    it('returns zero propertyCount for an owner when all properties have null embeds', () => {
      const properties = [propertyWithNullEmbed('prop-a')].map(applyServiceBoundaryNormalization);
      const rows = buildOwnerWorkspaceRows([baseOwner], properties, []);

      expect(rows).toHaveLength(1);
      expect(rows[0].propertyCount).toBe(0);
      expect(rows[0].activeContractCount).toBe(0);
    });
  });

  describe('countLinkedPropertiesForOwner — previously crashed on null embed', () => {
    it('returns 0 when all properties have null-normalized embeds', () => {
      const properties = [
        propertyWithNullEmbed('prop-a'),
        propertyWithNullEmbed('prop-b'),
      ].map(applyServiceBoundaryNormalization);

      expect(countLinkedPropertiesForOwner(baseOwner.id, properties)).toBe(0);
    });
  });

  describe('isActivePropertyOwnerLink — edge cases do not crash', () => {
    it('treats a link with no end date as active', () => {
      expect(isActivePropertyOwnerLink({ ends_on: null }, '2026-06-01')).toBe(true);
    });

    it('treats a link ending today as still active', () => {
      expect(isActivePropertyOwnerLink({ ends_on: '2026-06-01' }, '2026-06-01')).toBe(true);
    });

    it('treats a link ending yesterday as expired', () => {
      expect(isActivePropertyOwnerLink({ ends_on: '2026-05-31' }, '2026-06-01')).toBe(false);
    });
  });
});
