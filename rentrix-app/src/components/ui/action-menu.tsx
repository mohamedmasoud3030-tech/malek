import { createElement, isValidElement, useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { focusMenuItem, useMenuKeyboardNavigation } from './menu-keyboard';
import { shieldDoubleClickFollowUp } from './menu-click-shield';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
}

export interface ActionItem {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  shortcut?: string;
  danger?: boolean;
  onClick: () => void;
}

type ActionMenuEntry = ActionMenuItem | ActionItem;

export interface ActionMenuProps {
  items: ActionMenuEntry[];
  label?: string;
  align?: 'start' | 'center' | 'end';
  className?: string;
  /** Icon-only trigger (default) or a compact labeled trigger such as «تصدير». */
  variant?: 'icon' | 'labeled';
  /** Disable the trigger without removing the menu from the layout. */
  disabled?: boolean;
  /** Override the default ellipsis while retaining the shared accessible menu behavior. */
  triggerIcon?: ReactNode;
}

function isActionMenuItem(item: ActionMenuEntry): item is ActionMenuItem {
  return 'onSelect' in item;
}

function getIcon(item: ActionMenuEntry): ReactNode {
  if (!item.icon) return null;
  if (isValidElement(item.icon)) return item.icon;
  return createElement(item.icon as ComponentType<{ className?: string }>, { className: 'size-3.5' });
}

function selectItem(item: ActionMenuEntry): void {
  if (isActionMenuItem(item)) item.onSelect();
  else item.onClick();
}

function isDestructive(item: ActionMenuEntry): boolean {
  return isActionMenuItem(item) ? Boolean(item.destructive) : item.variant === 'destructive' || Boolean(item.danger);
}

/** Distance kept between the menu and its trigger, and the viewport inset. */
const MENU_TRIGGER_GAP = 4;
const MENU_VIEWPORT_MARGIN = 8;

export interface ActionMenuPlacementInput {
  /** Trigger rect in viewport coordinates. */
  trigger: { top: number; bottom: number; left: number; right: number };
  menu: { width: number; height: number };
  viewport: { width: number; height: number };
  align?: 'start' | 'center' | 'end';
}

/**
 * Places the portalled menu so every item stays reachable.
 *
 * The menu is positioned against the trigger inside a fixed layer, so a row near
 * the bottom of a phone viewport used to push the last actions below the fold
 * where no scroll gesture can reach them. The resolver therefore flips the menu
 * above the trigger when it does not fit below, and otherwise caps its height to
 * the space that exists, which keeps a long menu scrollable instead of clipped.
 */
export function resolveActionMenuPlacement({
  trigger,
  menu,
  viewport,
  align = 'end',
}: Readonly<ActionMenuPlacementInput>) {
  const availableBelow = Math.max(0, viewport.height - trigger.bottom - MENU_TRIGGER_GAP - MENU_VIEWPORT_MARGIN);
  const availableAbove = Math.max(0, trigger.top - MENU_TRIGGER_GAP - MENU_VIEWPORT_MARGIN);
  const placeAbove = menu.height > availableBelow && availableAbove > availableBelow;
  const maxHeight = placeAbove ? availableAbove : availableBelow;
  const usedHeight = Math.min(menu.height, maxHeight);
  const naturalTop = placeAbove ? trigger.top - MENU_TRIGGER_GAP - menu.height : trigger.bottom + MENU_TRIGGER_GAP;
  const top = Math.min(
    Math.max(MENU_VIEWPORT_MARGIN, naturalTop),
    Math.max(MENU_VIEWPORT_MARGIN, viewport.height - MENU_VIEWPORT_MARGIN - usedHeight),
  );

  const clamp = (value: number, min: number, max: number) => (max < min ? min : Math.min(Math.max(min, value), max));
  let left: number | undefined;
  let right: number | undefined;
  if (align === 'end') {
    right = Math.max(MENU_VIEWPORT_MARGIN, viewport.width - trigger.right);
  } else if (align === 'center') {
    // The menu is shifted by half its width through `--translate-x-1/2`, so the
    // anchor is clamped as a centre point rather than an edge.
    left = clamp(
      trigger.left + (trigger.right - trigger.left) / 2,
      MENU_VIEWPORT_MARGIN + menu.width / 2,
      Math.max(MENU_VIEWPORT_MARGIN + menu.width / 2, viewport.width - MENU_VIEWPORT_MARGIN - menu.width / 2),
    );
  } else {
    left = clamp(trigger.left, MENU_VIEWPORT_MARGIN, Math.max(MENU_VIEWPORT_MARGIN, viewport.width - MENU_VIEWPORT_MARGIN - menu.width));
  }

  return { top, maxHeight, left, right, placeAbove };
}

export function ActionMenu({ items, label = 'الإجراءات', align = 'end', className, variant = 'icon', disabled = false, triggerIcon }: ActionMenuProps) {
  // Disabled actions are deliberately unavailable rather than focusable/selectable.
  const visibleItems = items.filter((item) => !item.disabled);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; maxHeight?: number; left?: number; right?: number }>({ top: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const labeled = variant === 'labeled';

  const positionMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!rect || !menu) return;
    setMenuPosition(resolveActionMenuPlacement(
      {
        trigger: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
        menu: { width: menu.offsetWidth, height: menu.offsetHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        align,
      },
    ));
  };
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    positionMenu();
    requestAnimationFrame(() => focusMenuItem(menuRef.current, 'first'));
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    // A fixed menu must follow the row it belongs to: on a phone the register can
    // scroll (or the soft keyboard can resize the viewport) while the menu is open.
    const onReflow = () => positionMenu();
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open]);

  // Escape, Tab and the item navigation keys come from the shared menu authority.
  useMenuKeyboardNavigation({ open, menuRef, triggerRef, onClose: () => setOpen(false) });

  if (visibleItems.length === 0) return null;
  // Keep the overflow contract stable even when a row currently has one
  // available operation. A single visible item still opens the same menu so
  // permissions, confirmations, and future actions never change the trigger
  // shape or bypass the canonical action authority.
  return (
    <div className={cn('relative', className)} data-action-menu>
      <Button
        ref={triggerRef}
        type="button"
        variant={labeled ? 'secondary' : 'ghost'}
        size={labeled ? 'sm' : 'icon'}
        aria-label={labeled ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={labeled ? undefined : label}
        disabled={disabled}
        data-action-menu-trigger
        className={labeled
          ? 'min-h-11 gap-1.5 rounded-lg px-3 text-xs font-bold'
          : 'size-11 text-muted-foreground hover:bg-muted hover:text-foreground'}
        onClick={(event) => {
          // The trigger owns its event isolation: activating the menu inside a
          // clickable table row/card must never activate the ancestor as well.
          // Keeping this here removes the need for per-call-site
          // stopPropagation wrappers around the menu.
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.stopPropagation();
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => focusMenuItem(menuRef.current, event.key === 'ArrowUp' ? 'last' : 'first'));
          } else if (open && event.key === 'Escape') {
            // Propagation is contained while the menu is open, so the
            // document-level menu handler cannot see these keys while focus is
            // still on the trigger — close here instead.
            event.stopPropagation();
            event.preventDefault();
            setOpen(false);
          } else if (open && event.key === 'Tab') {
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === 'Enter' || event.key === ' ') {
            // Keep row/card keyboard activation from double-firing; the button
            // still toggles the menu through its own click.
            event.stopPropagation();
          }
        }}
      >
        {labeled ? (
          <>
            <span>{label}</span>
            <MoreVertical className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </>
        ) : (
          <>
            {triggerIcon ?? <MoreHorizontal className="size-4" aria-hidden="true" />}
            <span className="sr-only">{label}</span>
          </>
        )}
      </Button>
      {open ? createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          dir={typeof document !== 'undefined' && document.documentElement.dir === 'ltr' ? 'ltr' : 'rtl'}
          style={menuPosition}
          className={cn('fixed z-[100] max-h-[calc(100dvh-1rem)] min-w-44 overflow-x-hidden overflow-y-auto rounded-xl border border-border/80 bg-card p-1 shadow-elevated', align === 'center' && '-translate-x-1/2')}
        >
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={cn('flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-start text-sm font-semibold outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/25', isDestructive(item) ? 'text-destructive hover:bg-destructive/10' : 'text-foreground')}
              // Arrow, Home/End and Escape navigation is owned by
              // useMenuKeyboardNavigation; Enter and Space stay native so the item
              // activates whatever its element is.
              onClick={(event) => {
                selectItem(item);
                close(true);
                // Keyboard activation reports detail 0, so only a pointer click
                // arms the follow-up shield.
                if (event.detail > 0) shieldDoubleClickFollowUp();
              }}
            >
              {getIcon(item)}<span className="min-w-0 truncate">{item.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
