import { describe, expect, it } from 'vitest';
import { sanitizeNotificationLink, sanitizeNotificationPreview } from './app-notifications-service';
import { buildNotificationItems } from './notifications-menu';

describe('buildNotificationItems', () => {
  it('returns an empty feed when there is nothing to alert about', () => {
    expect(buildNotificationItems(null)).toEqual([]);
    expect(buildNotificationItems({
      arrears: { overdueCount: 0 },
      contracts: { expiring30: 0 },
      maintenance: { urgentOpen: 0 },
    })).toEqual([]);
  });

  it('uses the server-authoritative snapshot counts without client-side derivation', () => {
    const items = buildNotificationItems({
      arrears: { overdueCount: 3 },
      contracts: { expiring30: 2 },
      maintenance: { urgentOpen: 1 },
    });

    expect(items.map((item) => [item.to, item.count])).toEqual([
      ['/arrears', 3],
      ['/contracts', 2],
      ['/maintenance', 1],
    ]);
  });

  it('sanitizes persisted lock-screen-style copy and deep links', () => {
    expect(sanitizeNotificationPreview('token abc', 'تحديث آمن', 120)).toBe('تحديث آمن');
    expect(sanitizeNotificationPreview('اتصل على 99112233', 'تحديث آمن', 120)).toBe('تحديث آمن');
    expect(sanitizeNotificationPreview('طلب يحتاج مراجعة', 'تحديث آمن', 120)).toBe('طلب يحتاج مراجعة');
    expect(sanitizeNotificationLink('/contracts/00000000-0000-0000-0000-000000000123')).toBe('/dashboard');
    expect(sanitizeNotificationLink('https://evil.example')).toBe('/dashboard');
    expect(sanitizeNotificationLink('/reset-password?token=expired-secret')).toBe('/dashboard');
    expect(sanitizeNotificationLink('/settings?section=users-permissions')).toBe('/settings?section=users-permissions');
  });

  it('attaches the route-guard permissions so the menu can mirror navigation visibility', () => {
    const items = buildNotificationItems({
      arrears: { overdueCount: 1 },
      contracts: { expiring30: 1 },
      maintenance: { urgentOpen: 1 },
    });

    const permissionByRoute = Object.fromEntries(items.map((item) => [item.to, item.permission]));
    expect(permissionByRoute['/arrears']).toBe('arrears.view');
    expect(permissionByRoute['/maintenance']).toBe('maintenance.view');
    expect(permissionByRoute['/contracts']).toBeUndefined();
  });
});
