// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { AuthorizationContext } from '@/features/auth/permissions';

vi.mock('@/components/layout/permission-request-dialog', () => ({ PermissionRequestDialog: () => null }));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ logout: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, activeOptions: _activeOptions, ...props }: { children: ReactNode; to: string; activeOptions?: unknown } & Record<string, unknown>) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/properties', search: {} }),
}));

import { NavigationLinks } from './layout-navigation-view';

const authorization: AuthorizationContext = {
  userId: 'manager-1',
  email: 'manager@malek.test',
  role: 'MANAGER',
};

const sharedLabel = (key: string) => `label:${key}`;

describe('Visual Wave 1 — drawer navigation interaction', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('exposes real collapsible task workspaces with native keyboard buttons and aria-expanded', () => {
    act(() => {
      root.render(<NavigationLinks authorization={authorization} expanded sharedLabel={sharedLabel} />);
    });
    const toggle = host.querySelector<HTMLButtonElement>('button[aria-label="طي المحفظة"]');
    expect(toggle?.tagName).toBe('BUTTON');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    const controlledId = toggle?.getAttribute('aria-controls');
    expect(controlledId).toBeTruthy();
    expect(host.querySelector(`#${controlledId}`)?.hasAttribute('hidden')).toBe(false);
    act(() => { toggle?.click(); });
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector(`#${controlledId}`)?.hasAttribute('hidden')).toBe(true);
  });

  it('fires the drawer close callback after a real visible navigation destination is selected', () => {
    const onNavigate = vi.fn();
    act(() => {
      root.render(
        <NavigationLinks
          authorization={authorization}
          expanded
          sharedLabel={sharedLabel}
          onNavigate={onNavigate}
        />,
      );
    });

    const properties = host.querySelector<HTMLAnchorElement>('a[href="/properties"]');
    act(() => {
      properties?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onNavigate).toHaveBeenCalledOnce();
  });
});
