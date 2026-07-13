import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  getActiveOwnerLinks,
  getOwnerActivePropertyCount,
  getOwnerDisplayName,
  getPropertyOwnerDisplayName,
  normalizeOwnerPayload,
  normalizeOwnerUpdatePayload,
  normalizeOwnershipPercentage,
  normalizePropertyOwnerPayload,
  summarizeOwnerFinancials,
} from './owner-service';
import type { Owner, PropertyWithOwners } from './owner-service';

const owner: Owner = {
  id: 'owner-1',
  full_name: 'مالك أساسي',
  display_name: null,
  phone: null,
  email: null,
  national_id: null,
  tax_number: null,
  address: null,
  notes: null,
  is_active: true,
  created_at: '2026-06-04T00:00:00.000Z',
  updated_at: '2026-06-04T00:00:00.000Z',
};

function propertyWithOwner(ownerId: string, endsOn: string | null = null): PropertyWithOwners {
  return {
    id: `property-${ownerId}-${endsOn ?? 'active'}`,
    title: 'عقار موثق',
    type: 'سكني',
    address: 'مسقط',
    owner_name: 'مالك نصي',
    purchase_value: null,
    current_value: null,
    status: 'active',
    notes: null,
    created_at: '2026-06-04T00:00:00.000Z',
    updated_at: '2026-06-04T00:00:00.000Z',
    deleted_at: null,
    property_owners: [{
      id: `link-${ownerId}`,
      property_id: 'property-1',
      owner_id: ownerId,
      ownership_percentage: 100,
      is_primary: true,
      starts_on: null,
      ends_on: endsOn,
      created_at: '2026-06-04T00:00:00.000Z',
      updated_at: '2026-06-04T00:00:00.000Z',
      owner: { ...owner, id: ownerId, display_name: 'مالك مرتبط' },
    }],
  };
}

describe('owner service normalization helpers', () => {
  it('trims owner strings and converts blank optional strings to null', () => {
    expect(normalizeOwnerPayload({
      full_name: '  شركة المالك  ',
      display_name: '  المالك  ',
      phone: '   ',
      email: ' owner@example.com ',
      is_active: false,
    })).toMatchObject({
      full_name: 'شركة المالك',
      display_name: 'المالك',
      phone: null,
      email: 'owner@example.com',
      is_active: false,
    });
  });

  it('rejects blank owner names for create and update payloads', () => {
    expect(() => normalizeOwnerPayload({ full_name: '   ' })).toThrow('اسم المالك مطلوب');
    expect(() => normalizeOwnerUpdatePayload({ full_name: '' })).toThrow('اسم المالك مطلوب');
  });

  it('normalizes safe ownership percentages and rejects invalid values', () => {
    expect(normalizeOwnershipPercentage(undefined)).toBe(100);
    expect(normalizeOwnershipPercentage(null)).toBe(100);
    expect(normalizeOwnershipPercentage('')).toBe(100);
    expect(normalizeOwnershipPercentage('33.333')).toBe(33.33);
    expect(() => normalizeOwnershipPercentage(0)).toThrow('نسبة الملكية');
    expect(() => normalizeOwnershipPercentage(101)).toThrow('نسبة الملكية');
    expect(() => normalizeOwnershipPercentage('not-a-number')).toThrow('نسبة الملكية');
  });

  it('rounds ownership percentages before enforcing database constraint boundaries', () => {
    expect(normalizeOwnershipPercentage(0.005)).toBe(0.01);
    expect(normalizeOwnershipPercentage('0.005')).toBe(0.01);
    expect(normalizeOwnershipPercentage(100.004)).toBe(100);
    expect(normalizeOwnershipPercentage('100.004')).toBe(100);
    expect(() => normalizeOwnershipPercentage(0.004)).toThrow('نسبة الملكية');
    expect(() => normalizeOwnershipPercentage('0.004')).toThrow('نسبة الملكية');
    expect(() => normalizeOwnershipPercentage(100.005)).toThrow('نسبة الملكية');
    expect(() => normalizeOwnershipPercentage('100.005')).toThrow('نسبة الملكية');
  });

  it('normalizes property owner links with primary flags and optional dates', () => {
    expect(normalizePropertyOwnerPayload({
      property_id: ' property-1 ',
      owner_id: ' owner-1 ',
      ownership_percentage: 25.5,
      is_primary: false,
      starts_on: ' 2026-05-01 ',
      ends_on: ' 2026-06-01 ',
    })).toEqual({
      property_id: 'property-1',
      owner_id: 'owner-1',
      ownership_percentage: 25.5,
      is_primary: false,
      starts_on: '2026-05-01',
      ends_on: '2026-06-01',
    });

    expect(normalizePropertyOwnerPayload({
      property_id: 'property-1',
      owner_id: 'owner-1',
      ends_on: ' ',
    })).toMatchObject({
      ownership_percentage: 100,
      is_primary: true,
      starts_on: null,
      ends_on: null,
    });
  });

  it('rejects rounded-zero ownership percentages before database writes', () => {
    expect(() => normalizePropertyOwnerPayload({
      property_id: 'property-1',
      owner_id: 'owner-1',
      ownership_percentage: 0.004,
    })).toThrow('نسبة الملكية');
  });

  it('soft-ends owner-property relationships instead of hard deleting them', () => {
    const ownerServiceSource = readFileSync(new URL('./owner-service.ts', import.meta.url), 'utf8');

    expect(ownerServiceSource).toContain('.update({ ends_on:');
    expect(ownerServiceSource).not.toContain('.delete()');
  });
});

describe('owner read helpers', () => {
  it('uses display names safely', () => {
    expect(getOwnerDisplayName({ ...owner, display_name: '  اسم مختصر  ' })).toBe('اسم مختصر');
    expect(getOwnerDisplayName(owner)).toBe('مالك أساسي');
  });

  it('prefers active relationship owners over legacy property text', () => {
    expect(getPropertyOwnerDisplayName(propertyWithOwner('owner-1'))).toBe('مالك مرتبط');
    expect(getPropertyOwnerDisplayName(propertyWithOwner('owner-1', '2026-06-04'))).toBe('مالك نصي');
  });

  it('counts only active owner links', () => {
    const activeProperty = propertyWithOwner('owner-1');
    const endedProperty = propertyWithOwner('owner-1', '2026-06-04');

    expect(getActiveOwnerLinks(activeProperty)).toHaveLength(1);
    expect(getActiveOwnerLinks(endedProperty)).toHaveLength(0);
    expect(getOwnerActivePropertyCount('owner-1', [activeProperty, endedProperty])).toBe(1);
  });

  it('summarizes owner outstanding balance from non-deleted invoice remaining amounts', () => {
    expect(summarizeOwnerFinancials([
      { amount: 1000, paid_amount: 250, deleted_at: null },
      { amount: 500, paid_amount: 500, deleted_at: null },
      { amount: 300, paid_amount: 100, deleted_at: '2026-06-01T00:00:00.000Z' },
      { amount: 100, paid_amount: 150, deleted_at: null },
    ])).toEqual({
      outstandingBalance: 750,
      outstandingInvoicesCount: 1,
    });
  });
});

describe('owner relationship migration protections', () => {
  const coreSchemaSql = readFileSync(
    new URL('../../../../../supabase/migrations/20250101000001_core_schema.sql', import.meta.url),
    'utf8',
  );
  const functionsSql = readFileSync(
    new URL('../../../../../supabase/migrations/20250101000003_functions_triggers_and_rpcs.sql', import.meta.url),
    'utf8',
  );

  it('protects against multiple active primary owners per property', () => {
    expect(coreSchemaSql).toContain('property_owners_active_primary_unique_idx');
    expect(coreSchemaSql).toContain('where ends_on is null and is_primary');
  });

  it('protects active ownership percentage totals from exceeding 100 percent', () => {
    expect(functionsSql).toContain('validate_property_owner_active_totals');
    expect(functionsSql).toContain('v_other_active_percentage_total + new.ownership_percentage > 100');
    expect(functionsSql).toContain('Active ownership percentages for a property cannot exceed 100.');
  });
});
