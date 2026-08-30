// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AuthorizationContext } from '@/features/auth/permissions';

let pathname = '/dashboard';

vi.mock('@/components/layout/permission-request-dialog', () => ({ PermissionRequestDialog: () => null }));
vi.mock('@/features/command-palette/command-palette-store', () => ({
  useCommandPaletteStore: () => ({ open: vi.fn(), isOpen: false }),
}));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authorization: { userId: 'admin-1', email: 'admin@malek.test', role: 'ADMIN' },
  }),
}));
vi.mock('./notifications-menu', () => ({
  NotificationsMenu: () => <button type="button" aria-label="الإشعارات">تنبيهات</button>,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    activeOptions: _activeOptions,
    search: _search,
    className,
    ...props
  }: {
    children: ReactNode;
    to: string;
    activeOptions?: unknown;
    search?: unknown;
    className?: string;
  } & Record<string, unknown>) => (
    <a href={to} className={className} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname, search: {} }),
}));

import { MobileFloatingControl, NavigationLinks } from './layout-navigation-view';

const admin: AuthorizationContext = {
  userId: 'admin-1',
  email: 'admin@malek.test',
  role: 'ADMIN',
};

const user: AuthorizationContext = {
  userId: 'user-1',
  email: 'user@malek.test',
  role: 'USER',
};

const sharedLabel = (key: string) => `label:${key}`;

function anchor(html: string, href: string) {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.querySelector<HTMLAnchorElement>(`a[href="${href}"]`);
}

describe('Visual Wave 1 — route-derived app navigation', () => {
  it('keeps owner detail work inside the Portfolio root', () => {
    pathname = '/owners/owner-42';

    const html = renderToStaticMarkup(
      <NavigationLinks authorization={admin} expanded sharedLabel={sharedLabel} />,
    );

    expect(anchor(html, '/properties')?.getAttribute('aria-current')).toBe('page');
    expect(anchor(html, '/contracts')?.getAttribute('aria-current')).toBeNull();
  });

  it('renders the balanced MALEK phone chrome: a minimal dock with Search and Quick Add in the header', () => {
    pathname = '/dashboard';
    const html = renderToStaticMarkup(<MobileFloatingControl onMenu={() => undefined} />);
    const host = document.createElement('div');
    host.innerHTML = html;

    const dock = host.querySelector('[data-mobile-floating-control]');
    expect(dock).not.toBeNull();
    // The dock stays minimal: menu, notifications and AI only. Search and
    // Quick Add live in the phone header (asserted by cross-device contract).
    expect(host.querySelector('[data-mobile-dock-menu]')).not.toBeNull();
    expect(host.querySelector('[data-mobile-dock-notifications]')).not.toBeNull();
    expect(host.querySelector('[data-mobile-dock-ai]')).not.toBeNull();
    expect(host.querySelector('[data-mobile-dock-search]')).toBeNull();
    expect(host.querySelector('[data-mobile-dock-quick-add]')).toBeNull();
    expect(host.querySelector('button[aria-label="فتح القائمة"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label="فتح المساعد الذكي"]')).not.toBeNull();
  });

  it('keeps the Settings shell reachable while locking unauthorized children', () => {
    pathname = '/dashboard';

    const html = renderToStaticMarkup(
      <NavigationLinks authorization={user} expanded sharedLabel={sharedLabel} />,
    );

    expect(anchor(html, '/settings')?.getAttribute('aria-disabled')).toBeNull();
    const host = document.createElement('div');
    host.innerHTML = html;
    expect(host.querySelectorAll('a[href="/settings"][aria-disabled="true"]').length).toBeGreaterThan(0);
  });
});
