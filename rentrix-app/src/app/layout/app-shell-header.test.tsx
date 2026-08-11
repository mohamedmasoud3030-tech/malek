// @vitest-environment happy-dom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children?: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  Outlet: () => null,
  useRouter: () => ({ navigate: vi.fn() }),
  useMatches: () => [{ staticData: { title: 'العقارات' } }],
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authorization: { userId: 'admin-1', email: 'admin@malek.test', role: 'ADMIN' },
    logout: vi.fn(),
    user: { email: 'admin@malek.test' },
  }),
}));
vi.mock('@/store/ui-store', () => ({
  useUiStore: () => ({
    sidebarCollapsed: false,
    theme: 'light',
    toggleSidebar: vi.fn(),
    setTheme: vi.fn(),
    syncStatus: 'idle',
    lastSyncedAt: null,
  }),
}));
vi.mock('./layout-navigation-view', () => ({
  NavigationLinks: () => null,
  MobileFloatingControl: () => null,
}));
vi.mock('./notifications-menu', () => ({ NotificationsMenu: () => null }));
vi.mock('@/features/command-palette/command-palette-trigger', () => ({ CommandPaletteTrigger: () => null }));
vi.mock('@/features/command-palette/command-palette-dialog', () => ({ CommandPaletteDialog: () => null }));
vi.mock('@/features/ai-assistant/ai-assistant-global-action', () => ({ AiAssistantGlobalAction: () => null }));

import { AppShell } from './app-shell';

describe('AppShell — fixed global MALEK header', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    document.title = '';
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('shows the fixed MALEK brand in the global header instead of the dynamic page name', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    expect(header).not.toBeNull();

    const brandLockup = header?.querySelector('[data-malek-brand-lockup]');
    expect(brandLockup).not.toBeNull();
    expect(brandLockup?.textContent).toContain('MALEK');

    // The dynamic page name (route title) must not appear in the global header.
    expect(header?.textContent).not.toContain('العقارات');
  });

  it('keeps the page title only for the document title and inside page content', () => {
    act(() => { root.render(<AppShell />); });
    // Document-title behavior is preserved: `<pageTitle> | MALEK`.
    expect(document.title).toContain('العقارات');
    expect(document.title).toContain('MALEK');
  });

  it('renders the brand lockup on both the desktop header and the sidebar', () => {
    act(() => { root.render(<AppShell />); });
    // Sidebar + mobile drawer + global header all carry the fixed brand.
    expect(host.querySelectorAll('[data-malek-brand-lockup]').length).toBeGreaterThanOrEqual(2);
  });
});
