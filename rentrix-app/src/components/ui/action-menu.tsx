import { MoreHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export type ActionMenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
  hidden?: boolean;
};

type ActionMenuProps = {
  items: ActionMenuItem[];
  label?: string;
  align?: 'start' | 'end';
  className?: string;
  triggerClassName?: string;
};

/**
 * Overflow action menu for entity rows/cards (print, PDF, share, more).
 * Keeps primary surfaces clean while exposing full product actions.
 */
export function ActionMenu({
  items,
  label = 'المزيد من الإجراءات',
  align = 'end',
  className,
  triggerClassName,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const visibleItems = items.filter((item) => !item.hidden);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (visibleItems.length === 0) return null;

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className={cn('size-10', triggerClassName)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal className="size-4" />
      </Button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={cn(
            'absolute z-50 mt-1 min-w-48 overflow-hidden rounded-2xl border border-border bg-card p-1 shadow-lg',
            align === 'end' ? 'end-0' : 'start-0',
            'top-full',
          )}
        >
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cn(
                'flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-right text-sm font-bold transition',
                'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                'disabled:pointer-events-none disabled:opacity-50',
                item.destructive ? 'text-destructive hover:bg-destructive/10' : 'text-foreground',
              )}
              onClick={() => {
                if (item.disabled) return;
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon ? <span className="shrink-0 opacity-80">{item.icon}</span> : null}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
