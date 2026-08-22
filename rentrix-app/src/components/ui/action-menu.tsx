import { createElement, isValidElement, useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from 'react';
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
}

function isActionMenuItem(item: ActionMenuEntry): item is ActionMenuItem {
  return 'onSelect' in item;
}

function getIcon(item: ActionMenuEntry): ReactNode {
  if (!item.icon) return null;
  if (isValidElement(item.icon)) return item.icon;
  // lucide-react exports forwardRef components as objects rather than functions.
  return createElement(item.icon as ComponentType<{ className?: string }>, { className: 'size-3.5' });
}

function selectItem(item: ActionMenuEntry): void {
  if (isActionMenuItem(item)) item.onSelect();
  else item.onClick();
}

function isDestructive(item: ActionMenuEntry): boolean {
  if (isActionMenuItem(item)) return Boolean(item.destructive);
  return item.variant === 'destructive' || Boolean(item.danger);
}

export function ActionMenu({ items, label = 'الإجراءات', className }: ActionMenuProps) {
  const visibleItems = items.filter((item) => !item.disabled);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
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

  if (visibleItems.length === 1) {
    const item = visibleItems[0];
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => selectItem(item)}
        className={cn('size-11 text-muted-foreground hover:text-foreground', className)}
        aria-label={item.label}
        title={item.label}
        data-action-menu
      >
        {getIcon(item) ?? <MoreVertical className="size-4" aria-hidden="true" />}
        <span className="sr-only">{item.label}</span>
      </Button>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative', className)} data-action-menu>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={label}
        className="size-11 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </Button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute end-0 z-50 mt-1 min-w-44 overflow-hidden rounded-xl border border-border/80 bg-card p-1 shadow-elevated"
        >
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              className={cn(
                'flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-start text-sm font-semibold outline-none transition-colors',
                'hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/25',
                isDestructive(item) ? 'text-destructive hover:bg-destructive/10' : 'text-foreground',
              )}
              onClick={() => {
                selectItem(item);
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              {getIcon(item)}
              <span className="min-w-0 truncate">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface QuickAction {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export interface QuickActionBarProps {
  actions: QuickAction[];
  className?: string;
}

export function QuickActionBar({ actions, className }: QuickActionBarProps) {
  if (actions.every((action) => action.disabled)) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            variant={action.variant ?? 'secondary'}
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled || action.loading}
            className={cn('min-h-11 gap-2', action.className)}
          >
            {action.loading ? (
              <span className="size-4 rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Icon className="size-4" aria-hidden="true" />
            )}
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}

export interface MobileActionGridProps {
  actions: QuickAction[];
  className?: string;
}

export function MobileActionGrid({ actions, className }: MobileActionGridProps) {
  const visibleActions = actions.filter((action) => !action.disabled);
  if (visibleActions.length === 0) return null;

  return (
    <div className={cn('grid grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2', className)}>
      {visibleActions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            variant={action.variant ?? 'secondary'}
            onClick={action.onClick}
            disabled={action.disabled}
            className="min-h-14 flex-col gap-1.5 py-3"
          >
            <Icon className="size-5" aria-hidden="true" />
            <span className="text-xs font-bold">{action.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
