import { describe, expect, it } from 'vitest';
import { sanitizeNotificationLink, sanitizeNotificationPreview } from './app-notifications-service';
import { isBellEventNotification } from './notifications-menu';

describe('notification event feed', () => {
  it('keeps completed events in the bell', () => {
    expect(isBellEventNotification({ type: 'payment_recorded' })).toBe(true);
    expect(isBellEventNotification({ type: 'maintenance_updated' })).toBe(true);
    expect(isBellEventNotification({ type: 'permission_decision' })).toBe(true);
    expect(isBellEventNotification({ type: null })).toBe(true);
  });

  it('keeps pending action requests out of the bell', () => {
    expect(isBellEventNotification({ type: 'permission_request' })).toBe(false);
  });

  it('sanitizes persisted lock-screen-style copy and deep links', () => {
    expect(sanitizeNotificationPreview('token abc', 'تحديث آمن', 120)).toBe('تحديث آمن');
    expect(sanitizeNotificationPreview('اتصل على 99112233', 'تحديث آمن', 120)).toBe('تحديث آمن');
    expect(sanitizeNotificationPreview('تم تسجيل دفعة', 'تحديث آمن', 120)).toBe('تم تسجيل دفعة');
    expect(sanitizeNotificationLink('/contracts/00000000-0000-0000-0000-000000000123')).toBe('/dashboard');
    expect(sanitizeNotificationLink('https://evil.example')).toBe('/dashboard');
    expect(sanitizeNotificationLink('/reset-password?token=expired-secret')).toBe('/dashboard');
    expect(sanitizeNotificationLink('/settings?section=users-permissions')).toBe('/settings?section=users-permissions');
  });
});
