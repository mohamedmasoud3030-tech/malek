// @vitest-environment happy-dom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthorizationContext } from '@/features/auth/permissions';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mockState = vi.hoisted(() => ({
  authorization: null as AuthorizationContext | null,
  logout: vi.fn(),
  setTheme: vi.fn(),
  setSyncStatus: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    activeOptions: _activeOptions,
    search: _search,
    ...props
  }: {
    children?: React.ReactNode;
    to: string;
    activeOptions?: unknown;
    search?: unknown;
  } & Record<string, unknown>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <div data-page-outlet>محتوى الصفحة</div>,
  useRouter: () => ({
    navigate: vi.fn(),
    state: { location: { pathname: '/properties' } },
  }),
  useMatches: () => [{ staticData: { title: 'العقارات' } }],
  useLocation: () => ({ pathname: '/properties', search: {} }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authorization: mockState.authorization,
    logout: mockState.logout,
    user: { email: 'employee@malek.test' },
  }),
}));
vi.mock('@/store/ui-store', () => ({
  useUiStore: () => ({
    theme: 'light',
    setTheme: mockState.setTheme,
    syncStatus: 'idle',
    setSyncStatus: mockState.setSyncStatus,
  }),
}));
vi.mock('./layout-navigation-view', () => ({
  NavigationLinks: () => <nav data-navigation-links />,
  MobileFloatingControl: ({ drawerOpen }: { drawerOpen?: boolean }) =>
    drawerOpen ? null : <div data-mobile-floating-control />,
}));
vi.mock('@/features/command-palette/command-palette-dialog', () => ({
  CommandPaletteDialog: () => null,
}));
vi.mock('@/features/ai-assistant/ai-assistant-global-action', () => ({
  AiAssistantGlobalAction: () => null,
}));

import { AppShell } from './app-shell';

describe('account permission status polish', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mockState.authorization = null;
    mockState.logout.mockClear();
    mockState.setTheme.mockClear();
    mockState.setSyncStatus.mockClear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  });

  function renderShell() {
    act(() => {
      root.render(<AppShell />);
    });
  }

  function openAccountMenu() {
    const trigger = host.querySelector<HTMLButtonElement>(
      'button[aria-haspopup="menu"]',
    );
    expect(trigger).not.toBeNull();
    act(() => {
      trigger?.click();
    });
    const menu = host.querySelector<HTMLElement>('[data-account-menu-panel]');
    expect(menu).not.toBeNull();
    return menu;
  }

  it('moves incomplete-permission guidance out of the repeated page banner and into the account menu', () => {
    renderShell();

    expect(host.querySelector('[data-write-access-notice]')).toBeNull();
    const trigger = host.querySelector<HTMLButtonElement>(
      'button[aria-haspopup="menu"]',
    );
    expect(trigger?.getAttribute('aria-label')).toContain(
      'صلاحيات الحساب تحتاج مراجعة',
    );
    expect(
      host.querySelector('[data-account-status-indicator]'),
    ).not.toBeNull();

    const menu = openAccountMenu();
    const status = menu?.querySelector<HTMLElement>(
      '[data-account-status-entry]',
    );
    expect(status).not.toBeNull();
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.textContent).toContain('صلاحيات الحساب تحتاج مراجعة');
    expect(status?.textContent).toContain('إرسال طلب صلاحية');
  });

  it('summarizes read-only access in the same account-status entry without adding page clutter', () => {
    mockState.authorization = {
      userId: 'viewer-1',
      email: 'viewer@malek.test',
      role: 'VIEWER',
      grantedPermissions: [],
      effectivePermissionsResolved: true,
    };

    renderShell();

    expect(host.querySelector('[data-write-access-notice]')).toBeNull();
    expect(
      host.querySelector('[data-account-status-indicator]'),
    ).not.toBeNull();

    const menu = openAccountMenu();
    const status = menu?.querySelector<HTMLElement>(
      '[data-account-status-entry]',
    );
    expect(status?.textContent).toContain('وضع العرض فقط');
    expect(status?.textContent).toContain('الإضافة، التعديل أو الاعتماد');
  });

  it('keeps fully authorized accounts free of permission-warning chrome', () => {
    mockState.authorization = {
      userId: 'admin-1',
      email: 'admin@malek.test',
      role: 'ADMIN',
      grantedPermissions: [],
      effectivePermissionsResolved: true,
    };

    renderShell();

    expect(host.querySelector('[data-write-access-notice]')).toBeNull();
    expect(host.querySelector('[data-account-status-indicator]')).toBeNull();

    const menu = openAccountMenu();
    expect(menu?.querySelector('[data-account-status-entry]')).toBeNull();
  });
});
