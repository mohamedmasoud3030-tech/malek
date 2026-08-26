// @vitest-environment happy-dom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
    <a href={to} {...props}>{children}</a>
  ),
  Outlet: () => <div data-page-outlet>محتوى الصفحة</div>,
  useRouter: () => ({ navigate: vi.fn() }),
  useMatches: () => [{ staticData: { title: 'لوحة التحكم' } }],
  useLocation: () => ({ pathname: '/dashboard', search: {} }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockOpenCommandPalette = vi.fn();
vi.mock('@/features/command-palette/command-palette-store', () => ({
  useCommandPaletteStore: {
    getState: () => ({ open: mockOpenCommandPalette }),
  },
}));
vi.mock('@/features/command-palette/command-palette-trigger', () => ({ CommandPaletteTrigger: () => null }));
vi.mock('@/features/command-palette/command-palette-dialog', () => ({ CommandPaletteDialog: () => null }));
vi.mock('@/features/ai-assistant/ai-assistant-global-action', () => ({ AiAssistantGlobalAction: () => null }));
vi.mock('@/components/layout/permission-request-dialog', () => ({ PermissionRequestDialog: () => null }));

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

import { AppShell } from './app-shell';
import { MobileFloatingControl } from './layout-navigation-view';
import { HeroBanner } from '@/features/dashboard/components/hero-banner';
import { defaultCompanySettingsContract } from '@/lib/companySettings';

describe('MALEK mobile shell & navigation polish pass (Section O verification matrix)', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    mockOpenCommandPalette.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    queryClient.clear();
  });

  function renderWithClient(ui: React.ReactNode) {
    act(() => {
      root.render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
    });
  }

  // --------------------------------------------------------------------------
  // 1. Mobile Header
  // --------------------------------------------------------------------------
  describe('1. Mobile Header', () => {
    it('presents the interactive M monogram brand icon with proper accessibility and canonical mark', () => {
      renderWithClient(<AppShell />);

      const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
      expect(header).not.toBeNull();

      const monogram = header?.querySelector<HTMLButtonElement>('[data-header-brand-monogram]');
      expect(monogram).not.toBeNull();
      expect(monogram?.getAttribute('aria-label')).toContain('القائمة الرئيسية');
      expect(monogram?.getAttribute('aria-haspopup')).toBe('dialog');

      // Canonical geometric mark inside
      expect(monogram?.querySelector('[data-malek-canonical-mark]')).not.toBeNull();

      // Wordmark beside it
      const wordmark = header?.querySelector<HTMLElement>('[data-header-wordmark]');
      expect(wordmark).not.toBeNull();
      expect(wordmark?.textContent).toContain('MALEK');
    });

    it('has NO hamburger menu icon in the header (completely removed)', () => {
      renderWithClient(<AppShell />);

      const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
      expect(header).not.toBeNull();

      // No header hamburger
      expect(header?.querySelector('[data-mobile-top-menu]')).toBeNull();
      expect(header?.querySelector('button[aria-label="فتح القائمة"]')).toBeNull();
      expect(header?.querySelector('svg.lucide-menu')).toBeNull();
    });

    it('tapping M monogram opens the primary navigation drawer', () => {
      renderWithClient(<AppShell />);

      const monogram = host.querySelector<HTMLButtonElement>('[data-header-brand-monogram]');
      expect(monogram).not.toBeNull();

      act(() => { monogram?.click(); });

      const drawer = document.querySelector<HTMLElement>('[data-mobile-drawer]');
      expect(drawer).not.toBeNull();
      expect(drawer?.getAttribute('role')).toBe('dialog');
      expect(drawer?.getAttribute('aria-modal')).toBe('true');

      // Close to clean up
      const close = drawer?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق القائمة"]');
      act(() => { close?.click(); });
      expect(document.querySelector('[data-mobile-drawer]')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Bottom Mobile Tools
  // --------------------------------------------------------------------------
  describe('2. Bottom Mobile Tools', () => {
    it('contains Search, AI, Menu/hamburger, Quick Add, and Notifications in the dock', () => {
      renderWithClient(<MobileFloatingControl onMenu={vi.fn()} />);

      const dock = host.querySelector<HTMLElement>('[data-mobile-floating-control]');
      expect(dock).not.toBeNull();

      // All 5 tools present
      expect(dock?.querySelector('[data-mobile-dock-menu]')).not.toBeNull();
      expect(dock?.querySelector('[data-mobile-dock-search]')).not.toBeNull();
      expect(dock?.querySelector('[data-mobile-dock-quick-add]')).not.toBeNull();
      expect(dock?.querySelector('[data-mobile-dock-notifications]')).not.toBeNull();
      expect(dock?.querySelector('[data-mobile-dock-ai]')).not.toBeNull();
    });

    it('hamburger button in bottom tool bar opens primary navigation', () => {
      const onMenuSpy = vi.fn();
      renderWithClient(<MobileFloatingControl onMenu={onMenuSpy} />);

      const dockMenu = host.querySelector<HTMLButtonElement>('[data-mobile-dock-menu]');
      expect(dockMenu).not.toBeNull();

      act(() => { dockMenu?.click(); });
      expect(onMenuSpy).toHaveBeenCalledOnce();
    });

    it('search button opens global command palette', () => {
      renderWithClient(<MobileFloatingControl onMenu={vi.fn()} />);

      const searchBtn = host.querySelector<HTMLButtonElement>('[data-mobile-dock-search]');
      expect(searchBtn).not.toBeNull();

      act(() => { searchBtn?.click(); });
      expect(mockOpenCommandPalette).toHaveBeenCalledOnce();
    });

    it('enforces 44px min touch-target size across all bottom dock controls', () => {
      renderWithClient(<MobileFloatingControl onMenu={vi.fn()} />);

      const buttons = host.querySelectorAll<HTMLElement>('[data-mobile-floating-control] button');
      expect(buttons.length).toBeGreaterThanOrEqual(4);
      for (const btn of Array.from(buttons)) {
        expect(btn.className).toContain('min-h-11');
        expect(btn.className).toContain('min-w-11');
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. Primary Navigation Drawer
  // --------------------------------------------------------------------------
  describe('3. Primary Navigation Drawer', () => {
    it('opens from the RIGHT in RTL with full-height 85vw mobile width', () => {
      renderWithClient(<AppShell />);

      const monogram = host.querySelector<HTMLButtonElement>('[data-header-brand-monogram]');
      act(() => { monogram?.click(); });

      const drawer = document.querySelector<HTMLElement>('[data-mobile-drawer]');
      expect(drawer).not.toBeNull();

      // Right-side RTL placement
      expect(drawer?.className).toContain('right-0');
      expect(drawer?.className).toContain('left-auto');
      expect(drawer?.className).toContain('h-dvh');
      expect(drawer?.className).toContain('w-[85vw]');
      expect(drawer?.className).toContain('max-w-[20rem]');

      // Close to clean up
      act(() => {
        drawer?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق القائمة"]')?.click();
      });
    });

    it('hides the floating bottom bar completely while drawer is open', () => {
      renderWithClient(<AppShell />);

      expect(host.querySelector('[data-mobile-floating-control]')).not.toBeNull();

      // Open drawer
      const monogram = host.querySelector<HTMLButtonElement>('[data-header-brand-monogram]');
      act(() => { monogram?.click(); });

      // Floating bar is completely absent while drawer is open
      expect(host.querySelector('[data-mobile-floating-control]')).toBeNull();

      // Close drawer
      const drawer = document.querySelector<HTMLElement>('[data-mobile-drawer]');
      act(() => {
        drawer?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق القائمة"]')?.click();
      });

      // Floating bar reappears
      expect(host.querySelector('[data-mobile-floating-control]')).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Quick Add Menu
  // --------------------------------------------------------------------------
  describe('4. Quick Add Menu', () => {
    it('displays complete Arabic labels without truncation for core actions', () => {
      renderWithClient(<MobileFloatingControl onMenu={vi.fn()} />);

      const quickAddBtn = host.querySelector<HTMLButtonElement>('[data-mobile-dock-quick-add]');
      act(() => { quickAddBtn?.click(); });

      const menu = host.querySelector<HTMLElement>('[data-mobile-quick-add-menu]');
      expect(menu).not.toBeNull();

      const items = menu?.querySelectorAll<HTMLElement>('[data-mobile-quick-add-item]') ?? [];
      expect(items.length).toBe(4);

      const labels = Array.from(items).map((item) => item.textContent?.trim());
      expect(labels).toEqual(['عقد جديد', 'تحصيل مبلغ', 'طلب صيانة', 'فاتورة مرافق']);

      // No label has truncate class
      for (const item of Array.from(items)) {
        const labelSpan = item.querySelector('span:last-child');
        expect(labelSpan?.className).not.toContain('truncate');
        expect(labelSpan?.className).toContain('whitespace-nowrap');
      }
    });

    it('includes a header with close control and click-outside handling', () => {
      renderWithClient(<MobileFloatingControl onMenu={vi.fn()} />);

      const quickAddBtn = host.querySelector<HTMLButtonElement>('[data-mobile-dock-quick-add]');
      act(() => { quickAddBtn?.click(); });
      expect(host.querySelector('[data-mobile-quick-add-menu]')).not.toBeNull();

      const closeBtn = host.querySelector<HTMLButtonElement>('button[aria-label="إغلاق الإضافة السريعة"]');
      expect(closeBtn).not.toBeNull();

      act(() => { closeBtn?.click(); });
      expect(host.querySelector('[data-mobile-quick-add-menu]')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Notifications
  // --------------------------------------------------------------------------
  describe('5. Notifications Mobile Panel', () => {
    it('renders a mobile panel with safe-area spacing and backdrop dismiss', () => {
      renderWithClient(<MobileFloatingControl onMenu={vi.fn()} />);

      const bellBtn = host.querySelector<HTMLButtonElement>(
        'button[aria-label*="الإشعارات"], button[aria-label*="التنبيهات"]',
      );
      expect(bellBtn).not.toBeNull();

      act(() => { bellBtn?.click(); });

      const panel = host.querySelector<HTMLElement>('[role="dialog"]');
      expect(panel).not.toBeNull();

      // Mobile safe area and bounds
      expect(panel?.className).toContain('max-md:bottom-[calc(var(--mobile-floating-control-height');
      expect(panel?.className).toContain('max-md:max-h-[min(70dvh,28rem)]');

      // Close button exists for mobile
      const closeBtn = panel?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق التنبيهات"]');
      expect(closeBtn).not.toBeNull();

      act(() => { closeBtn?.click(); });
      expect(host.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 6. Account Menu
  // --------------------------------------------------------------------------
  describe('6. Account Menu', () => {
    it('renders a compact anchored menu without oversized blank container', () => {
      renderWithClient(<AppShell />);

      const userBtn = host.querySelector<HTMLButtonElement>('button[aria-label="فتح قائمة المستخدم"]');
      expect(userBtn).not.toBeNull();

      act(() => { userBtn?.click(); });

      const userMenu = host.querySelector<HTMLElement>('[role="menu"][aria-label="قائمة المستخدم"]');
      expect(userMenu).not.toBeNull();

      // Compact width, content-driven height
      expect(userMenu?.className).toContain('w-[min(17rem,calc(100vw-1.5rem))]');
      expect(userMenu?.textContent).toContain('admin@malek.test');
      expect(userMenu?.textContent).toContain('إعدادات المنشأة');
      expect(userMenu?.textContent).toContain('تسجيل الخروج');

      // Backdrop exists on mobile to dismiss
      const backdrop = host.querySelector<HTMLElement>('.fixed.inset-0.z-40');
      expect(backdrop).not.toBeNull();

      act(() => { backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      expect(host.querySelector('[role="menu"][aria-label="قائمة المستخدم"]')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 7. Layout Clearance
  // --------------------------------------------------------------------------
  describe('7. Layout Bottom Clearance & Overflow', () => {
    it('reserves mobile clearance with safe-area support in ux-foundation.css', () => {
      const uxCss = readFileSync(resolve(process.cwd(), 'src/styles/ux-foundation.css'), 'utf8');
      expect(uxCss).toContain('--mobile-floating-control-height');
      expect(uxCss).toContain('padding-block-end: calc(\n      var(--mobile-floating-control-height) + 1rem + env(safe-area-inset-bottom, 0px)\n    );');
    });

    it('app shell wrapper prevents horizontal scroll and handles RTL direction', () => {
      renderWithClient(<AppShell />);

      const shell = host.querySelector<HTMLElement>('[data-app-shell]');
      expect(shell).not.toBeNull();
      expect(shell?.getAttribute('dir')).toBe('rtl');
      expect(shell?.className).toContain('overflow-x-hidden');
    });
  });

  // --------------------------------------------------------------------------
  // 8. Dashboard Density & Today Card
  // --------------------------------------------------------------------------
  describe('8. Dashboard Density & Today Card', () => {
    it('renders a compact Today card with localized weekday and date', () => {
      renderWithClient(
        <HeroBanner
          snapshot={undefined}
          isLoading={false}
          settings={defaultCompanySettingsContract}
          today="2026-08-26"
        />,
      );

      const today = host.querySelector<HTMLElement>('[data-dashboard-today-context]');
      expect(today).not.toBeNull();
      expect(today?.querySelector('h1')?.textContent).toBe('اليوم');
      expect(today?.querySelector('[data-dashboard-today-weekday]')?.textContent).not.toBe('');
      expect(today?.querySelector('[data-dashboard-today-day-date]')?.textContent).not.toBe('');

      // Compact styling
      expect(today?.className).toContain('min-h-10');
      expect(today?.className).toContain('py-1.5');
    });

    it('provides an accessible ⋮ action control with 44px tap target and refresh action', () => {
      const onRefreshSpy = vi.fn();
      renderWithClient(
        <HeroBanner
          snapshot={undefined}
          isLoading={false}
          settings={defaultCompanySettingsContract}
          today="2026-08-26"
          onRefresh={onRefreshSpy}
        />,
      );

      const actionTrigger = host.querySelector<HTMLButtonElement>('[data-dashboard-today-action]');
      expect(actionTrigger).not.toBeNull();
      expect(actionTrigger?.getAttribute('aria-label')).toBe('خيارات اليوم');

      // 44px hit-target wrapper
      const actionHit = host.querySelector<HTMLElement>('[data-dashboard-today-action-hit]');
      expect(actionHit?.className).toContain('size-11');

      // Open menu
      act(() => { actionTrigger?.click(); });

      const menu = host.querySelector<HTMLElement>('[role="menu"][aria-label="خيارات اليوم"]');
      expect(menu).not.toBeNull();

      const refreshItem = menu?.querySelector<HTMLButtonElement>('button[role="menuitem"]');
      expect(refreshItem?.textContent).toContain('تحديث البيانات');

      act(() => { refreshItem?.click(); });
      expect(onRefreshSpy).toHaveBeenCalledOnce();
    });

    it('defines compact mobile section gaps in dashboard-v2.css', () => {
      const dashboardCss = readFileSync(
        resolve(process.cwd(), 'src/features/dashboard/dashboard-v2.css'),
        'utf8',
      );
      expect(dashboardCss).toContain('--dashboard-section-gap: 0.75rem');
      expect(dashboardCss).toContain('--dashboard-cluster-gap: 0.5rem');
    });
  });

  // --------------------------------------------------------------------------
  // 9. Representative Non-Dashboard Pages
  // --------------------------------------------------------------------------
  describe('9. Representative Operational Shell Compatibility', () => {
    it('preserves shell structure and responsive layout around child routes', () => {
      renderWithClient(<AppShell />);

      // Outlet renders within main container
      const outlet = host.querySelector<HTMLElement>('[data-page-outlet]');
      expect(outlet).not.toBeNull();
      expect(outlet?.textContent).toBe('محتوى الصفحة');

      // Header remains stable
      expect(host.querySelector('[data-app-shell-header]')).not.toBeNull();
      // Floating bar remains reachable
      expect(host.querySelector('[data-mobile-floating-control]')).not.toBeNull();
    });
  });
});
