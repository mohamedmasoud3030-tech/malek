import { describe, expect, it } from 'vitest';
import { buildNotificationItems } from './notifications-menu';

const today = new Date('2026-07-22T12:00:00');

describe('buildNotificationItems', () => {
  it('returns an empty feed when there is nothing to alert about', () => {
    expect(buildNotificationItems(null, today)).toEqual([]);
    expect(buildNotificationItems({
      arrears: { overdueInvoices: [] },
      maintenance: { urgentRequests: [] },
      activeContracts: [{ end_date: '2026-12-31' }],
    }, today)).toEqual([]);
  });

  it('counts overdue invoices, contracts expiring within 30 days, and urgent maintenance', () => {
    const items = buildNotificationItems({
      arrears: { overdueInvoices: [{ id: '1' }, { id: '2' }, { id: '3' }] },
      maintenance: { urgentRequests: [{ id: 'm1' }] },
      activeContracts: [
        { end_date: '2026-08-01' }, // within 30 days
        { end_date: '2026-07-22' }, // ends today — still counts
        { end_date: '2026-09-30' }, // too far out
        { end_date: '2026-07-10' }, // already ended
        { end_date: null },
      ],
    }, today);

    expect(items.map((item) => [item.to, item.count])).toEqual([
      ['/arrears', 3],
      ['/contracts', 2],
      ['/maintenance', 1],
    ]);
  });

  it('attaches the route-guard permissions so the menu can mirror navigation visibility', () => {
    const items = buildNotificationItems({
      arrears: { overdueInvoices: [{ id: '1' }] },
      maintenance: { urgentRequests: [{ id: 'm1' }] },
      activeContracts: [{ end_date: '2026-07-25' }],
    }, today);

    const permissionByRoute = Object.fromEntries(items.map((item) => [item.to, item.permission]));
    expect(permissionByRoute['/arrears']).toBe('arrears.view');
    expect(permissionByRoute['/maintenance']).toBe('maintenance.view');
    expect(permissionByRoute['/contracts']).toBeUndefined();
  });
});
