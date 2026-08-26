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
const setSyncStatusSpy = vi.fn();
let mockSyncStatus: 'idle' | 'offline' = 'idle';
vi.mock('@/store/ui-store', () => ({
  useUiStore: () => ({
    sidebarCollapsed: false,
    theme: 'light',
    toggleSidebar: vi.fn(),
    setTheme: vi.fn(),
    syncStatus: mockSyncStatus,
    lastSyncedAt: null,
    setSyncStatus: setSyncStatusSpy,
  }),
}));
vi.mock('./layout-navigation-view', () => ({
  NavigationLinks: () => null,
  MobileFloatingControl: () => (
    <div data-mobile-floating-control><button type="button" aria-label="الإضافة السريعة" data-mobile-dock-quick-add /><button type="button" aria-label="الإشعارات" data-mobile-dock-notifications /><button type="button" aria-label="فتح المساعد الذكي" data-mobile-dock-ai /></div>
  ),
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
    mockSyncStatus = 'idle';
    setSyncStatusSpy.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('shows the fixed MALEK brand in the global header instead of the dynamic page name', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    expect(header).not.toBeNull();

    // Mobile top toolbar shows MALEK text only without M mark, per new design
    const wordmark = header?.querySelector('[data-header-wordmark]');
    expect(wordmark).not.toBeNull();
    expect(wordmark?.textContent).toContain('MALEK');

    // The dynamic page name (route title) must not appear in the global header.
    expect(header?.textContent).not.toContain('العقارات');
  });

  it('shows centered date with day name and keeps theme toggle in same toolbar', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    expect(header?.querySelector('[data-header-date-center]')).not.toBeNull();
    expect(header?.querySelector('[data-header-theme-toggle]')).not.toBeNull();
    expect(header?.querySelector('[data-header-right-controls]')).not.toBeNull();
    expect(header?.querySelector('[data-header-wordmark-side]')).not.toBeNull();
  });

  it('keeps the page title only for the document title and inside page content', () => {
    act(() => { root.render(<AppShell />); });
    // Document-title behavior is preserved: `<pageTitle> | MALEK`.
    expect(document.title).toContain('العقارات');
    expect(document.title).toContain('MALEK');
  });

  it('renders the brand lockup on sidebar and wordmark only in top toolbar', () => {
    act(() => { root.render(<AppShell />); });
    // Sidebar carries full lockup, header now shows wordmark only without M mark
    expect(host.querySelectorAll('[data-malek-brand-lockup]').length).toBeGreaterThanOrEqual(1);
    expect(host.querySelectorAll('[data-header-wordmark]').length).toBeGreaterThanOrEqual(1);
  });

  it('renders an announced global warning when the browser is offline', () => {
    mockSyncStatus = 'offline';
    act(() => { root.render(<AppShell />); });

    const notice = host.querySelector<HTMLElement>('[data-global-offline-notice]');
    expect(notice).not.toBeNull();
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.textContent).toContain('لا يوجد اتصال بالشبكة');
    expect(notice?.textContent).toContain('قد يفشل الحفظ والتحديث حتى يعود الاتصال');
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

  it('keeps the mobile navigation trigger in top toolbar and removes duplicate from bottom dock', () => {
    act(() => { root.render(<AppShell />); });

    // Menu moved to top toolbar to avoid duplicate, bottom dock now has only quick-add, notifications, AI
    expect(host.querySelector('[data-mobile-top-menu]')).not.toBeNull();
    expect(host.querySelector('[data-mobile-dock-menu]')).toBeNull();
    expect(host.querySelector('[data-mobile-menu-trigger]')).toBeNull();
  });
});
