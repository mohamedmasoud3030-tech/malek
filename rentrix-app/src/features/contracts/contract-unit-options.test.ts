import { describe, expect, it } from 'vitest';
import { buildContractUnitOptionLabel, getContractUnitSelectionIssue, isUnitSelectableForContract, type ContractUnitOptionUnit } from './contract-unit-options';

const unit = (overrides: Partial<ContractUnitOptionUnit>): ContractUnitOptionUnit => ({ id: 'unit-1', property_id: 'property-1', unit_number: 'A-1', status: 'available', rent_amount: 100, ...overrides });

describe('contract unit option helpers', () => {
  it('builds concise mobile-friendly labels from available display fields only', () => {
    expect(buildContractUnitOptionLabel({ unit: unit({ status: 'maintenance', rent_amount: 1250, unit_number: 'A-101' }), property: { title: 'برج النخيل', address: 'شارع 1' }, formatRent: (amount) => `${amount ?? 0} OMR` })).toBe('برج النخيل — غرفة A-101 — صيانة — 1250 OMR');
  });

  it('keeps statuses visible without rendering missing rent or null-like separators', () => {
    const label = buildContractUnitOptionLabel({ unit: unit({ id: 'unit-2', unit_number: 'B-202', status: 'reserved', rent_amount: null }) });
    expect(label).toBe('غرفة B-202 — محجوزة');
    expect(label).not.toContain('null');
    expect(label).not.toContain('undefined');
    expect(label).not.toContain('الإيجار');
    expect(label).not.toContain('|');
  });

  it('allows an occupied unit for a future period when no contract overlaps', () => {
    expect(isUnitSelectableForContract({ unit: unit({ id: 'unit-occupied', status: 'occupied' }) })).toBe(true);
    expect(getContractUnitSelectionIssue({ units: [unit({ id: 'unit-occupied', status: 'occupied' })], propertyId: 'property-1', unitId: 'unit-occupied' })).toBeNull();
  });

  it('rejects units with overlapping draft or active contracts', () => {
    const conflictsByUnitId = new Map([['unit-occupied', { id: 'contract-1', unit_id: 'unit-occupied', start_date: '2026-09-01', end_date: '2027-08-31', status: 'active' }]]);
    expect(isUnitSelectableForContract({ unit: unit({ id: 'unit-occupied', status: 'occupied' }), conflictsByUnitId })).toBe(false);
    expect(getContractUnitSelectionIssue({ units: [unit({ id: 'unit-occupied', status: 'occupied' })], propertyId: 'property-1', unitId: 'unit-occupied', conflictsByUnitId })).toContain('عقد نشط متداخل');
  });

  it('rejects units outside the selected property option set', () => {
    expect(getContractUnitSelectionIssue({ units: [unit({ id: 'unit-1' })], propertyId: 'property-2', unitId: 'unit-1' })).toBe('الوحدة المختارة لا تتبع العقار المحدد');
    expect(getContractUnitSelectionIssue({ units: [unit({ id: 'unit-1' })], propertyId: 'property-1', unitId: 'missing-unit' })).toBe('اختر وحدة من قائمة العقار المحدد');
  });

  it('keeps maintenance and reserved as operational blockers except the currently linked edit unit', () => {
    const maintenance = unit({ id: 'unit-maintenance', status: 'maintenance' });
    const reserved = unit({ id: 'unit-reserved', status: 'reserved' });
    expect(getContractUnitSelectionIssue({ units: [maintenance], propertyId: 'property-1', unitId: 'unit-maintenance' })).toContain('الصيانة');
    expect(getContractUnitSelectionIssue({ units: [reserved], propertyId: 'property-1', unitId: 'unit-reserved' })).toContain('محجوزة');
    expect(getContractUnitSelectionIssue({ units: [maintenance], propertyId: 'property-1', unitId: 'unit-maintenance', currentLinkedUnitId: 'unit-maintenance' })).toBeNull();
  });
});
