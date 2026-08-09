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
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => queryKey[0] === 'app-notifications' ? persistedState : queryState,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: ({ mutationFn }: { mutationFn: (id: string) => Promise<unknown> }) => ({ mutate: (id: string) => { void mutationFn(id); }, isPending: false }),
}));

const markRead = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('./app-notifications-service', () => ({
  listAppNotifications: vi.fn(async () => []),
  markAppNotificationRead: markRead,
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
      arrears: { overdueInvoices: [{ id: 'invoice-1' }] },
      maintenance: { urgentRequests: [] },
      activeContracts: [],
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

  it('renders an unread permission request and marks it read on direct queue navigation', () => {
    persistedState.data = [{
      id: 'permission-1', title: 'طلب صلاحية جديد', message: 'مستخدم طلب عرض الأراضي',
      link: '/settings?section=users-permissions&sub=permission-requests', isRead: false,
      createdAt: '2026-08-09T00:00:00Z', type: 'permission_request',
    }];
    queryState.data = { arrears: { overdueInvoices: [] }, maintenance: { urgentRequests: [] }, activeContracts: [] };
    act(() => { root.render(<NotificationsMenu authorization={authorization} sharedLabel={sharedLabel} />); });
    expect(host.querySelector('button[aria-label="التنبيهات (1)"]')).toBeTruthy();
    open(host);
    expect(host.textContent).toContain('طلب صلاحية جديد');
    expect(host.textContent).toContain('مستخدم طلب عرض الأراضي');
    const link = host.querySelector<HTMLAnchorElement>('a[href="/settings?section=users-permissions&sub=permission-requests"]');
    act(() => { link?.click(); });
    expect(markRead).toHaveBeenCalledWith('permission-1');
  });

  it('keeps notification controls at the 44px touch-target contract', () => {
    queryState.data = {
      arrears: { overdueInvoices: [{ id: 'invoice-1' }] },
      maintenance: { urgentRequests: [] },
      activeContracts: [],
    };
    act(() => {
      root.render(<NotificationsMenu authorization={authorization} sharedLabel={sharedLabel} />);
    });

    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="التنبيهات (1)"]');
    expect(trigger?.className).toContain('size-11');
    open(host);
    expect(host.querySelector<HTMLAnchorElement>('a[href="/arrears"]')?.className).toContain('min-h-11');
  });
});
