import { describe, expect, it } from 'vitest';
import { buildMaintenanceLocationLabel, filterMaintenanceRequests, normalizeMaintenanceRecord, summarizeMaintenanceRequests } from './maintenance-helpers';
import type { Maintenance } from './maintenance-service';

const baseRequest: Maintenance = {
  id: 'maintenance-1',
  no: null,
  property_id: 'property-1',
  unit_id: 'unit-1',
  title: 'إصلاح المكيف',
  description: null,
  priority: 'urgent',
  status: 'open',
  assigned_to: null,
  cost: 0,
  charged_to: null,
  notes: null,
  request_date: null,
  scheduled_date: null,
  work_description: null,
  technician_name: null,
  response_time_hours: null,
  expense_id: null,
  invoice_id: null,
  reported_by: null,
  completed_at: null,
  resolved_at: null,
  attachment_url: null,
  created_at: '2026-05-17T00:00:00.000Z',
  updated_at: '2026-05-17T00:00:00.000Z',
  deleted_at: null,
};

const secondRequest: Maintenance = {
  ...baseRequest,
  id: 'maintenance-2',
  property_id: 'property-2',
  unit_id: null,
  priority: 'medium',
  status: 'in_progress',
};

describe('maintenance helpers', () => {
  it('builds a readable property and unit location label', () => {
    const label = buildMaintenanceLocationLabel(
      baseRequest,
      [{ id: 'property-1', title: 'برج النخيل' }],
      [{ id: 'unit-1', property_id: 'property-1', unit_number: 'A-12' }],
    );

    expect(label).toBe('برج النخيل / A-12');
  });

  it('filters requests by status, priority, and property', () => {
    const rows = filterMaintenanceRequests([baseRequest, secondRequest], {
      status: 'open',
      priority: 'urgent',
      propertyId: 'property-1',
    });

    expect(rows).toEqual([baseRequest]);
  });

  it('summarizes visible maintenance requests without financial side effects', () => {
    const summary = summarizeMaintenanceRequests([baseRequest, secondRequest]);

    expect(summary).toEqual({ total: 2, open: 1, inProgress: 1, urgent: 1 });
  });

  it('normalizes historical casing and lifecycle aliases before filtering and KPI totals', () => {
    const legacy = normalizeMaintenanceRecord({ ...baseRequest, status: 'COMPLETED' as any, priority: 'NORMAL' as any });
    expect(legacy.status).toBe('resolved');
    expect(legacy.priority).toBe('medium');
    expect(filterMaintenanceRequests([legacy], { status: 'resolved', priority: 'medium', propertyId: '' })).toEqual([legacy]);
  });
});
