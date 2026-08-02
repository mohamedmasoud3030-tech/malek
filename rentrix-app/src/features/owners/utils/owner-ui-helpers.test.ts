import { describe, expect, it } from 'vitest';
import {
  emptyOwnerFormValues,
  emptyPropertyOwnershipLinkFormValues,
  buildOwnerWorkspaceRows,
  filterOwnerWorkspaceRows,
  propertyOwnerLinkToFormValues,
  propertyOwnershipLinkFormToPayload,
  isActivePropertyOwnerLink,
  summarizeOwners,
  validateOwnerForm,
  validatePropertyOwnershipLinkForm,
} from './owner-ui-helpers';
import type { Owner, PropertyOwnerWithOwner, PropertyWithOwners } from '../services/owner-service';

const baseOwner: Owner = {
  id: 'owner-1',
  full_name: 'مالك نشط',
  display_name: null,
  phone: null,
  email: null,
  national_id: null,
  tax_number: null,
  address: null,
  notes: null,
  is_active: true,
  created_at: '2026-05-15T00:00:00.000Z',
  updated_at: '2026-05-15T00:00:00.000Z',
};

function propertyOwnerLink(propertyId: string, ownerId: string, endsOn: string | null = null): PropertyOwnerWithOwner {
  return {
    id: `${propertyId}-${ownerId}-${endsOn ?? 'active'}`,
    property_id: propertyId,
    owner_id: ownerId,
    ownership_percentage: 100,
    is_primary: true,
    starts_on: null,
    ends_on: endsOn,
    created_at: '2026-05-15T00:00:00.000Z',
    updated_at: '2026-05-15T00:00:00.000Z',
    owner: null,
  };
}

function property(id: string, ownerIds: string[]): PropertyWithOwners {
  return {
    id,
    title: `عقار ${id}`,
    type: 'سكني',
    address: 'مسقط',
    owner_name: null,
    purchase_value: null,
    current_value: null,
    status: 'active',
    notes: null,
    created_at: '2026-05-15T00:00:00.000Z',
    updated_at: '2026-05-15T00:00:00.000Z',
    deleted_at: null,
    property_owners: ownerIds.map((ownerId) => propertyOwnerLink(id, ownerId)),
  };
}

describe('owner UI helpers', () => {
  it('validates required owner names and light email format', () => {
    expect(validateOwnerForm(emptyOwnerFormValues)).toBe('اسم المالك مطلوب');
    expect(validateOwnerForm({ ...emptyOwnerFormValues, full_name: 'مالك', email: 'bad-email' })).toBe('البريد الإلكتروني غير صحيح');
    expect(validateOwnerForm({ ...emptyOwnerFormValues, full_name: 'مالك', email: 'owner@example.com' })).toBeNull();
  });

  it('validates property ownership link date ranges', () => {
    expect(validatePropertyOwnershipLinkForm(emptyPropertyOwnershipLinkFormValues)).toBe('اختر العقار أولاً');
    expect(validatePropertyOwnershipLinkForm({
      ...emptyPropertyOwnershipLinkFormValues,
      property_id: 'property-1',
      starts_on: '2026-05-10',
      ends_on: '2026-05-09',
    })).toBe('تاريخ نهاية الملكية يجب ألا يسبق تاريخ البداية');
    expect(validatePropertyOwnershipLinkForm({
      ...emptyPropertyOwnershipLinkFormValues,
      property_id: 'property-1',
      starts_on: '2026-05-10',
      ends_on: '2026-05-10',
    })).toBeNull();
  });

  it('keeps a scheduled ownership link active through its end date', () => {
    const scheduled = propertyOwnerLink('property-1', 'owner-1', '2026-05-16');

    expect(isActivePropertyOwnerLink(scheduled, '2026-05-15')).toBe(true);
    expect(isActivePropertyOwnerLink(scheduled, '2026-05-16')).toBe(true);
    expect(isActivePropertyOwnerLink(scheduled, '2026-05-17')).toBe(false);
  });

  it('keeps property ownership link metadata fields available for submit payloads', () => {
    const values = {
      ...emptyPropertyOwnershipLinkFormValues,
      property_id: 'property-1',
      ownership_percentage: '55.5',
      is_primary: false,
      starts_on: '2026-05-01',
      ends_on: '2026-06-01',
    };

    expect(emptyPropertyOwnershipLinkFormValues).toMatchObject({
      is_primary: true,
      starts_on: '',
      ends_on: '',
    });
    expect(validatePropertyOwnershipLinkForm(values)).toBeNull();
    expect(propertyOwnershipLinkFormToPayload(values)).toEqual({
      ownership_percentage: 55.5,
      is_primary: false,
      starts_on: '2026-05-01',
      ends_on: '2026-06-01',
    });
  });

  it('maps existing property owner links back into editable form values', () => {
    expect(propertyOwnerLinkToFormValues({
      property_id: 'property-1',
      ownership_percentage: 45.25,
      is_primary: false,
      starts_on: null,
      ends_on: '2026-06-01',
    })).toEqual({
      property_id: 'property-1',
      ownership_percentage: '45.25',
      is_primary: false,
      starts_on: '',
      ends_on: '2026-06-01',
    });
  });

  it('builds searchable owner workspace rows without financial balances', () => {
    const rows = buildOwnerWorkspaceRows([baseOwner], [property('property-1', ['owner-1'])], [{ id: 'contract-1', property_id: 'property-1' }]);

    expect(rows[0]).toMatchObject({
      propertyCount: 1,
      activeContractCount: 1,
      propertyNames: 'عقار property-1',
      ownershipSummary: 'عقار property-1: 100% أساسي',
    });
    expect(filterOwnerWorkspaceRows(rows, 'مالك')).toHaveLength(1);
    expect(filterOwnerWorkspaceRows(rows, 'property-1')).toHaveLength(1);
    expect(filterOwnerWorkspaceRows(rows, 'غير موجود')).toHaveLength(0);
  });

  it('ignores ended owner-property links in active owner summaries and workspace rows', () => {
    const activeProperty = property('property-1', ['owner-1']);
    const endedProperty = {
      ...property('property-2', []),
      property_owners: [propertyOwnerLink('property-2', 'owner-1', '2026-05-16')],
    };
    const rows = buildOwnerWorkspaceRows([baseOwner], [activeProperty, endedProperty], [
      { id: 'contract-1', property_id: 'property-1' },
      { id: 'contract-2', property_id: 'property-2' },
    ]);

    expect(isActivePropertyOwnerLink(endedProperty.property_owners[0])).toBe(false);
    expect(rows[0]).toMatchObject({
      propertyCount: 1,
      activeContractCount: 1,
      propertyNames: 'عقار property-1',
    });
    expect(summarizeOwners([baseOwner], [activeProperty, endedProperty])).toMatchObject({
      linkedPropertiesCount: 1,
      propertiesWithoutLinkedOwner: 1,
    });
  });

  it('summarizes owners and property relationships without financial balances', () => {
    expect(summarizeOwners([
      baseOwner,
      { ...baseOwner, id: 'owner-2', is_active: false },
    ], [property('property-1', ['owner-1']), property('property-2', []), property('property-3', ['owner-1', 'owner-2'])])).toEqual({
      totalOwners: 2,
      activeOwners: 1,
      linkedPropertiesCount: 2,
      propertiesWithoutLinkedOwner: 1,
    });
  });
});
