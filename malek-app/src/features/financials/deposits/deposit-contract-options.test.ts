import { describe, expect, it } from 'vitest';
import {
  describeSelectedContract,
  formatContractOptionLabel,
  formatDepositContractReference,
  type DepositContractOption,
} from './deposit-contract-options';

const CONTRACT_ID = 'a1b2c3d4-0000-4000-8000-000000000001';

function contract(overrides: Partial<DepositContractOption> = {}): DepositContractOption {
  return {
    id: CONTRACT_ID,
    tenant_id: 'tenant-uuid-1',
    property_id: 'property-uuid-1',
    unit_id: 'unit-uuid-1',
    people: { id: 'tenant-uuid-1', full_name: 'محمد أحمد' },
    properties: { id: 'property-uuid-1', title: 'عقار النور' },
    units: { id: 'unit-uuid-1', unit_number: '12' },
    ...overrides,
  };
}

describe('deposit contract option labels', () => {
  it('shows tenant, unit, and property instead of the UUID', () => {
    expect(formatContractOptionLabel(contract())).toBe('محمد أحمد — الوحدة 12 — عقار النور');
  });

  it('never uses the contract UUID as the label', () => {
    const label = formatContractOptionLabel(contract());
    expect(label).not.toContain(CONTRACT_ID);
    expect(label).not.toContain(CONTRACT_ID.slice(0, 8));
    expect(label).not.toContain('tenant-uuid-1');
    expect(label).not.toContain('property-uuid-1');
  });

  it('falls back to readable Arabic placeholders when relations are missing', () => {
    expect(formatContractOptionLabel(contract({ people: null, units: null, properties: null })))
      .toBe('مستأجر غير محدد — وحدة غير محددة — عقار غير محدد');
  });

  it('handles partially missing relations without breaking', () => {
    expect(formatContractOptionLabel(contract({ units: null })))
      .toBe('محمد أحمد — وحدة غير محددة — عقار النور');
    expect(formatContractOptionLabel(contract({ people: { id: 'tenant-uuid-1', full_name: '   ' } })))
      .toBe('مستأجر غير محدد — الوحدة 12 — عقار النور');
  });

  it('keeps the UUID as the internal option value only', () => {
    // The label is purely display data; the contract id is untouched.
    const option = contract();
    formatContractOptionLabel(option);
    expect(option.id).toBe(CONTRACT_ID);
  });

  it('describes the selected contract with tenant, unit, and property', () => {
    expect(describeSelectedContract(contract()))
      .toBe('المستأجر: محمد أحمد · الوحدة 12 · العقار: عقار النور');
    expect(describeSelectedContract(contract({ people: null })))
      .toContain('مستأجر غير محدد');
  });
});

describe('deposit contract reference (list + printed clearance document)', () => {
  it('builds a readable reference from the joined display fields', () => {
    expect(formatDepositContractReference({
      tenant_name: 'محمد أحمد',
      property_title: 'عقار النور',
      unit_number: '12',
    })).toBe('محمد أحمد — الوحدة 12 — عقار النور');
  });

  it('never falls back to raw UUIDs when names are missing', () => {
    const reference = formatDepositContractReference({
      tenant_name: null,
      property_title: null,
      unit_number: null,
    });
    expect(reference).toBe('مستأجر غير محدد — وحدة غير محددة — عقار غير محدد');
    expect(reference).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
  });
});
