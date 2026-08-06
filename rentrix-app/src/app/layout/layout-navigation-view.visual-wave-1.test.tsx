// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AuthorizationContext } from '@/features/auth/permissions';

let pathname = '/dashboard';

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
  useLocation: () => ({ pathname }),
}));

import { MobileBottomNav, NavigationLinks } from './layout-navigation-view';

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
  it('marks the portfolio root as current on an owner detail route', () => {
    pathname = '/owners/owner-42';

    const html = renderToStaticMarkup(
      <NavigationLinks authorization={admin} expanded sharedLabel={sharedLabel} />,
    );

    expect(anchor(html, '/properties')?.getAttribute('aria-current')).toBe('page');
    expect(anchor(html, '/contracts')?.getAttribute('aria-current')).toBeNull();
  });

  it('marks exactly the finance hub current for a finance child route in bottom navigation', () => {
    pathname = '/finance/collections';

    const html = renderToStaticMarkup(
      <MobileBottomNav authorization={admin} sharedLabel={sharedLabel} />,
    );
    const host = document.createElement('div');
    host.innerHTML = html;

    const activeLinks = Array.from(host.querySelectorAll('a[aria-current="page"]'));
    expect(activeLinks).toHaveLength(1);
    expect(activeLinks[0]?.getAttribute('href')).toBe('/financials');
  });

  it('does not render the settings navigation root for a role without its route permission', () => {
    pathname = '/dashboard';

    const html = renderToStaticMarkup(
      <NavigationLinks authorization={user} expanded sharedLabel={sharedLabel} />,
    );

    expect(anchor(html, '/settings')).toBeNull();
  });
});
