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

/**
 * WP-06 / GAP-020 regression — updated for the bottom-sheet navigation.
 *
 * The mobile navigation is a bottom sheet opened from the floating control
 * center button (not a Radix <DialogTrigger>), so Radix's internal triggerRef
 * is null and its default close-autofocus drops focus onto <body>. AppShell
 * owns the trigger ref (on the bottom launcher) and restores focus explicitly.
 */
describe('AppShell mobile bottom-sheet nav — scroll lock and focus restoration', () => {
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
    // Menu moved to top toolbar, bottom dock no longer has menu to avoid duplicate
    const trigger = host.querySelector<HTMLButtonElement>('[data-mobile-top-menu]') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    return trigger;
  }

  function getSheet() {
    return document.querySelector<HTMLElement>('[data-mobile-nav-sheet]');
  }

  it('opens a bottom-sheet navigation (not a full-height drawer), locks scroll, and exposes aria-modal', () => {
    act(() => { root.render(<AppShell />); });

    expect(document.body.style.overflow).not.toBe('hidden');
    const trigger = getTrigger();
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');

    act(() => { trigger.click(); });

    const sheet = getSheet();
    expect(sheet).not.toBeNull();
    expect(sheet?.getAttribute('role')).toBe('dialog');
    expect(sheet?.getAttribute('aria-modal')).toBe('true');
    // Bottom-sheet shape: anchored to the bottom, not full height.
    expect(sheet?.className).toContain('bottom-0');
    expect(sheet?.className).toContain('rounded-t-2xl');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('restores focus to the bottom launcher and unlocks scroll when the sheet closes', () => {
    act(() => { root.render(<AppShell />); });

    const trigger = getTrigger();
    act(() => { trigger.focus(); });
    expect(document.activeElement).toBe(trigger);

    act(() => { trigger.click(); });
    expect(getSheet()).not.toBeNull();

    const closeButton = getSheet()?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق القائمة"]');
    expect(closeButton).not.toBeNull();

    act(() => { closeButton?.click(); });

    expect(getSheet()).toBeNull();
    // Focus must return to the control that opened the overlay, not <body>.
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(document.documentElement.style.overflow).not.toBe('hidden');
  });
});
