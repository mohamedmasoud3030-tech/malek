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

    // Mobile top toolbar shows the MALEK wordmark as part of the brand lockup
    const wordmark = header?.querySelector('[data-header-wordmark]');
    expect(wordmark).not.toBeNull();
    expect(wordmark?.textContent).toContain('MALEK');

    // The dynamic page name (route title) must not appear in the global header.
    expect(header?.textContent).not.toContain('العقارات');
  });

  it('renders the MALEK [M mark] + wordmark lockup on the visual left of the header', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    expect(header).not.toBeNull();

    const lockup = header?.querySelector<HTMLElement>('[data-header-brand-lockup]');
    expect(lockup).not.toBeNull();
    // The canonical M mark asset sits directly beside the wordmark, vertically aligned.
    expect(lockup?.querySelector('[data-malek-canonical-mark]')).not.toBeNull();
    expect(lockup?.querySelector('[data-header-wordmark]')).not.toBeNull();
    expect(lockup?.className).toContain('items-center');
    // The lockup lives on the wordmark side (visual left in RTL), not among the controls.
    expect(header?.querySelector('[data-header-wordmark-side] [data-header-brand-lockup]')).not.toBeNull();
    expect(header?.querySelector('[data-header-right-controls] [data-header-brand-lockup]')).toBeNull();
  });

  it('keeps Day + Date OUT of the top header (moved to the Today context)', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    expect(header).not.toBeNull();
    // The old centered date block must be gone from the toolbar entirely.
    expect(header?.querySelector('[data-header-date-center]')).toBeNull();
    // No weekday/date text is rendered inside the header itself.
    expect(header?.querySelector('[data-header-date-center], .tabular-nums')).toBeNull();
    // Theme + user controls still live in the same toolbar.
    expect(header?.querySelector('[data-header-theme-toggle]')).not.toBeNull();
    expect(header?.querySelector('[data-header-user-menu]')).not.toBeNull();
    expect(header?.querySelector('[data-header-right-controls]')).not.toBeNull();
    expect(header?.querySelector('[data-header-wordmark-side]')).not.toBeNull();
  });

  it('keeps compact header controls on 44px hit wrappers without growing the header', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    expect(header).not.toBeNull();

    const hitAreas = header?.querySelectorAll<HTMLElement>('[data-header-control-hit]');
    // Menu + user + theme, each with a 44px accessible hit wrapper.
    expect(hitAreas?.length).toBe(3);
    for (const hit of hitAreas ?? []) {
      expect(hit.className).toContain('size-11'); // 44px accessible target
      const visible = hit.querySelector('button');
      expect(visible).not.toBeNull();
      // Visible button is the compact 32px (size-8) control, not the old size-9/10.
      expect(visible?.className).toContain('size-8');
      expect(visible?.className).not.toContain('size-9 sm:size-10');
      expect(visible?.className).not.toContain('size-10');
    }

    // Controls group stays tight (gap-0.5 on mobile, gap-1 at sm+).
    const controls = header?.querySelector<HTMLElement>('[data-header-right-controls]');
    expect(controls?.className).toContain('gap-0.5');
    expect(controls?.className).toContain('sm:gap-1');
    // Header row: 48px on phones, 56px at sm+ (never larger than before).
    const headerRow = header?.querySelector<HTMLElement>('[data-header-right-controls]')?.parentElement;
    expect(headerRow?.className).toContain('min-h-12');
    expect(headerRow?.className).toContain('sm:min-h-14');
  });

  it('centers the drawer brand lockup with a side-pinned close control', () => {
    act(() => { root.render(<AppShell />); });

    const menuTrigger = host.querySelector<HTMLElement>('[data-mobile-top-menu]');
    expect(menuTrigger).not.toBeNull();
    act(() => { menuTrigger?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const drawerBrandHeader = document.querySelector<HTMLElement>('[data-drawer-brand-header]');
    expect(drawerBrandHeader).not.toBeNull();
    // Centered composition: justify-center with the lockup inside.
    expect(drawerBrandHeader?.className).toContain('justify-center');
    const drawerBrand = drawerBrandHeader?.querySelector<HTMLElement>('[data-drawer-brand]');
    expect(drawerBrand).not.toBeNull();
    expect(drawerBrand?.querySelector('[data-malek-canonical-mark]')).not.toBeNull();
    expect(drawerBrand?.textContent).toContain('MALEK');
    // Close button is pinned to the side and does not push the brand off-center.
    const close = drawerBrandHeader?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق القائمة"]');
    expect(close).not.toBeNull();
    expect(close?.className).toContain('absolute');

    act(() => { document.querySelector('[data-mobile-drawer] button[aria-label="إغلاق القائمة"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  });

  it('keeps the page title only for the document title and inside page content', () => {
    act(() => { root.render(<AppShell />); });
    // Document-title behavior is preserved: `<pageTitle> | MALEK`.
    expect(document.title).toContain('العقارات');
    expect(document.title).toContain('MALEK');
  });

  it('renders the brand lockup on sidebar and the M mark beside the wordmark in the top toolbar', () => {
    act(() => { root.render(<AppShell />); });
    // Sidebar carries full lockup; the top toolbar carries the mark + wordmark lockup.
    expect(host.querySelectorAll('[data-malek-brand-lockup]').length).toBeGreaterThanOrEqual(1);
    expect(host.querySelectorAll('[data-header-brand-lockup] [data-malek-canonical-mark]').length).toBe(1);
    expect(host.querySelectorAll('[data-header-brand-lockup] [data-header-wordmark]').length).toBe(1);
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
