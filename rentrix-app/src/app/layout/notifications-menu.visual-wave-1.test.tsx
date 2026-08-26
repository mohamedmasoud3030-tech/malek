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

const persistedState = vi.hoisted(() => ({ data: [] as unknown[], isLoading: false, isError: false, refetch: vi.fn() }));
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
    queryState.isError = true;
    act(() => {
      root.render(<NotificationsMenu authorization={authorization} sharedLabel={sharedLabel} />);
    });

    open(host);
    expect(host.textContent).toContain('تعذر تحميل التنبيهات');
    expect(host.textContent).not.toContain('لا توجد تنبيهات جديدة');

    const retry = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('إعادة المحاولة'));
    act(() => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(queryState.refetch).toHaveBeenCalledOnce();
  });

  it('keeps focus management and trigger toggling reliable for a real notification link', () => {
    queryState.data = {
      arrears: { overdueCount: 1 },
      maintenance: { urgentOpen: 0 },
      contracts: { expiring30: 0 },
    };
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

  it('renders pending permission requests as a distinct actionable group, not an ordinary notification', () => {
    requestsState.data = [{
      id: 'permission-1', requester_user_id: 'user-1', requester_name: 'أحمد السالمي',
      requester_email: 'ahmed@malek.test', permission: 'lands.view', resource_route: '/lands',
      reason: 'لإدارة سجل الأراضي', status: 'PENDING', reviewer_user_id: null,
      decided_at: null, decision_reason: null, created_at: '2026-08-09T00:00:00Z',
    }];
    persistedState.data = [];
    queryState.data = { arrears: { overdueCount: 0 }, maintenance: { urgentOpen: 0 }, contracts: { expiring30: 0 } };
    act(() => { root.render(<NotificationsMenu authorization={authorization} sharedLabel={sharedLabel} />); });
    // The pending request must be reflected in the bell count.
    expect(host.querySelector('button[aria-label="التنبيهات (1)"]')).toBeTruthy();
    open(host);
    // Distinct group communicates "this requires action" without exposing
    // requester identity or free-text reason in the notification preview.
    expect(host.textContent).toContain('طلبات تحتاج إجراء (1)');
    expect(host.textContent).toContain('طلب صلاحية جديد');
    expect(host.textContent).not.toContain('أحمد السالمي');
    expect(host.textContent).not.toContain('لإدارة سجل الأراضي');
    expect(host.textContent).toContain('عرض الأراضي');
    expect(host.textContent).toContain('قيد المراجعة');
    expect(host.querySelector('[data-permission-requests-need-action]')).not.toBeNull();
    const cta = host.querySelector<HTMLAnchorElement>('a[href="/settings"]');
    expect(cta).not.toBeNull();
  });

  it('keeps historical permission decisions in the ordinary feed and marks them read on navigation', () => {
    persistedState.data = [{
      id: 'decision-1', title: 'تم اعتماد طلب الصلاحية', message: 'تم منح عرض الأراضي',
      link: '/settings?section=users-permissions', isRead: false,
      createdAt: '2026-08-09T00:00:00Z', type: 'permission_decision',
    }];
    requestsState.data = [];
    queryState.data = { arrears: { overdueCount: 0 }, maintenance: { urgentOpen: 0 }, contracts: { expiring30: 0 } };
    act(() => { root.render(<NotificationsMenu authorization={authorization} sharedLabel={sharedLabel} />); });
    open(host);
    expect(host.textContent).toContain('تم اعتماد طلب الصلاحية');
    const link = host.querySelector<HTMLAnchorElement>('a[href="/settings?section=users-permissions"]');
    act(() => { link?.click(); });
    expect(markRead).toHaveBeenCalledWith('decision-1');
  });

  it('keeps notification controls at the compact touch-target contract', () => {
    queryState.data = {
      arrears: { overdueCount: 1 },
      maintenance: { urgentOpen: 0 },
      contracts: { expiring30: 0 },
    };
    act(() => {
      root.render(<NotificationsMenu authorization={authorization} sharedLabel={sharedLabel} />);
    });

    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="التنبيهات (1)"]');
    expect(trigger?.className).toMatch(/size-(10|11)/);
    open(host);
    expect(host.querySelector<HTMLAnchorElement>('a[href="/arrears"]')?.className).toMatch(/min-h-(10|11)/);
  });
});
