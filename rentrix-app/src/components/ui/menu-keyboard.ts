import { useEffect, useRef, type RefObject } from 'react';

/**
 * The single keyboard authority for menu surfaces.
 *
 * `ActionMenu` carried this contract inline while the header popups (mobile quick
 * add and the account menu) announced `role="menu"` without it, which left screen
 * reader and keyboard users on a pattern the ARIA specification does not allow to
 * be partial: a menu either moves focus with the arrow keys or is not a menu.
 */

/** Enabled items of a rendered menu, in DOM order. */
export const MENU_ITEM_SELECTOR = '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])';

export type MenuFocusTarget = 'first' | 'last' | 'next' | 'previous';

/**
 * Focuses one of the menu's enabled items, wrapping at both ends.
 *
 * When focus is not on an item yet — straight after the menu opened, or while the
 * trigger still holds it — `next` starts at the first item and `previous` at the
 * last, so the first arrow press never lands outside the menu.
 */
export function focusMenuItem(container: HTMLElement | null, target: MenuFocusTarget): void {
  if (!container) return;
  const items = Array.from(container.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR));
  if (items.length === 0) return;

  const active = document.activeElement;
  const currentIndex = active instanceof HTMLElement ? items.indexOf(active) : -1;
  const hasCurrent = currentIndex >= 0;

  const index = target === 'first'
    ? 0
    : target === 'last'
      ? items.length - 1
      : target === 'next'
        ? hasCurrent
          ? (currentIndex + 1) % items.length
          : 0
        : hasCurrent
          ? (currentIndex - 1 + items.length) % items.length
          : items.length - 1;

  items[index]?.focus();
}

export function useMenuKeyboardNavigation({
  open,
  menuRef,
  triggerRef,
  onClose,
}: Readonly<{
  open: boolean;
  menuRef: RefObject<HTMLElement | null>;
  /** Restored when the menu closes from the keyboard. */
  triggerRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
}>): void {
  // Held in a ref so that a consumer re-rendering (the mobile chrome tracks scroll)
  // does not detach and re-attach the listener underneath an open menu.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const triggerRefHolder = useRef(triggerRef);
  triggerRefHolder.current = triggerRef;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        triggerRefHolder.current?.current?.focus();
        return;
      }
      // Tabbing away leaves the menu: the pattern ends when focus does.
      if (event.key === 'Tab') {
        closeRef.current();
        return;
      }

      const menu = menuRef.current;
      if (!menu) return;
      const target = event.target as Node | null;
      // Item navigation applies only inside the open menu, so a register typing
      // into a filter field behind it keeps its own arrow keys.
      if (!target || !menu.contains(target)) return;

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        focusMenuItem(menu, event.key === 'ArrowDown' ? 'next' : 'previous');
      } else if (event.key === 'Home') {
        event.preventDefault();
        focusMenuItem(menu, 'first');
      } else if (event.key === 'End') {
        event.preventDefault();
        focusMenuItem(menu, 'last');
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, menuRef]);
}
