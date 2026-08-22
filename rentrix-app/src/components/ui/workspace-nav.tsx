import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ComponentType } from 'react';
import { cn } from '@/lib/utils';

export type WorkspaceNavItem<TId extends string> = Readonly<{
  id: TId;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}>;

/**
 * Product navigation for workspace sections.
 * Never uses a native <select> — that opens an iOS system popup and breaks RTL.
 */
export function WorkspaceNav<TId extends string>({
  items,
  activeId,
  onChange,
  ariaLabel,
  className,
}: Readonly<{
  items: ReadonlyArray<WorkspaceNavItem<TId>>;
  activeId: TId | null | undefined;
  onChange: (id: TId) => void;
  ariaLabel: string;
  className?: string;
}>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const active = items.find((item) => item.id === activeId) ?? items[0];
  const ActiveIcon = active?.icon;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className={cn('min-w-0', className)} data-workspace-nav>
      <nav aria-label={ariaLabel} className="hidden gap-1 md:flex md:flex-col">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active?.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-start text-xs font-semibold outline-none transition-colors focus-visible:ring-4 focus-visible:ring-primary/20',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
              <span className="min-w-0 truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="md:hidden" data-workspace-nav-mobile>
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3 text-start shadow-card outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
        >
          {ActiveIcon ? (
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ActiveIcon className="size-4" aria-hidden="true" />
            </span>
          ) : null}
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{active?.label}</span>
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>

        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="mt-1.5 overflow-hidden rounded-xl border border-border/85 bg-card p-1 shadow-elevated"
          >
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === active?.id;
              return (
                <li key={item.id} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-start text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
                      isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                    )}
                  >
                    {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
                    <span className="min-w-0 truncate">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
