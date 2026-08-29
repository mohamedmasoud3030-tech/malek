// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// React 19 requires an explicit act-capable test environment.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { AuthorizationContext } from '@/features/auth/permissions';

const queryState = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}));

const persistedState = vi.hoisted(() => ({ data: [] as unknown[] | undefined, isLoading: false, isError: false, refetch: vi.fn() }));
const requestsState = vi.hoisted(() => ({ data: [] as unknown[], isLoading: false, isError: false, refetch: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => queryKey[0] === 'app-notifications' ? persistedState : queryKey[0] === 'permission-requests' ? requestsState : queryState,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: ({ mutationFn }: { mutationFn: (id: string) => Promise<unknown> }) => ({ mutate: (id: string) => { void mutationFn(id); }, isPending: false }),
}));

const markRead = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('./app-notifications-service', () => ({
  listAppNotifications: vi.fn(async () => []),
  markAppNotificationRead: markRead,
}));

vi.mock('@/features/auth/permission-request-service', () => ({
  listPermissionRequestsForReview: vi.fn(async () => []),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string } & Record<string, unknown>) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

import { NotificationsMenu } from './notifications-menu';

const authorization: AuthorizationContext = {
  userId: 'admin-1',
  email: 'admin@malek.test',
  role: 'ADMIN',
};

const sharedLabel = (key: string) => ({
  notifications: 'التنبيهات',
  notificationsNone: 'لا توجد تنبيهات جديدة',
  notificationsHint: 'سيظهر هنا ما يحتاج إلى متابعة.',
  notifOverdueInvoices: 'فواتير متأخرة',
  notifExpiringContracts: 'عقود قاربت على الانتهاء',
  notifUrgentMaintenance: 'صيانة عاجلة',
}[key] ?? key);

function open(host: HTMLElement) {
  const trigger = host.querySelector<HTMLButtonElement>('button[aria-label^="التنبيهات"]');
  act(() => {
    trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return trigger;
}

describe('Visual Wave 1 — app-shell notification states', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    queryState.data = undefined;
    queryState.isLoading = false;
    queryState.isError = false;
    queryState.refetch.mockReset();
    persistedState.data = [];
    persistedState.isLoading = false;
    persistedState.isError = false;
    persistedState.refetch.mockReset();
    requestsState.data = [];
    requestsState.isLoading = false;
    requestsState.isError = false;
    requestsState.refetch.mockReset();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('does not misrepresent a request failure as an empty notification queue and exposes retry', () => {
    // The bell feed is the app-notifications query; a failed read with no
    // cached rows must surface the retryable error state, never the empty copy.
    persistedState.isError = true;
    persistedState.data = undefined;
    act(() => {
      root.render(<NotificationsMenu authorization={authorization} sharedLabel={sharedLabel} />);
    });

    open(host);
    expect(host.textContent).toContain('تعذر تحميل التنبيهات');
    expect(host.textContent).not.toContain('لا توجد أحداث جديدة حالياً');

    const retry = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('إعادة المحاولة'));
    act(() => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(persistedState.refetch).toHaveBeenCalledOnce();
  });

  it('keeps focus management and trigger toggling reliable for a real notification link', () => {
    persistedState.data = [{
      id: 'notif-1', title: 'فاتورة متأخرة', message: 'فاتورة تحتاج متابعة تحصيل',
      link: '/arrears', isRead: false, createdAt: '2026-08-29T00:00:00Z', type: 'invoice_overdue',
    }];
    act(() => {
      root.render(<NotificationsMenu authorization={authorization} sharedLabel={sharedLabel} />);
    });

    const trigger = open(host);
    const notification = host.querySelector<HTMLAnchorElement>('a[href="/arrears"]');
    expect(document.activeElement).toBe(notification);

    act(() => {
      trigger?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    open(host);
    const panel = host.querySelector<HTMLElement>('[role="dialog"]');
    act(() => {
      panel?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps permission requests out of the ordinary bell feed (they are reviewed in the governance hub)', () => {
    // Permission request review moved to the governance hub workspace. The
    // bell is an event feed only: request rows never inflate its count and
    // requester identity or free-text reasons never reach the shell.
    persistedState.data = [{
      id: 'request-feed-1', title: 'طلب صلاحية', message: 'طلب صلاحية أراضٍ',
      link: '/settings?section=users-permissions', isRead: false,
      createdAt: '2026-08-09T00:00:00Z', type: 'permission_request',
    }];
    act(() => { root.render(<NotificationsMenu authorization={authorization} sharedLabel={sharedLabel} />); });
    expect(host.querySelector('button[aria-label="التنبيهات (1)"]')).toBeNull();
    open(host);
    expect(host.textContent).toContain('لا توجد أحداث جديدة حالياً');
    expect(host.textContent).not.toContain('أحمد السالمي');
    expect(host.textContent).not.toContain('لإدارة سجل الأراضي');
  });

  it('keeps historical permission decisions in the ordinary feed and marks them read on navigation', () => {
    persistedState.data = [{
      id: 'decision-1', title: 'تم اعتماد طلب الصلاحية', message: 'تم منح عرض الأراضي',
      link: '/settings?section=users-permissions', isRead: false,
      createdAt: '2026-08-09T00:00:00Z', type: 'permission_decision',
    }];
    act(() => { root.render(<NotificationsMenu authorization={authorization} sharedLabel={sharedLabel} />); });
    open(host);
    expect(host.textContent).toContain('تم اعتماد طلب الصلاحية');
    const link = host.querySelector<HTMLAnchorElement>('a[href="/settings?section=users-permissions"]');
    act(() => { link?.click(); });
    expect(markRead).toHaveBeenCalledWith('decision-1');
  });

  it('keeps notification controls at the compact touch-target contract', () => {
    persistedState.data = [{
      id: 'notif-1', title: 'فاتورة متأخرة', message: 'فاتورة تحتاج متابعة تحصيل',
      link: '/arrears', isRead: false, createdAt: '2026-08-29T00:00:00Z', type: 'invoice_overdue',
    }];
    act(() => {
      root.render(<NotificationsMenu authorization={authorization} sharedLabel={sharedLabel} />);
    });

    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="التنبيهات (1)"]');
    expect(trigger?.className).toMatch(/size-(10|11)/);
    open(host);
    expect(host.querySelector<HTMLAnchorElement>('a[href="/arrears"]')?.className).toMatch(/min-h-(10|11)/);
  });
});
