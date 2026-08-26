import { describe, expect, it } from 'vitest';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { Owner } from '@/features/owners/services/owner-service';
import type { CostCenterRecord } from '@/features/settings/costCenterService';
import { describeReportFilterSelections, getSelectedFilterEntities } from './reports-filters.shared';
import type { ReportsFilterState } from './reports-workspace-filters';

const costCenterRows = [{ id: 'cc-1', name: 'مركز الشمال' }] as unknown as CostCenterRecord[];
const ownerRows = [{ id: 'owner-1', display_name: 'أبو خالد', full_name: 'خالد بن سعيد' }] as unknown as Owner[];
const contractRows = [
  {
    id: 'contract-1',
    reference: '',
    properties: { id: 'property-1', title: 'برج الواحة' },
    units: { id: 'unit-1', unit_number: '12' },
    people: { id: 'tenant-1', full_name: 'سالم الراشدي' },
  },
] as unknown as ContractListItem[];

const filters: ReportsFilterState = {
  from: '2026-07-01',
  to: '2026-07-31',
  asOf: '2026-07-31',
  costCenterId: 'cc-1',
  ownerId: 'owner-1',
  contractId: 'contract-1',
  propertyId: 'property-1',
  unitId: 'unit-1',
  tenantId: 'tenant-1',
  status: 'all',
};

const labels = () =>
  describeReportFilterSelections(
    getSelectedFilterEntities(filters, costCenterRows, ownerRows, contractRows),
  );

describe('WP-C — shared report filter labels', () => {
  it('formats every selected dimension once, for both filter surfaces', () => {
    expect(labels()).toEqual({
      property: 'برج الواحة',
      unit: 'وحدة 12',
      tenant: 'سالم الراشدي',
      costCenter: 'مركز الشمال',
      owner: 'أبو خالد',
      contract: 'سالم الراشدي — برج الواحة',
    });
  });

  it('falls back to the contract reference when one exists', () => {
    const withReference = [
      { ...contractRows[0], reference: 'CTR-2026-001' },
    ] as unknown as ContractListItem[];
    const entities = getSelectedFilterEntities(filters, costCenterRows, ownerRows, withReference);
    expect(describeReportFilterSelections(entities).contract).toBe('CTR-2026-001');
  });

  it('prefers the owner full name when no display name is set', () => {
    const withoutDisplay = [{ id: 'owner-1', full_name: 'خالد بن سعيد' }] as unknown as Owner[];
    const entities = getSelectedFilterEntities(filters, costCenterRows, withoutDisplay, contractRows);
    expect(describeReportFilterSelections(entities).owner).toBe('خالد بن سعيد');
  });

  it('leaves unset dimensions undefined so the chips stay hidden', () => {
    const empty = describeReportFilterSelections(
      getSelectedFilterEntities(
        { ...filters, propertyId: '', unitId: '', tenantId: '', costCenterId: '', ownerId: '', contractId: '' },
        costCenterRows,
        ownerRows,
        contractRows,
      ),
    );
    expect(empty).toEqual({
      property: undefined,
      unit: undefined,
      tenant: undefined,
      costCenter: undefined,
      owner: undefined,
      contract: undefined,
    });
  });
});
