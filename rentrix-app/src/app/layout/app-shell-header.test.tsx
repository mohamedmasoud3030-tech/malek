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
  MobileFloatingControl: ({ drawerOpen }: { drawerOpen?: boolean }) => (
    drawerOpen ? null : (
      <div data-mobile-floating-control>
        <button type="button" aria-label="فتح القائمة" data-mobile-dock-menu />
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
    const wordmark = header?.querySelector('[data-header-wordmark]');
    expect(wordmark).not.toBeNull();
    expect(wordmark?.textContent).toContain('MALEK');
    expect(header?.textContent).not.toContain('العقارات');
  });

  it('renders the interactive [ M ] monogram and MALEK wordmark lockup on the brand side', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    expect(header).not.toBeNull();
    const lockup = header?.querySelector<HTMLElement>('[data-header-brand-lockup]');
    expect(lockup).not.toBeNull();
    const monogramButton = lockup?.querySelector('[data-header-brand-monogram]');
    expect(monogramButton).not.toBeNull();
    expect(monogramButton?.getAttribute('aria-label')).toContain('القائمة الرئيسية');
    expect(monogramButton?.getAttribute('aria-haspopup')).toBe('dialog');
    expect(monogramButton?.querySelector('[data-malek-canonical-mark]')).not.toBeNull();
    expect(lockup?.querySelector('[data-header-wordmark]')).not.toBeNull();
    expect(lockup?.className).toContain('items-center');
    expect(header?.querySelector('[data-header-brand-side] [data-header-brand-lockup]')).not.toBeNull();
  });

  it('tapping the interactive M monogram opens the primary navigation bottom sheet', () => {
    act(() => { root.render(<AppShell />); });

    const monogramButton = host.querySelector<HTMLElement>('[data-header-brand-monogram]');
    expect(monogramButton).not.toBeNull();
    act(() => { monogramButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const sheet = document.querySelector<HTMLElement>('[data-bottom-sheet]');
    expect(sheet).not.toBeNull();
    expect(document.querySelector('[data-mobile-nav-bottom-sheet]')).not.toBeNull();
    expect(sheet?.getAttribute('role')).toBe('dialog');
    expect(sheet?.getAttribute('aria-modal')).toBe('true');

    act(() => {
      sheet?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق"]')?.click();
    });
  });

  it('removes the hamburger menu icon completely from the header', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    expect(header).not.toBeNull();
    expect(header?.querySelector('[data-mobile-top-menu]')).toBeNull();
    expect(header?.querySelector('button[aria-label="فتح القائمة"]')).toBeNull();
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

  it('keeps compact header controls on 44px hit wrappers without growing the header', () => {
    act(() => { root.render(<AppShell />); });

    const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
    expect(header).not.toBeNull();
    const hitAreas = header?.querySelectorAll<HTMLElement>('[data-header-control-hit]');
    expect(hitAreas?.length).toBe(2);
    for (const hit of hitAreas ?? []) {
      expect(hit.className).toContain('size-11');
      const visible = hit.querySelector('button');
      expect(visible).not.toBeNull();
      expect(visible?.className).toContain('size-8');
    }

    const monogramHit = header?.querySelector<HTMLElement>('[data-header-monogram-hit]');
    expect(monogramHit).not.toBeNull();
    expect(monogramHit?.className).toContain('size-11');
    const controls = header?.querySelector<HTMLElement>('[data-header-utility-side]');
    expect(controls?.className).toContain('gap-0.5');
    const headerRow = controls?.parentElement;
    expect(headerRow?.className).toContain('min-h-[var(--app-header-height)]');
  });

  it('uses the shared full-width bottom-sheet navigation instead of a right-side drawer', () => {
    act(() => { root.render(<AppShell />); });

    const monogram = host.querySelector<HTMLElement>('[data-header-brand-monogram]');
    act(() => { monogram?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

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
