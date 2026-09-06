// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionMenu } from './action-menu';

describe('ActionMenu keyboard contract', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); document.querySelectorAll('[role="menu"]').forEach((node) => node.remove()); });

  it('keeps a single available action behind the canonical menu trigger', () => {
    const onSelect = vi.fn();
    act(() => root.render(<ActionMenu label="إجراءات السجل" items={[{ id: 'view', label: 'عرض', onSelect }]} />));

    const trigger = container.querySelector<HTMLButtonElement>('[data-action-menu-trigger]');
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');
    expect(container.querySelector('[role="menu"]')).toBeNull();

    act(() => trigger?.click());
    const item = document.querySelector<HTMLButtonElement>('[role="menuitem"]');
    expect(item?.textContent).toContain('عرض');
    expect(onSelect).not.toHaveBeenCalled();

    act(() => item?.click());
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('uses menu semantics and supports keyboard navigation, escape, selection, and outside dismissal', () => {
    const edit = vi.fn(); const archive = vi.fn();
    act(() => root.render(<table><tbody><tr><td><ActionMenu items={[
      { id: 'edit', label: 'تعديل', onSelect: edit },
      { id: 'archive', label: 'أرشفة', destructive: true, onSelect: archive },
      { id: 'hidden', label: 'مخفي', disabled: true, onSelect: vi.fn() },
    ]} /></td></tr></tbody></table>));
    const trigger = container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
    act(() => trigger.click());
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    const items = menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    expect(items).toHaveLength(2);
    expect(menu.className).toContain('fixed');
    expect(items[1].className).toContain('text-destructive');
    act(() => items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(document.activeElement).toBe(items[1]);
    act(() => items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(document.activeElement).toBe(items[0]);
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    act(() => trigger.click());
    act(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    expect(document.querySelector('[role="menu"]')).toBeNull();
    act(() => trigger.click());
    act(() => document.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click());
    expect(edit).toHaveBeenCalledTimes(1);
    expect(archive).not.toHaveBeenCalled();
  });

  it('shields the follow-up click of a double-click from whatever the menu was covering', () => {
    vi.useFakeTimers();
    try {
      const print = vi.fn();
      const covered = vi.fn();
      act(() => root.render(
        <div>
          <button type="button" data-covered onClick={covered}>معاينة سريعة</button>
          <ActionMenu items={[{ id: 'print', label: 'طباعة', onSelect: print }]} />
        </div>,
      ));
      const trigger = container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
      const underlying = container.querySelector<HTMLButtonElement>('[data-covered]')!;

      act(() => trigger.click());
      const item = document.querySelector<HTMLButtonElement>('[role="menuitem"]')!;
      act(() => item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
      expect(print).toHaveBeenCalledTimes(1);
      expect(document.querySelector('[role="menu"]')).toBeNull();

      // Second click of the same sequence lands where the menu used to be.
      act(() => underlying.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 2 })));
      expect(covered).not.toHaveBeenCalled();
      expect(print).toHaveBeenCalledTimes(1);

      // A deliberate, separate click afterwards is never swallowed.
      act(() => underlying.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
      expect(covered).toHaveBeenCalledTimes(1);

      // The shield also expires on its own when no follow-up click arrives.
      act(() => trigger.click());
      act(() => document.querySelector<HTMLButtonElement>('[role="menuitem"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
      act(() => { vi.advanceTimersByTime(700); });
      act(() => underlying.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 2 })));
      expect(covered).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens upward when the trigger sits too close to the bottom of the viewport', () => {
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 560, bottom: 600, left: 100, right: 144, width: 44, height: 40, x: 100, y: 560, toJSON: () => ({}),
    } as DOMRect);
    const heightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(180);
    try {
      act(() => root.render(<ActionMenu items={[{ id: 'a', label: 'أ', onSelect: vi.fn() }, { id: 'b', label: 'ب', onSelect: vi.fn() }]} />));
      const trigger = container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
      act(() => trigger.click());
      const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
      // Placement is owned by the shared `resolveActionMenuPlacement` contract,
      // which anchors by `top`: the flipped menu's bottom edge sits four pixels
      // above the trigger (560 - 4 - 180 = 376). An implementation that never
      // flipped would report 604px here, so the failure mode stays caught.
      expect(menu.style.top).toBe('376px');
      expect(menu.style.bottom).toBe('');
    } finally {
      rectSpy.mockRestore();
      heightSpy.mockRestore();
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
    }
  });
});
