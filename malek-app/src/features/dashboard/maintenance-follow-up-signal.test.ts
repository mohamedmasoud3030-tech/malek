import { describe, expect, it } from 'vitest';
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import {
  buildMaintenanceFollowUpSignal,
  EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL,
} from './maintenance-follow-up-signal';

const TODAY = '2026-08-27';

function request(overrides: Partial<Maintenance> & { id: string }): Maintenance {
  return {
    company_id: 'company-1',
    property_id: 'property-1',
    unit_id: null,
    title: 'طلب صيانة',
    description: null,
    priority: 'medium',
    status: 'open',
    request_date: TODAY,
    scheduled_date: null,
    created_at: `${TODAY}T00:00:00.000Z`,
    ...overrides,
  } as Maintenance;
}

describe('Today maintenance follow-up summary', () => {
  it('stays neutral when there is nothing to read', () => {
    expect(buildMaintenanceFollowUpSignal(undefined, TODAY)).toBe(EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL);
    expect(buildMaintenanceFollowUpSignal([], TODAY)).toBe(EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL);
  });

  it('keeps the oldest open age even when nothing needs follow-up', () => {
    const signal = buildMaintenanceFollowUpSignal(
      [request({ id: 'fresh', request_date: '2026-08-25' })],
      TODAY,
    );

    expect(signal.actionableCount).toBe(0);
    expect(signal.oldestOpenAgeDays).toBe(2);
  });

  it('counts each attention class while counting distinct requests once', () => {
    const signal = buildMaintenanceFollowUpSignal(
      [
        request({ id: 'both', request_date: '2026-07-01', scheduled_date: '2026-08-01' }),
        request({ id: 'awaiting', status: 'resolved' }),
        request({ id: 'closed', status: 'closed', request_date: '2026-01-01' }),
      ],
      TODAY,
    );

    expect(signal.stalledCount).toBe(1);
    expect(signal.scheduleMissedCount).toBe(1);
    expect(signal.awaitingClosureCount).toBe(1);
    expect(signal.actionableCount).toBe(2);
    expect(signal.oldestOpenAgeDays).toBeGreaterThan(0);
  });

  it('does not rebuild maintenance presentation rows in the dashboard signal', () => {
    const signal = buildMaintenanceFollowUpSignal(
      [request({ id: 'stalled', request_date: '2026-07-01' })],
      TODAY,
    );

    expect('rows' in signal).toBe(false);
  });
});
