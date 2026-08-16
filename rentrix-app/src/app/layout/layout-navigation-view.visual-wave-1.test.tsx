// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AuthorizationContext } from '@/features/auth/permissions';

let pathname = '/dashboard';

vi.mock('@/components/layout/permission-request-dialog', () => ({ PermissionRequestDialog: () => null }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    activeOptions: _activeOptions,
    className,
    ...props
  }: {
    children: ReactNode;
    to: string;
    activeOptions?: unknown;
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

  it('renders only Menu and Search in the mobile floating control', () => {
    const html = renderToStaticMarkup(<MobileFloatingControl onMenu={() => undefined} />);
    const host = document.createElement('div');
    host.innerHTML = html;

    expect(host.querySelector('[data-mobile-floating-control]')).not.toBeNull();
    expect(host.querySelectorAll('button')).toHaveLength(2);
    expect(host.querySelectorAll('a')).toHaveLength(0);
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
