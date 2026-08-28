/**
 * P3 — Today must show maintenance that stopped moving, not only maintenance
 * that was *reported* as urgent. The signal reuses the Services derivation so
 * the two surfaces can never disagree.
 */
import { describe, expect, it } from 'vitest';
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import {
  buildMaintenanceFollowUpSignal,
  EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL,
  MAINTENANCE_FOLLOW_UP_ROW_LIMIT,
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

const properties = new Map([['property-1', 'برج الخليج']]);
const units = new Map([['unit-1', '3']]);

describe('Today maintenance follow-up signal (P3)', () => {
  it('stays neutral when there is nothing to read', () => {
    expect(buildMaintenanceFollowUpSignal(undefined, TODAY)).toBe(EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL);
    expect(buildMaintenanceFollowUpSignal([], TODAY)).toBe(EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL);
  });

  it('shows no queue when every request is moving, while still reporting the oldest open age', () => {
    const signal = buildMaintenanceFollowUpSignal(
      [request({ id: 'fresh', request_date: '2026-08-25' })],
      TODAY,
    );

    expect(signal.rows).toEqual([]);
    expect(signal.actionableCount).toBe(0);
    expect(signal.oldestOpenAgeDays).toBe(2);
  });

  it('counts each attention queue and badges the distinct requests behind them', () => {
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
    // The request carrying two flags is one request to chase, not two.
    expect(signal.actionableCount).toBe(2);
  });

  it('ranks stopped work above paperwork, oldest first', () => {
    const signal = buildMaintenanceFollowUpSignal(
      [
        request({ id: 'awaiting', status: 'resolved' }),
        request({ id: 'stalled-recent', request_date: '2026-08-10' }),
        request({ id: 'stalled-old', request_date: '2026-07-01' }),
      ],
      TODAY,
    );

    expect(signal.rows.map((row) => row.requestId)).toEqual(['stalled-old', 'stalled-recent', 'awaiting']);
    expect(signal.rows[0].flagLabel).toBe('متوقفة عن التقدم');
    expect(signal.rows[2].flagLabel).toBe('بانتظار الإغلاق');
  });

  it('names the location in operator language and never prints a raw id', () => {
    const signal = buildMaintenanceFollowUpSignal(
      [
        request({ id: 'known', unit_id: 'unit-1', request_date: '2026-07-01' }),
        request({ id: 'unknown-property', property_id: 'property-missing', request_date: '2026-07-01' }),
      ],
      TODAY,
      properties,
      units,
    );

    const known = signal.rows.find((row) => row.requestId === 'known');
    const unknown = signal.rows.find((row) => row.requestId === 'unknown-property');
    expect(known?.location).toBe('برج الخليج · الوحدة 3');
    expect(unknown?.location).toBe('عقار غير محدد');
    expect(unknown?.location).not.toContain('property-missing');
  });

  it('falls back to operator language for a request with no title', () => {
    const signal = buildMaintenanceFollowUpSignal(
      [request({ id: 'blank', title: '   ', request_date: '2026-07-01' })],
      TODAY,
    );

    expect(signal.rows[0].title).toBe('طلب صيانة بلا عنوان');
  });

  it('bounds the presentation rows without capping the counts', () => {
    const many = Array.from({ length: 6 }, (_, index) =>
      request({ id: `stalled-${index}`, request_date: '2026-07-01' }),
    );

    const signal = buildMaintenanceFollowUpSignal(many, TODAY);

    expect(signal.rows).toHaveLength(MAINTENANCE_FOLLOW_UP_ROW_LIMIT);
    expect(signal.actionableCount).toBe(6);
  });
});
