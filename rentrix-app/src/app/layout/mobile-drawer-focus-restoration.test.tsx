// @vitest-environment happy-dom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Each test mounts the full AppShell tree synchronously through act(). Under
// full-suite CPU contention (2-core CI pool next to the PGlite journey
// suites) that render can exceed Vitest's 5s default wall-clock budget even
// though the component itself is healthy. The assertions are deterministic
// and synchronous — the budget is raised only to remove that load-dependent
// cliff so the file behaves identically isolated and in the full suite.
vi.setConfig({ testTimeout: 30_000 });

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
  // app-shell reads the store through zustand selectors, so the mock must
  // apply the selector when one is passed.
  useUiStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      sidebarCollapsed: false,
      theme: 'light',
      toggleSidebar: vi.fn(),
      setTheme: vi.fn(),
      syncStatus: 'idle',
      lastSyncedAt: null,
      setSyncStatus: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));
vi.mock('./notifications-menu', () => ({ NotificationsMenu: () => null }));
vi.mock('@/features/command-palette/command-palette-dialog', () => ({ CommandPaletteDialog: () => null }));
vi.mock('@/features/command-palette/command-palette-store', () => ({
  useCommandPaletteStore: { getState: () => ({ open: vi.fn() }) },
}));
vi.mock('@/features/ai-assistant/ai-assistant-global-action', () => ({ AiAssistantGlobalAction: () => null }));

import { AppShell } from './app-shell';

describe('AppShell mobile navigation bottom sheet — scroll lock and focus restoration', () => {
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

  function getDockMenuTrigger() {
    const trigger = host.querySelector<HTMLButtonElement>('[data-mobile-dock-menu]');
    expect(trigger).not.toBeNull();
    return trigger as HTMLButtonElement;
  }

  function getTabletMenuTrigger() {
    const trigger = host.querySelector<HTMLButtonElement>('[data-header-menu-button]');
    expect(trigger).not.toBeNull();
    return trigger as HTMLButtonElement;
  }

  function getSheet() {
    return document.querySelector<HTMLElement>('[data-bottom-sheet]');
  }

  function getNavigationSurface() {
    return document.querySelector<HTMLElement>('[data-mobile-nav-bottom-sheet]');
  }

  it('opens the shared bottom-sheet navigation from the explicit dock Menu, locks scroll, and exposes modal semantics', () => {
    act(() => { root.render(<AppShell />); });

    expect(document.body.style.overflow).not.toBe('hidden');
    const trigger = getDockMenuTrigger();
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');

    act(() => { trigger.click(); });

    const sheet = getSheet();
    expect(sheet).not.toBeNull();
    expect(getNavigationSurface()).not.toBeNull();
    expect(sheet?.getAttribute('role')).toBe('dialog');
    expect(sheet?.getAttribute('aria-modal')).toBe('true');
    expect(sheet?.className).toContain('w-full');
    expect(sheet?.className).toContain('rounded-t-3xl');

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('opens the same primary navigation bottom sheet from the tablet header Menu control', () => {
    act(() => { root.render(<AppShell />); });

    const tabletTrigger = getTabletMenuTrigger();
    act(() => { tabletTrigger.click(); });

    expect(getSheet()).not.toBeNull();
    expect(getNavigationSurface()).not.toBeNull();

    // The utility dock is one authority trigger, not a competing layer over the open sheet.
    expect(host.querySelector('[data-mobile-floating-control]')).toBeNull();

    const closeButton = getSheet()?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق"]');
    expect(closeButton).not.toBeNull();
    act(() => { closeButton?.click(); });

    expect(getSheet()).toBeNull();
    expect(host.querySelector('[data-mobile-floating-control]')).not.toBeNull();
  });

  it('restores focus to the explicit Menu trigger and unlocks scroll when the bottom sheet closes', () => {
    act(() => { root.render(<AppShell />); });

    const trigger = getDockMenuTrigger();
    act(() => { trigger.focus(); });
    expect(document.activeElement).toBe(trigger);

    act(() => { trigger.click(); });
    expect(getSheet()).not.toBeNull();

    const closeButton = getSheet()?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق"]');
    expect(closeButton).not.toBeNull();
    act(() => { closeButton?.click(); });

    expect(getSheet()).toBeNull();
    // The dock remounts after close; focus must return to the (new) Menu trigger.
    const restored = host.querySelector<HTMLButtonElement>('[data-mobile-dock-menu]');
    expect(document.activeElement).toBe(restored);
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(document.documentElement.style.overflow).not.toBe('hidden');
  });

  it('closes on Escape through the shared BottomSheet keyboard contract', () => {
    act(() => { root.render(<AppShell />); });
    const trigger = getDockMenuTrigger();
    act(() => { trigger.focus(); trigger.click(); });
    expect(getSheet()).not.toBeNull();

    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });

    expect(getSheet()).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
  });
});
