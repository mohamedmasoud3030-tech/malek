// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/components/layout/permission-request-dialog', () => ({ PermissionRequestDialog: () => null }));
vi.mock('./notifications-menu', () => ({
  NotificationsMenu: () => <button type="button" aria-label="الإشعارات">تنبيهات</button>,
}));

let mockRole: 'ADMIN' | 'USER' = 'ADMIN';
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authorization: {
      userId: 'u-1',
      email: 'user@malek.test',
      role: mockRole,
    },
    logout: vi.fn(),
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, activeOptions: _activeOptions, search: _search, ...props }: { children: ReactNode; to: string; activeOptions?: unknown; search?: unknown } & Record<string, unknown>) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/dashboard', search: {} }),
}));

import { MobileFloatingControl } from './layout-navigation-view';

describe('Mobile chrome Quick Add — header actions + compact dock', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mockRole = 'ADMIN';
    const header = document.createElement('header');
    header.setAttribute('data-app-shell-header', '');
    const utility = document.createElement('div');
    utility.setAttribute('data-header-utility-side', '');
    const userMenu = document.createElement('div');
    userMenu.setAttribute('data-header-user-menu', '');
    utility.appendChild(userMenu);
    header.appendChild(utility);
    document.body.appendChild(header);

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    document.body.innerHTML = '';
  });

  function openQuickAdd() {
    act(() => root.render(<MobileFloatingControl onMenu={() => undefined} />));
    const trigger = document.querySelector<HTMLButtonElement>('[data-header-quick-add]');
    expect(trigger).not.toBeNull();
    act(() => { trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  }

  it('presents the quick actions as a vertical stack — one action per row', () => {
    openQuickAdd();

    const menu = host.querySelector<HTMLElement>('[data-mobile-quick-add-menu]');
    expect(menu).not.toBeNull();
    const list = menu?.querySelector<HTMLElement>('[data-mobile-quick-add-list]');
    expect(list).not.toBeNull();
    expect(list?.className).toContain('flex-col');
    expect(list?.className).not.toContain('grid-cols-2');

    const items = menu?.querySelectorAll<HTMLElement>('[data-mobile-quick-add-item]') ?? [];
    expect(items.length).toBe(4);
    const labels = Array.from(items).map((item) => item.textContent?.trim());
    expect(labels).toEqual(['عقد جديد', 'تحصيل مبلغ', 'طلب صيانة', 'فاتورة مرافق']);

    for (const item of items) {
      expect(item.className).toContain('min-h-12');
      expect(item.querySelector('svg')).not.toBeNull();
      const labelSpan = item.querySelector('span.min-w-0');
      expect(labelSpan).not.toBeNull();
      expect(item.parentElement).toBe(list);
    }
  });

  it('promotes Search and Quick Add into the real header and keeps only three dock tools', () => {
    act(() => root.render(<MobileFloatingControl onMenu={() => undefined} />));

    const headerUtility = document.querySelector<HTMLElement>('[data-header-utility-side]');
    expect(headerUtility?.querySelector('[data-header-phone-search]')).not.toBeNull();
    expect(headerUtility?.querySelector('[data-header-quick-add]')).not.toBeNull();

    const dock = host.querySelector<HTMLElement>('[data-mobile-floating-control]');
    expect(dock?.querySelector('[data-mobile-dock-menu]')).not.toBeNull();
    expect(dock?.querySelector('[data-mobile-dock-notifications]')).not.toBeNull();
    expect(dock?.querySelector('[data-mobile-dock-ai]')).not.toBeNull();
    expect(dock?.querySelector('[data-mobile-dock-search]')).toBeNull();
    expect(dock?.querySelector('[data-mobile-dock-quick-add]')).toBeNull();
  });

  it('exposes a well-formed quick-add menu whose items are its only menu children', async () => {
    openQuickAdd();

    const menu = host.querySelector<HTMLElement>('[role="menu"]');
    expect(menu).not.toBeNull();
    for (const child of Array.from(menu!.children)) {
      expect(child.getAttribute('role')).toBe('menuitem');
    }

    const labelledBy = menu!.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(host.querySelector(`#${CSS.escape(labelledBy!)}`)?.textContent?.trim()).toBe('إضافة سريعة');

    const results = await axe.run(host, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      rules: { 'color-contrast': { enabled: false }, 'target-size': { enabled: false } },
    });
    const report = results.violations.map((violation) => `${violation.id}: ${violation.help}`);
    expect(report, report.join('\n')).toEqual([]);
  });

  // Declaring role="menu" obligates the menu keyboard contract, so the quick-add
  // popup has to satisfy the same navigation as the canonical action menu.
  it('moves focus through the destinations and hands it back to the trigger on Escape', async () => {
    openQuickAdd();
    await act(async () => {
      await new Promise<void>((resolveFrame) => {
        requestAnimationFrame(() => resolveFrame());
      });
    });

    const menu = host.querySelector<HTMLElement>('[role="menu"]');
    expect(menu).not.toBeNull();
    const items = Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    expect(items).toHaveLength(4);

    // Opening moves focus into the menu instead of leaving it on the trigger.
    expect(document.activeElement).toBe(items[0]);
    expect(menu?.getAttribute('aria-labelledby')).toBeTruthy();

    act(() => {
      items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(document.activeElement).toBe(items[3]);

    act(() => {
      items[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(document.activeElement).toBe(items[0]);

    act(() => {
      items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(document.activeElement).toBe(items[3]);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(host.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(
      document.querySelector('[data-header-quick-add]'),
    );
  });

  // The trigger controls the popup, not the popup title.
  it('exposes the open state and the controlled panel on the trigger', () => {
    act(() => root.render(<MobileFloatingControl onMenu={() => undefined} />));
    const closedTrigger = document.querySelector<HTMLButtonElement>('[data-header-quick-add]');
    expect(closedTrigger?.getAttribute('aria-expanded')).toBe('false');
    expect(closedTrigger?.getAttribute('aria-controls')).toBeNull();

    act(() => { closedTrigger?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const openTrigger = document.querySelector<HTMLButtonElement>('[data-header-quick-add]');
    const panelId = openTrigger?.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = host.querySelector<HTMLElement>(`#${CSS.escape(panelId!)}`);
    expect(panel?.getAttribute('role')).toBe('menu');
    expect(openTrigger?.getAttribute('aria-expanded')).toBe('true');
  });

  it('disables Quick Add when the role has no permitted write actions', () => {
    mockRole = 'USER';
    act(() => root.render(<MobileFloatingControl onMenu={() => undefined} />));

    const trigger = document.querySelector<HTMLButtonElement>('[data-header-quick-add]');
    expect(trigger).not.toBeNull();
    expect(trigger?.disabled).toBe(true);
    expect(host.querySelector('[data-mobile-quick-add-menu]')).toBeNull();
  });
});
