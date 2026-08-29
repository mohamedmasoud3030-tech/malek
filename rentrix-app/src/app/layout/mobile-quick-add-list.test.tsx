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
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, activeOptions: _activeOptions, search: _search, ...props }: { children: ReactNode; to: string; activeOptions?: unknown; search?: unknown } & Record<string, unknown>) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/dashboard', search: {} }),
}));

import { MobileFloatingControl } from './layout-navigation-view';

describe('Mobile dock Quick Add — clear vertical action list', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mockRole = 'ADMIN';
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
    const trigger = host.querySelector<HTMLButtonElement>('[data-mobile-dock-quick-add]');
    expect(trigger).not.toBeNull();
    act(() => { trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  }

  it('presents the quick actions as a vertical stack — one action per row', () => {
    openQuickAdd();

    const menu = host.querySelector<HTMLElement>('[data-mobile-quick-add-menu]');
    expect(menu).not.toBeNull();
    const list = menu?.querySelector<HTMLElement>('[data-mobile-quick-add-list]');
    expect(list).not.toBeNull();
    // Vertical rhythm: one row per action, not a 2-column icon grid.
    expect(list?.className).toContain('flex-col');
    expect(list?.className).not.toContain('grid-cols-2');

    const items = menu?.querySelectorAll<HTMLElement>('[data-mobile-quick-add-item]') ?? [];
    // The four existing actions, none invented, each on its own row.
    expect(items.length).toBe(4);
    const labels = Array.from(items).map((item) => item.textContent?.trim());
    expect(labels).toEqual(['عقد جديد', 'تحصيل مبلغ', 'طلب صيانة', 'فاتورة مرافق']);

    for (const item of items) {
      // Comfortable tap target (48px — above the 44px floor) with an icon and a full, unclipped label.
      expect(item.className).toContain('min-h-12');
      expect(item.querySelector('svg')).not.toBeNull();
      const labelSpan = item.querySelector('span.min-w-0');
      expect(labelSpan).not.toBeNull();
      // Rows stack vertically: each item is a direct block child of the list.
      expect(item.parentElement).toBe(list);
    }
  });

  it('exposes the full mobile dock tools with hamburger menu', () => {
    act(() => root.render(<MobileFloatingControl onMenu={() => undefined} />));
    expect(host.querySelector('[data-mobile-dock-menu]')).not.toBeNull();
    expect(host.querySelector('[data-mobile-dock-search]')).not.toBeNull();
    expect(host.querySelector('[data-mobile-dock-quick-add]')).not.toBeNull();
    expect(host.querySelector('[data-mobile-dock-notifications]')).not.toBeNull();
    expect(host.querySelector('[data-mobile-dock-ai]')).not.toBeNull();
  });

  it('exposes a well-formed menu whose items are its only children', async () => {
    openQuickAdd();

    const menu = host.querySelector<HTMLElement>('[role="menu"]');
    expect(menu).not.toBeNull();

    // `role="menu"` may only contain menu items. The panel title and close
    // button must therefore stay outside it, or the menu is exposed as
    // malformed (axe `aria-required-children`, critical).
    for (const child of Array.from(menu!.children)) {
      expect(child.getAttribute('role')).toBe('menuitem');
    }

    // The menu keeps an accessible name even though its label moved out of it.
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

  it('hides quick actions the role cannot complete (permission rules)', () => {
    mockRole = 'USER';
    openQuickAdd();

    // USER has none of the write permissions behind the four actions, so the
    // menu must not open with dead ends — no visible items, no empty panel.
    const items = host.querySelectorAll<HTMLElement>('[data-mobile-quick-add-item]');
    expect(items.length).toBe(0);
    const menu = host.querySelector('[data-mobile-quick-add-menu]');
    expect(menu).toBeNull();
  });
});
