import { describe, expect, it } from 'vitest';
import {
  buildMaintenanceDashboardSummary,
  EMPTY_MAINTENANCE_DASHBOARD_SUMMARY,
} from './maintenance-dashboard-summary';
import type { Maintenance } from '@/features/maintenance/maintenance-service';

const TODAY = '2026-08-29';

function makeRow(overrides: Partial<Maintenance>): Maintenance {
  return {
    id: 'mnt',
    no: null,
    property_id: 'property-1',
    unit_id: null,
    title: 'طلب',
    description: null,
    priority: 'medium',
    status: 'open',
    assigned_to: null,
    cost: null,
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
    created_at: null,
    updated_at: null,
    attachment_url: null,
    deleted_at: null,
    company_id: 'company-1',
    reference: null,
    service_provider_id: null,
    service_provider_category_id: null,
    cancelled_at: null,
    cancellation_reason: null,
    request_id: null,
    ...overrides,
  };
}

describe('buildMaintenanceDashboardSummary', () => {
  it('returns the empty summary for no rows but keeps the server urgent count honest', () => {
    expect(buildMaintenanceDashboardSummary(undefined, TODAY)).toEqual(EMPTY_MAINTENANCE_DASHBOARD_SUMMARY);
    expect(buildMaintenanceDashboardSummary([], TODAY, 3).urgentOpen).toBe(3);
  });

  it('counts active vs completed over the complete set and passes the server urgent KPI through', () => {
    const summary = buildMaintenanceDashboardSummary([
      makeRow({ id: 'a', status: 'open', priority: 'urgent' }),
      makeRow({ id: 'b', status: 'in_progress' }),
      makeRow({ id: 'c', status: 'resolved', request_date: '2026-08-01', completed_at: '2026-08-04' }),
      makeRow({ id: 'd', status: 'closed', request_date: '2026-08-10', resolved_at: '2026-08-12' }),
      makeRow({ id: 'e', status: 'cancelled', request_date: '2026-08-01', completed_at: '2026-08-02' }),
    ], TODAY, 1);

    expect(summary.total).toBe(5);
    expect(summary.active).toBe(2);
    expect(summary.completed).toBe(2);
    expect(summary.urgentOpen).toBe(1); // server-authoritative, not recounted
  });

  it('falls back to the complete-set urgent count only when the server KPI is absent', () => {
    const summary = buildMaintenanceDashboardSummary([
      makeRow({ id: 'a', status: 'open', priority: 'urgent' }),
      makeRow({ id: 'b', status: 'in_progress', priority: 'urgent' }),
      makeRow({ id: 'c', status: 'open', priority: 'medium' }),
    ], TODAY);
    expect(summary.urgentOpen).toBe(2);
  });

  it('averages resolution time only over rows with both report and completion dates', () => {
    const summary = buildMaintenanceDashboardSummary([
      // 3 days to resolve, completed 5 days ago (current window).
      makeRow({ id: 'a', status: 'resolved', request_date: '2026-08-20', completed_at: '2026-08-23' }),
      // 5 days to resolve, completed 10 days ago (current window).
      makeRow({ id: 'b', status: 'closed', request_date: '2026-08-12', resolved_at: '2026-08-17' }),
      // No completion date — excluded, never guessed.
      makeRow({ id: 'c', status: 'resolved', request_date: '2026-08-10' }),
    ], TODAY);

    expect(summary.averageResolutionDays).toBe(4); // (3 + 5) / 2
    expect(summary.previousAverageResolutionDays).toBeNull();
    expect(summary.resolutionChangePercent).toBeNull();
  });

  it('computes the period trend only when both trailing windows have completions', () => {
    const summary = buildMaintenanceDashboardSummary([
      // Current window (last 90 days): 2 days.
      makeRow({ id: 'a', status: 'resolved', request_date: '2026-08-20', completed_at: '2026-08-22' }),
      // Previous window (90–180 days ago): 6 days.
      makeRow({ id: 'b', status: 'closed', request_date: '2026-04-01', completed_at: '2026-04-07' }),
    ], TODAY);

    expect(summary.averageResolutionDays).toBe(2);
    expect(summary.previousAverageResolutionDays).toBe(6);
    expect(summary.resolutionChangePercent).toBe(-67); // faster is a negative change
  });

  it('ignores negative or impossible durations instead of corrupting the average', () => {
    const summary = buildMaintenanceDashboardSummary([
      makeRow({ id: 'a', status: 'resolved', request_date: '2026-08-25', completed_at: '2026-08-20' }),
      makeRow({ id: 'b', status: 'resolved', request_date: '2026-08-20', completed_at: '2026-08-22' }),
    ], TODAY);
    expect(summary.averageResolutionDays).toBe(2);
  });
});
