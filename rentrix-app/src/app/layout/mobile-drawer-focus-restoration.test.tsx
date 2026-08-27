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
  useLocation: () => ({ pathname: '/dashboard', search: {} }),
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
    setSyncStatus: vi.fn(),
  }),
}));
vi.mock('./notifications-menu', () => ({ NotificationsMenu: () => null }));
vi.mock('@/features/command-palette/command-palette-trigger', () => ({ CommandPaletteTrigger: () => null }));
vi.mock('@/features/command-palette/command-palette-dialog', () => ({ CommandPaletteDialog: () => null }));
vi.mock('@/features/ai-assistant/ai-assistant-global-action', () => ({ AiAssistantGlobalAction: () => null }));

import { AppShell } from './app-shell';

describe('AppShell mobile navigation drawer — scroll lock, RTL placement, and focus restoration', () => {
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
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  });

  function getMonogramTrigger() {
    const trigger = host.querySelector<HTMLButtonElement>('[data-header-brand-monogram]') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    return trigger;
  }

  function getDockMenuTrigger() {
    const trigger = host.querySelector<HTMLButtonElement>('[data-mobile-dock-menu]') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    return trigger;
  }

  function getDrawer() {
    return document.querySelector<HTMLElement>('[data-mobile-drawer]');
  }

  it('opens a full-height right-side RTL drawer from the M monogram, locks scroll, and exposes aria-modal', () => {
    act(() => { root.render(<AppShell />); });

    expect(document.body.style.overflow).not.toBe('hidden');
    const trigger = getMonogramTrigger();
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');

    act(() => { trigger.click(); });

    const drawer = getDrawer();
    expect(drawer).not.toBeNull();
    expect(drawer?.getAttribute('role')).toBe('dialog');
    expect(drawer?.getAttribute('aria-modal')).toBe('true');

    // Right-side RTL drawer shape: anchored right, full viewport height
    expect(drawer?.className).toContain('right-0');
    expect(drawer?.className).toContain('left-auto');
    expect(drawer?.className).toContain('h-dvh');
    expect(drawer?.className).toContain('w-[85vw]');

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('opens the same primary navigation drawer from the bottom dock hamburger', () => {
    act(() => { root.render(<AppShell />); });

    const dockTrigger = getDockMenuTrigger();
    expect(dockTrigger).not.toBeNull();

    act(() => { dockTrigger.click(); });

    const drawer = getDrawer();
    expect(drawer).not.toBeNull();

    // Floating bar is hidden while drawer is open
    const floatingBar = host.querySelector('[data-mobile-floating-control]');
    expect(floatingBar).toBeNull();

    const closeButton = drawer?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق القائمة"]');
    act(() => { closeButton?.click(); });

    expect(getDrawer()).toBeNull();
    // Floating bar reappears after close
    expect(host.querySelector('[data-mobile-floating-control]')).not.toBeNull();
  });

  it('restores focus to the opener and unlocks scroll when the drawer closes', () => {
    act(() => { root.render(<AppShell />); });

    const trigger = getMonogramTrigger();
    act(() => { trigger.focus(); });
    expect(document.activeElement).toBe(trigger);

    act(() => { trigger.click(); });
    expect(getDrawer()).not.toBeNull();

    const closeButton = getDrawer()?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق القائمة"]');
    expect(closeButton).not.toBeNull();

    act(() => { closeButton?.click(); });

    expect(getDrawer()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(document.documentElement.style.overflow).not.toBe('hidden');
  });
});
