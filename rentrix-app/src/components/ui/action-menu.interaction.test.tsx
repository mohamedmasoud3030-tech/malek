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
});
