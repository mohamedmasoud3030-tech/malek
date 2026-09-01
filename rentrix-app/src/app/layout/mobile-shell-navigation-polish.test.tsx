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
  useMatches: () => [{ staticData: { title: 'اليوم' } }],
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

import { AppShell } from './app-shell';
import { MobileFloatingControl } from './layout-navigation-view';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';

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

  describe('1. Mobile Header', () => {
    it('presents the MALEK brand as identity with the canonical mark, not a menu trigger', () => {
      renderWithClient(<AppShell />);

      const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
      expect(header).not.toBeNull();

      const identity = header?.querySelector<HTMLElement>('[data-header-brand-identity]');
      expect(identity).not.toBeNull();
      expect(identity?.querySelector('[data-malek-canonical-mark]')).not.toBeNull();
      expect(identity?.querySelector('button')).toBeNull();

      const wordmark = header?.querySelector<HTMLElement>('[data-header-wordmark]');
      expect(wordmark).not.toBeNull();
      expect(wordmark?.textContent).toContain('MALEK');
    });

    it('keeps the phone header free of a redundant menu (navigation lives in the dock)', () => {
      renderWithClient(<AppShell />);
      const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
      expect(header).not.toBeNull();
      // Legacy top-menu marker is gone.
      expect(header?.querySelector('[data-mobile-top-menu]')).toBeNull();
      // The header menu button exists only as a tablet affordance (hidden on phone).
      const menuButton = header?.querySelector<HTMLButtonElement>('[data-header-menu-button]');
      expect(menuButton).not.toBeNull();
      expect(menuButton?.className).toContain('hidden');
      expect(menuButton?.className).toContain('md:grid');
    });

    it('the explicit dock Menu opens the shared primary-navigation bottom sheet', () => {
      renderWithClient(<AppShell />);

      const dockMenu = host.querySelector<HTMLButtonElement>('[data-mobile-dock-menu]');
      expect(dockMenu).not.toBeNull();
      act(() => { dockMenu?.click(); });

      const sheet = document.querySelector<HTMLElement>('[data-bottom-sheet]');
      expect(sheet).not.toBeNull();
      expect(document.querySelector('[data-mobile-nav-bottom-sheet]')).not.toBeNull();
      expect(sheet?.getAttribute('role')).toBe('dialog');
      expect(sheet?.getAttribute('aria-modal')).toBe('true');

      const close = sheet?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق"]');
      act(() => { close?.click(); });
      expect(document.querySelector('[data-bottom-sheet]')).toBeNull();
    });
  });

  describe('2. Bottom Mobile Tools', () => {
    it('keeps the dock minimal while Search and Quick Add live in the phone header', () => {
      renderWithClient(<AppShell />);

      const header = host.querySelector<HTMLElement>('[data-app-shell-header]');
      expect(header?.querySelector('[data-header-phone-search]')).not.toBeNull();
      expect(header?.querySelector('[data-header-quick-add]')).not.toBeNull();

      const dock = host.querySelector<HTMLElement>('[data-mobile-floating-control]');
      expect(dock).not.toBeNull();
      expect(dock?.querySelector('[data-mobile-dock-menu]')).not.toBeNull();
      expect(dock?.querySelector('[data-mobile-dock-notifications]')).not.toBeNull();
      expect(dock?.querySelector('[data-mobile-dock-ai]')).not.toBeNull();
      expect(dock?.querySelector('[data-mobile-dock-search]')).toBeNull();
      expect(dock?.querySelector('[data-mobile-dock-quick-add]')).toBeNull();
    });

    it('menu button in bottom tool bar opens primary navigation', () => {
      const onMenuSpy = vi.fn();
      renderWithClient(<MobileFloatingControl onMenu={onMenuSpy} />);
      const dockMenu = host.querySelector<HTMLButtonElement>('[data-mobile-dock-menu]');
      expect(dockMenu).not.toBeNull();
      act(() => { dockMenu?.click(); });
      expect(onMenuSpy).toHaveBeenCalledOnce();
    });

    it('phone header search button opens global command palette', () => {
      renderWithClient(<AppShell />);
      const searchBtn = host.querySelector<HTMLButtonElement>('[data-header-phone-search]');
      expect(searchBtn).not.toBeNull();
      act(() => { searchBtn?.click(); });
      expect(mockOpenCommandPalette).toHaveBeenCalledOnce();
    });

    it('enforces 44px min touch-target size across all bottom dock controls', () => {
      renderWithClient(<MobileFloatingControl onMenu={vi.fn()} />);
      const buttons = host.querySelectorAll<HTMLElement>('[data-mobile-floating-control] button');
      expect(buttons.length).toBeGreaterThanOrEqual(3);
      for (const btn of Array.from(buttons)) {
        expect(btn.className).toContain('min-h-11');
        expect(btn.className).toContain('min-w-11');
      }
    });
  });

  describe('3. Primary Navigation Bottom Sheet', () => {
    it('uses the shared bottom-sheet primitive instead of a side drawer', () => {
      renderWithClient(<AppShell />);
      const dockMenu = host.querySelector<HTMLButtonElement>('[data-mobile-dock-menu]');
      act(() => { dockMenu?.click(); });

      const sheet = document.querySelector<HTMLElement>('[data-bottom-sheet]');
      expect(sheet).not.toBeNull();
      expect(document.querySelector('[data-mobile-nav-bottom-sheet]')).not.toBeNull();
      expect(sheet?.className).toContain('w-full');
      expect(sheet?.className).toContain('rounded-t-3xl');
      expect(sheet?.className).not.toContain('right-0');
      expect(sheet?.className).not.toContain('w-[85vw]');

      act(() => {
        sheet?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق"]')?.click();
      });
    });

    it('hides the floating bottom bar completely while the navigation sheet is open', () => {
      renderWithClient(<AppShell />);
      expect(host.querySelector('[data-mobile-floating-control]')).not.toBeNull();

      const dockMenu = host.querySelector<HTMLButtonElement>('[data-mobile-dock-menu]');
      act(() => { dockMenu?.click(); });
      expect(host.querySelector('[data-mobile-floating-control]')).toBeNull();

      const sheet = document.querySelector<HTMLElement>('[data-bottom-sheet]');
      act(() => {
        sheet?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق"]')?.click();
      });
      expect(host.querySelector('[data-mobile-floating-control]')).not.toBeNull();
    });
  });

  describe('4. Quick Add Menu', () => {
    it('displays complete Arabic labels without truncation for core actions', () => {
      renderWithClient(<AppShell />);

      const quickAddBtn = host.querySelector<HTMLButtonElement>('[data-header-quick-add]');
      act(() => { quickAddBtn?.click(); });

      const menu = host.querySelector<HTMLElement>('[data-mobile-quick-add-menu]');
      expect(menu).not.toBeNull();

      const items = menu?.querySelectorAll<HTMLElement>('[data-mobile-quick-add-item]') ?? [];
      expect(items.length).toBe(4);
      const labels = Array.from(items).map((item) => item.textContent?.trim());
      expect(labels).toEqual(['عقد جديد', 'تحصيل مبلغ', 'طلب صيانة', 'فاتورة مرافق']);

      for (const item of Array.from(items)) {
        const labelSpan = item.querySelector('span:last-child');
        expect(labelSpan?.className).not.toContain('truncate');
        expect(labelSpan?.className).toContain('whitespace-nowrap');
      }
    });

    it('includes a header with close control and click-outside handling', () => {
      renderWithClient(<AppShell />);
      const quickAddBtn = host.querySelector<HTMLButtonElement>('[data-header-quick-add]');
      act(() => { quickAddBtn?.click(); });
      expect(host.querySelector('[data-mobile-quick-add-menu]')).not.toBeNull();

      const closeBtn = host.querySelector<HTMLButtonElement>('button[aria-label="إغلاق الإضافة السريعة"]');
      expect(closeBtn).not.toBeNull();
      act(() => { closeBtn?.click(); });
      expect(host.querySelector('[data-mobile-quick-add-menu]')).toBeNull();
    });
  });

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
      expect(panel?.className).toContain('max-md:bottom-[var(--mobile-dock-clearance');
      expect(panel?.className).toContain('max-md:max-h-[min(70dvh,28rem)]');

      const closeBtn = panel?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق التنبيهات"]');
      expect(closeBtn).not.toBeNull();
      act(() => { closeBtn?.click(); });
      expect(host.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  describe('6. Account Menu', () => {
    it('renders a compact anchored menu without oversized blank container', () => {
      renderWithClient(<AppShell />);
      const userBtn = host.querySelector<HTMLButtonElement>('button[aria-label="فتح قائمة المستخدم"]');
      expect(userBtn).not.toBeNull();
      act(() => { userBtn?.click(); });

      const userMenu = host.querySelector<HTMLElement>('[role="menu"][aria-label="قائمة المستخدم"]');
      expect(userMenu).not.toBeNull();
      expect(userMenu?.className).toContain('w-[min(17rem,calc(100vw-1.5rem))]');
      expect(userMenu?.textContent).toContain('admin@malek.test');
      expect(userMenu?.textContent).toContain('إعدادات المنشأة');
      expect(userMenu?.textContent).toContain('تسجيل الخروج');

      const backdrop = host.querySelector<HTMLElement>('.fixed.inset-0.z-40');
      expect(backdrop).not.toBeNull();
      act(() => { backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      expect(host.querySelector('[role="menu"][aria-label="قائمة المستخدم"]')).toBeNull();
    });
  });

  describe('7. Layout Bottom Clearance & Overflow', () => {
    it('reserves mobile clearance with safe-area support in ux-foundation.css', () => {
      const uxCss = readFileSync(resolve(process.cwd(), 'src/styles/ux-foundation.css'), 'utf8');
      expect(uxCss).toContain('--mobile-floating-control-height');
      expect(uxCss).toContain('padding-block-end: calc(\n      var(--mobile-floating-control-height) + 1rem + env(safe-area-inset-bottom, 0px)\n    );');
    });

    it('app shell prevents horizontal scroll and inherits the single document direction authority', () => {
      renderWithClient(<AppShell />);
      const shell = host.querySelector<HTMLElement>('[data-app-shell]');
      expect(shell).not.toBeNull();
      expect(shell?.getAttribute('dir')).toBeNull();
      expect(shell?.className).toContain('overflow-x-hidden');
    });
  });

  describe('8. Dashboard Density & Shared Today Context', () => {
    it('renders a compact Today context strip with localized weekday and date from the canonical PageHeader', () => {
      renderWithClient(<PageHeader title="اليوم" showTodayContext />);
      const today = host.querySelector<HTMLElement>('[data-global-today-context]');
      expect(today).not.toBeNull();
      expect(today?.textContent).toContain('اليوم');
      expect(today?.querySelector('[data-global-today-weekday]')?.textContent).not.toBe('');
      expect(today?.querySelector('[data-global-today-day-date]')?.textContent).not.toBe('');
      // Document chrome: the strip is an inline text layer, not a card.
      expect(today?.className).not.toContain('min-h-14');
      expect(today?.className).not.toContain('rounded-2xl');
    });

    it('keeps PageLayout structural and does not duplicate global refresh chrome', () => {
      renderWithClient(<PageLayout>محتوى</PageLayout>);
      expect(host.querySelector('[data-global-refresh]')).toBeNull();
    });

    it('defines compact mobile section gaps and the single attention treatment in dashboard-v2.css', () => {
      const dashboardCss = readFileSync(resolve(process.cwd(), 'src/features/dashboard/dashboard-v2.css'), 'utf8');
      expect(dashboardCss).toContain('--dashboard-section-gap: 0.85rem');
      expect(dashboardCss).toContain('--dashboard-cluster-gap: 0.5rem');
      expect(dashboardCss).toContain('[data-dashboard-focus-strip]');
      expect(dashboardCss).toContain("[data-dashboard-priority='attention']");
    });
  });

  describe('9. Representative Operational Shell Compatibility', () => {
    it('preserves shell structure and responsive layout around child routes', () => {
      renderWithClient(<AppShell />);
      const outlet = host.querySelector<HTMLElement>('[data-page-outlet]');
      expect(outlet).not.toBeNull();
      expect(outlet?.textContent).toBe('محتوى الصفحة');
      expect(host.querySelector('[data-app-shell-header]')).not.toBeNull();
      expect(host.querySelector('[data-mobile-floating-control]')).not.toBeNull();
    });
  });
});
