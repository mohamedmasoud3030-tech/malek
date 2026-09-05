import { createElement, isValidElement, useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

/**
 * Selecting an item unmounts the menu synchronously, so the second click of
 * a double-click (or double-tap) would land on whatever the menu was
 * covering — on a mobile card that is the card body or its primary action,
 * i.e. an unrelated operation fired by accident. Swallow only that follow-up
 * click: the browser marks it as part of the same click sequence
 * (`detail >= 2`), so a deliberate later click elsewhere is never affected.
 */
function shieldDoubleClickFollowUp(): void {
  if (typeof document === 'undefined') return;
  const onClickCapture = (event: MouseEvent) => {
    document.removeEventListener('click', onClickCapture, true);
    window.clearTimeout(expiry);
    if (event.detail >= 2) {
      event.stopPropagation();
      event.preventDefault();
    }
  };
  const expiry = window.setTimeout(() => document.removeEventListener('click', onClickCapture, true), 600);
  document.addEventListener('click', onClickCapture, true);
}

function isDestructive(item: ActionMenuEntry): boolean {
  return isActionMenuItem(item) ? Boolean(item.destructive) : item.variant === 'destructive' || Boolean(item.danger);
}

export function ActionMenu({ items, label = 'الإجراءات', align = 'end', className, variant = 'icon', disabled = false, triggerIcon }: ActionMenuProps) {
  // Disabled actions are deliberately unavailable rather than focusable/selectable.
  const visibleItems = items.filter((item) => !item.disabled);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({ top: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const labeled = variant === 'labeled';

  const positionMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // The menu is a fixed-position portal, so it cannot be scrolled into
    // view: when a trigger sits low in the viewport (mobile cards near the
    // bottom bar), open upward so the last items stay reachable.
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const spaceBelow = window.innerHeight - rect.bottom - 4;
    const spaceAbove = rect.top - 4;
    const openUpward = menuHeight > 0 && spaceBelow < menuHeight && spaceAbove > spaceBelow;
    const vertical = openUpward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 };
    setMenuPosition({ ...vertical, ...(align === 'start' ? { left: rect.left } : align === 'center' ? { left: rect.left + rect.width / 2 } : { right: window.innerWidth - rect.right }) });
  };
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };
  const focusItem = (index: number) => itemRefs.current[index]?.focus();

  useEffect(() => {
    if (!open) return;
    positionMenu();
    requestAnimationFrame(() => focusItem(0));
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

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
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => focusItem(event.key === 'ArrowUp' ? visibleItems.length - 1 : 0));
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
          className={cn('fixed z-[100] max-h-[calc(100dvh-1rem)] min-w-44 overflow-y-auto rounded-xl border border-border/80 bg-card p-1 shadow-elevated', align === 'center' && '-translate-x-1/2')}
        >
          {visibleItems.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => { itemRefs.current[index] = node; }}
              type="button"
              role="menuitem"
              className={cn('flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-start text-sm font-semibold outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/25', isDestructive(item) ? 'text-destructive hover:bg-destructive/10' : 'text-foreground')}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') { event.preventDefault(); focusItem((index + 1) % visibleItems.length); }
                else if (event.key === 'ArrowUp') { event.preventDefault(); focusItem((index - 1 + visibleItems.length) % visibleItems.length); }
                else if (event.key === 'Home') { event.preventDefault(); focusItem(0); }
                else if (event.key === 'End') { event.preventDefault(); focusItem(visibleItems.length - 1); }
                else if (event.key === 'Escape') { event.preventDefault(); close(true); }
              }}
              onClick={(event) => {
                selectItem(item);
                close(true);
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
