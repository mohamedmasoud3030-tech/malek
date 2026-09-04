import { describe, expect, it } from 'vitest';
import { getInitialReportsFilters, scopeReportsFiltersToFields } from './reports-workspace-filters';
import { getReportProduct, getReportProductFilterFields, getReportProductTarget } from './report-products';

const dirty = {
  ...getInitialReportsFilters({
    from: '2026-08-01',
    to: '2026-08-31',
    propertyId: 'property-1',
    unitId: 'unit-1',
    tenantId: 'tenant-1',
    ownerId: 'owner-1',
    contractId: 'contract-1',
    costCenterId: 'cost-1',
    status: 'overdue',
  }),
};

describe('premium report product filter ownership', () => {
  it('keeps only period/property/owner for the owner comprehensive statement', () => {
    const product = getReportProduct('owner-comprehensive-statement')!;
    const target = getReportProductTarget(product, 'statement');
    const fields = getReportProductFilterFields(target);
    const scoped = scopeReportsFiltersToFields(dirty, fields);

    expect(fields).toEqual(['period', 'property', 'owner']);
    expect(scoped.propertyId).toBe('property-1');
    expect(scoped.ownerId).toBe('owner-1');
    expect(scoped.contractId).toBe('');
    expect(scoped.unitId).toBe('');
    expect(scoped.tenantId).toBe('');
    expect(scoped.costCenterId).toBe('');
    expect(scoped.status).toBe('all');
  });

  it('keeps contract scope but removes owner scope from the tenant statement', () => {
    const product = getReportProduct('tenant-statement')!;
    const target = getReportProductTarget(product, 'statement');
    const fields = getReportProductFilterFields(target);
    const scoped = scopeReportsFiltersToFields(dirty, fields);

    expect(fields).toEqual(['period', 'property', 'contract']);
    expect(scoped.propertyId).toBe('property-1');
    expect(scoped.contractId).toBe('contract-1');
    expect(scoped.ownerId).toBe('');
    expect(scoped.unitId).toBe('');
    expect(scoped.tenantId).toBe('');
    expect(scoped.status).toBe('all');
  });

  it('prevents entity filters from leaking into the company-level financial movement pack', () => {
    const product = getReportProduct('financial-settlement-pack')!;
    const target = getReportProductTarget(product, 'financial-movement');
    const fields = getReportProductFilterFields(target);
    const scoped = scopeReportsFiltersToFields(dirty, fields);

    expect(fields).toEqual(['period']);
    expect(scoped.propertyId).toBe('');
    expect(scoped.ownerId).toBe('');
    expect(scoped.contractId).toBe('');
    expect(scoped.unitId).toBe('');
    expect(scoped.tenantId).toBe('');
    expect(scoped.costCenterId).toBe('');
    expect(scoped.status).toBe('all');
    expect(scoped.from).toBe('2026-08-01');
    expect(scoped.to).toBe('2026-08-31');
  });

  it('inherits filter ownership from the target workspace when there is no product override', () => {
    const product = getReportProduct('collections-arrears-cheques')!;
    const target = getReportProductTarget(product, 'period');
    const fields = getReportProductFilterFields(target);
    const scoped = scopeReportsFiltersToFields(dirty, fields);

    expect(fields).toEqual(['period', 'asOf', 'property', 'unit', 'tenant', 'contract', 'status']);
    expect(scoped.ownerId).toBe('');
    expect(scoped.costCenterId).toBe('');
    expect(scoped.contractId).toBe('contract-1');
    expect(scoped.status).toBe('overdue');
  });
});
