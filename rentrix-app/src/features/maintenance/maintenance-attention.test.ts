import { describe, expect, it } from 'vitest';
import type { Maintenance } from './maintenance-service';
import {
  deriveMaintenanceAttention,
  matchesMaintenanceAttentionFilter,
  summarizeMaintenanceAttention,
  MAINTENANCE_STALLED_AFTER_DAYS,
} from './maintenance-attention';

const TODAY = '2026-08-27';

function request(overrides: Partial<Maintenance> & { id: string }): Maintenance {
  return {
    company_id: 'company-1',
    property_id: 'property-1',
    unit_id: null,
    title: 'تسرب مياه',
    description: null,
    priority: 'medium',
    status: 'open',
    request_date: TODAY,
    scheduled_date: null,
    created_at: `${TODAY}T00:00:00.000Z`,
    ...overrides,
  } as Maintenance;
}

describe('maintenance operational attention (P3)', () => {
  it('measures age from the business report date, falling back to created_at', () => {
    const withRequestDate = deriveMaintenanceAttention(
      request({ id: 'a', request_date: '2026-08-20', created_at: '2026-08-25T00:00:00.000Z' }),
      TODAY,
    );
    const createdOnly = deriveMaintenanceAttention(
      request({ id: 'b', request_date: null, created_at: '2026-08-25T00:00:00.000Z' }),
      TODAY,
    );

    expect(withRequestDate.ageDays).toBe(7);
    expect(createdOnly.ageDays).toBe(2);
  });

  it('does not guess an age when no usable date exists', () => {
    const attention = deriveMaintenanceAttention(request({ id: 'a', request_date: null, created_at: null }), TODAY);
    expect(attention.ageDays).toBeNull();
    expect(attention.isStalled).toBe(false);
  });

  it('flags unfinished work only after the stalled window', () => {
    const inside = deriveMaintenanceAttention(request({ id: 'a', request_date: '2026-08-20' }), TODAY);
    const outside = deriveMaintenanceAttention(request({ id: 'b', request_date: '2026-08-19' }), TODAY);

    expect(MAINTENANCE_STALLED_AFTER_DAYS).toBe(7);
    expect(inside.isStalled).toBe(false);
    expect(outside.isStalled).toBe(true);
  });

  it('treats completed work that nobody closed as its own operational queue', () => {
    const resolved = deriveMaintenanceAttention(request({ id: 'a', status: 'resolved', request_date: TODAY }), TODAY);
    const closed = deriveMaintenanceAttention(request({ id: 'b', status: 'closed', request_date: '2026-01-01' }), TODAY);

    expect(resolved.isAwaitingClosure).toBe(true);
    expect(resolved.flags).toContain('awaiting_closure');
    // A closed request is finished: it never re-enters the attention queues.
    expect(closed.flags).toEqual([]);
    expect(closed.isStalled).toBe(false);
  });

  it('never marks finished work as stalled just because it is old', () => {
    const oldResolved = deriveMaintenanceAttention(request({ id: 'a', status: 'resolved', request_date: '2026-01-01' }), TODAY);
    expect(oldResolved.isStalled).toBe(false);
  });

  it('flags a missed scheduled visit only while the work is unfinished', () => {
    const missed = deriveMaintenanceAttention(request({ id: 'a', scheduled_date: '2026-08-24' }), TODAY);
    const upcoming = deriveMaintenanceAttention(request({ id: 'b', scheduled_date: '2026-09-04' }), TODAY);
    const missedButDone = deriveMaintenanceAttention(
      request({ id: 'c', scheduled_date: '2026-08-24', status: 'resolved' }),
      TODAY,
    );

    expect(missed.hasMissedSchedule).toBe(true);
    expect(upcoming.hasMissedSchedule).toBe(false);
    expect(missedButDone.hasMissedSchedule).toBe(false);
  });

  it('summarizes attention without double counting a request that carries two flags', () => {
    const summary = summarizeMaintenanceAttention(
      [
        request({ id: 'stalled-and-missed', request_date: '2026-08-01', scheduled_date: '2026-08-10' }),
        request({ id: 'awaiting', status: 'resolved' }),
        request({ id: 'healthy', request_date: '2026-08-26' }),
        request({ id: 'closed', status: 'closed', request_date: '2026-01-01' }),
      ],
      TODAY,
    );

    expect(summary.stalled).toBe(1);
    expect(summary.scheduleMissed).toBe(1);
    expect(summary.awaitingClosure).toBe(1);
    expect(summary.needingAttention).toBe(2);
    expect(summary.oldestOpenAgeDays).toBe(26);
  });

  it('filters rows by a single attention flag', () => {
    const stalled = deriveMaintenanceAttention(request({ id: 'a', request_date: '2026-08-01' }), TODAY);
    const awaiting = deriveMaintenanceAttention(request({ id: 'b', status: 'resolved' }), TODAY);

    expect(matchesMaintenanceAttentionFilter(stalled, 'all')).toBe(true);
    expect(matchesMaintenanceAttentionFilter(stalled, 'stalled')).toBe(true);
    expect(matchesMaintenanceAttentionFilter(stalled, 'awaiting_closure')).toBe(false);
    expect(matchesMaintenanceAttentionFilter(awaiting, 'awaiting_closure')).toBe(true);
  });
});
