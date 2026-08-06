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

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => queryState,
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
