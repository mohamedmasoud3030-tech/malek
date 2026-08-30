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
const setSyncStatusSpy = vi.fn();
let mockSyncStatus: 'idle' | 'offline' = 'idle';
vi.mock('@/store/ui-store', () => ({
  // app-shell reads the store through zustand selectors, so the mock must
  // apply the selector when one is passed.
  useUiStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      sidebarCollapsed: false,
      theme: 'light',
      toggleSidebar: vi.fn(),
      setTheme: vi.fn(),
      syncStatus: mockSyncStatus,
      lastSyncedAt: null,
      setSyncStatus: setSyncStatusSpy,
    };
    return selector ? selector(state) : state;
  },
}));
vi.mock('./layout-navigation-view', () => ({
  NavigationLinks: () => null,
  MobileFloatingControl: ({ drawerOpen, onMenu }: { drawerOpen?: boolean; onMenu?: () => void }) => (
    drawerOpen ? null : (
      <div data-mobile-floating-control>
        <button type="button" aria-label="فتح القائمة" data-mobile-dock-menu onClick={onMenu} />
        <button type="button" aria-label="البحث السريع للنظام والكيانات" data-mobile-dock-search />
        <button type="button" aria-label="الإضافة السريعة" data-mobile-dock-quick-add />
        <button type="button" aria-label="الإشعارات" data-mobile-dock-notifications />
        <button type="button" aria-label="فتح المساعد الذكي" data-mobile-dock-ai />
      </div>
    )
  ),
}));
vi.mock('./notifications-menu', () => ({ NotificationsMenu: () => null }));
vi.mock('@/features/command-palette/command-palette-trigger', () => ({ CommandPaletteTrigger: () => null }));
vi.mock('@/features/command-palette/command-palette-dialog', () => ({ CommandPaletteDialog: () => null }));
vi.mock('@/features/command-palette/command-palette-store', () => ({
  useCommandPaletteStore: { getState: () => ({ open: vi.fn() }) },
}));
vi.mock('@/features/ai-assistant/ai-assistant-global-action', () => ({ AiAssistantGlobalAction: () => null }));

import { AppShell } from './app-shell';

describe('AppShell — redesigned MALEK header & navigation', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    document.title = '';
    mockSyncStatus = 'idle';
    setSyncStatusSpy.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  });

  it('shows the fixed MALEK brand in the global header instead of the dynamic page name', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    expect(header).not.toBeNull();
    const wordmark = header?.querySelector('[data-malek-brand-wordmark]');
    expect(wordmark).not.toBeNull();
    expect(wordmark?.textContent).toContain('MALEK');
    expect(header?.textContent).not.toContain('العقارات');
  });

  it('renders the MALEK brand as pure identity — not an interactive menu trigger', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    expect(header).not.toBeNull();
    const identity = header?.querySelector<HTMLElement>('[data-header-brand-identity]');
    expect(identity).not.toBeNull();
    // The brand lockup holds the canonical mark and wordmark…
    expect(identity?.querySelector('[data-malek-canonical-mark]')).not.toBeNull();
    expect(identity?.querySelector('[data-malek-brand-wordmark]')).not.toBeNull();
    // …but is NOT a button, has no menu label/haspopup, and no legacy monogram.
    expect(identity?.closest('button')).toBeNull();
    expect(identity?.querySelector('[data-header-brand-monogram]')).toBeNull();
    expect(header?.querySelector('[data-header-brand-monogram]')).toBeNull();
  });

  it('does not make the phone brand a hidden primary navigation trigger', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    const identity = header?.querySelector<HTMLElement>('[data-header-brand-identity]');
    expect(identity).not.toBeNull();
    // No interactive element inside the identity lockup.
    expect(identity?.querySelector('button, a')).toBeNull();

    // Clicking the brand surface cannot open the navigation sheet.
    act(() => {
      identity?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.querySelector('[data-bottom-sheet]')).toBeNull();
  });

  it('provides an explicit tablet Menu control for the 768–1023 breakpoint', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    const menuButton = header?.querySelector<HTMLElement>('[data-header-menu-button]');
    expect(menuButton).not.toBeNull();
    expect(menuButton?.getAttribute('aria-label')).toBe('فتح القائمة');
    expect(menuButton?.getAttribute('aria-haspopup')).toBe('dialog');
    // Visible only on tablet (md–lg), not on phone.
    expect(menuButton?.className).toContain('hidden');
    expect(menuButton?.className).toContain('md:grid');
    expect(menuButton?.className).toContain('lg:hidden');

    act(() => {
      menuButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const sheet = document.querySelector<HTMLElement>('[data-bottom-sheet]');
    expect(sheet).not.toBeNull();
    expect(document.querySelector('[data-mobile-nav-bottom-sheet]')).not.toBeNull();
    expect(sheet?.getAttribute('role')).toBe('dialog');
    expect(sheet?.getAttribute('aria-modal')).toBe('true');

    act(() => {
      sheet?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق"]')?.click();
    });
  });

  it('provides an explicit tablet Search control on the utility side', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    const searchButton = header?.querySelector<HTMLElement>('[data-header-search-button]');
    expect(searchButton).not.toBeNull();
    expect(searchButton?.getAttribute('aria-label')).toBe('البحث');
    expect(searchButton?.className).toContain('hidden');
    expect(searchButton?.className).toContain('md:grid');
    expect(searchButton?.className).toContain('lg:hidden');
  });

  it('keeps Day + Date OUT of the top header (moved to the Today context)', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    expect(header).not.toBeNull();
    expect(header?.querySelector('[data-header-date-center]')).toBeNull();
    expect(header?.querySelector('.tabular-nums')).toBeNull();
    expect(header?.querySelector('[data-header-theme-toggle]')).not.toBeNull();
    expect(header?.querySelector('[data-header-user-menu]')).not.toBeNull();
    expect(header?.querySelector('[data-header-utility-side]')).not.toBeNull();
    expect(header?.querySelector('[data-header-brand-side]')).not.toBeNull();
  });

  it('keeps compact header controls on the 44px touch grid without growing the header', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    expect(header).not.toBeNull();
    // Theme + User are each a self-contained 44px control (min-h-11/min-w-11).
    const themeToggle = header?.querySelector<HTMLElement>('[data-header-theme-toggle]');
    const userMenu = header?.querySelector<HTMLElement>('[data-header-user-menu]');
    expect(themeToggle?.className).toContain('min-h-11');
    expect(themeToggle?.className).toContain('min-w-11');
    expect(userMenu?.querySelector('button')?.className).toContain('min-h-11');
    expect(userMenu?.querySelector('button')?.className).toContain('min-w-11');

    const controls = header?.querySelector<HTMLElement>('[data-header-utility-side]');
    expect(controls?.className).toContain('gap-0.5');
    const headerRow = controls?.parentElement;
    expect(headerRow?.className).toContain('min-h-[var(--app-header-height)]');
  });

  it('uses the shared full-width bottom-sheet navigation instead of a right-side drawer', () => {
    act(() => { root.render(<AppShell />); });

    // Navigation opens from the explicit dock Menu control (mocked here).
    const dockMenu = host.querySelector<HTMLElement>('[data-mobile-dock-menu]');
    expect(dockMenu).not.toBeNull();
    act(() => { dockMenu?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const sheet = document.querySelector<HTMLElement>('[data-bottom-sheet]');
    expect(sheet).not.toBeNull();
    expect(document.querySelector('[data-mobile-nav-bottom-sheet]')).not.toBeNull();
    expect(sheet?.className).toContain('w-full');
    expect(sheet?.className).toContain('rounded-t-3xl');
    expect(sheet?.className).not.toContain('right-0');
    expect(sheet?.className).not.toContain('w-[85vw]');

    const close = sheet?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق"]');
    expect(close).not.toBeNull();
    act(() => { close?.click(); });
  });

  it('keeps the page title only for the document title and inside page content', () => {
    act(() => { root.render(<AppShell />); });
    expect(document.title).toContain('العقارات');
    expect(document.title).toContain('MALEK');
  });

  it('renders an announced global warning when the browser is offline', () => {
    mockSyncStatus = 'offline';
    act(() => { root.render(<AppShell />); });

    const notice = host.querySelector<HTMLElement>('[data-global-offline-notice]');
    expect(notice).not.toBeNull();
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.textContent).toContain('لا يوجد اتصال بالشبكة');
  });

  it('synchronizes the global connection state with browser online/offline events', () => {
    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      act(() => { root.render(<AppShell />); });
      expect(setSyncStatusSpy).toHaveBeenCalledWith('offline');

      onlineSpy.mockReturnValue(true);
      act(() => { window.dispatchEvent(new Event('online')); });
      expect(setSyncStatusSpy).toHaveBeenLastCalledWith('idle');
    } finally {
      onlineSpy.mockRestore();
    }
  });
});
