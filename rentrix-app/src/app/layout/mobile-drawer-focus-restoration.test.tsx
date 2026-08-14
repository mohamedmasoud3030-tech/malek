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

/**
 * WP-06 / GAP-020 regression.
 *
 * The mobile navigation drawer is opened from a plain header button rather
 * than a Radix <DialogTrigger>, so Radix's internal triggerRef is null and its
 * default close-autofocus handler dropped focus onto <body>. That violates
 * WCAG 2.4.3 (focus order) and was caught by the Browser Readiness
 * chromium-desktop shard. AppShell now owns the trigger ref and restores focus
 * explicitly; these tests lock both the scroll lock and the focus contract.
 */
describe('AppShell mobile drawer — scroll lock and focus restoration', () => {
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

  function getTrigger() {
    const trigger = host.querySelector<HTMLButtonElement>('[data-mobile-menu-trigger]');
    expect(trigger).not.toBeNull();
    return trigger as HTMLButtonElement;
  }

  function getDrawer() {
    return document.querySelector<HTMLElement>('[data-mobile-drawer]');
  }

  it('opens a real modal drawer, locks body and html scroll, and exposes aria-modal', () => {
    act(() => { root.render(<AppShell />); });

    expect(document.body.style.overflow).not.toBe('hidden');
    const trigger = getTrigger();
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');

    act(() => { trigger.click(); });

    const drawer = getDrawer();
    expect(drawer).not.toBeNull();
    expect(drawer?.getAttribute('role')).toBe('dialog');
    expect(drawer?.getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('restores focus to the header trigger and unlocks scroll when the drawer closes', () => {
    act(() => { root.render(<AppShell />); });

    const trigger = getTrigger();
    act(() => { trigger.focus(); });
    expect(document.activeElement).toBe(trigger);

    act(() => { trigger.click(); });
    expect(getDrawer()).not.toBeNull();

    const closeButton = getDrawer()?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق القائمة"]');
    expect(closeButton).not.toBeNull();

    act(() => { closeButton?.click(); });

    expect(getDrawer()).toBeNull();
    // Focus must return to the control that opened the overlay, not <body>.
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(document.documentElement.style.overflow).not.toBe('hidden');
  });
});
