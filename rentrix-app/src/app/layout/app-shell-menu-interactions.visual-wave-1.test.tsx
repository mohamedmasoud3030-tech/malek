// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// React 19 requires an explicit act-capable test environment.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { AuthorizationContext } from '@/features/auth/permissions';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to, role, ...props }: { children: ReactNode; to: string; role?: string } & Record<string, unknown>) => (
      <a href={to} role={role} {...props}>{children}</a>
    ),
  };
});

import { QuickAddMenu } from './app-shell';

const authorization: AuthorizationContext = {
  userId: 'admin-1',
  email: 'admin@malek.test',
  role: 'ADMIN',
};

const sharedLabel = (key: string) => ({
  quickAdd: 'إضافة سريعة',
  newContract: 'عقد جديد',
  newProperty: 'عقار جديد',
  newPerson: 'شخص جديد',
}[key] ?? key);

function click(element: Element | null) {
  act(() => {
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('Visual Wave 1 — app-shell quick actions', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(<QuickAddMenu authorization={authorization} sharedLabel={sharedLabel} />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('closes from the same trigger instead of treating the trigger as an outside click', () => {
    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="إضافة سريعة"]');
    click(trigger);
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');

    act(() => {
      trigger?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
  });

  it('moves focus into the real menu, supports keyboard movement, and restores focus on Escape', () => {
    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="إضافة سريعة"]');
    click(trigger);

    const menuItems = Array.from(host.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    expect(menuItems).toHaveLength(3);
    expect(document.activeElement).toBe(menuItems[0]);

    act(() => {
      menuItems[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(document.activeElement).toBe(menuItems[1]);

    act(() => {
      menuItems[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(document.activeElement).toBe(menuItems[2]);

    act(() => {
      menuItems[2]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the header trigger and destinations above the 44px touch-target minimum', () => {
    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="إضافة سريعة"]');
    expect(trigger?.className).toContain('size-11');

    click(trigger);
    for (const item of host.querySelectorAll<HTMLElement>('[role="menuitem"]')) {
      expect(item.className).toContain('min-h-11');
    }
  });
});
