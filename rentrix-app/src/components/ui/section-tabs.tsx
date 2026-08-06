import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SectionTabItem<TId extends string> = Readonly<{
  id: TId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}>;

type SectionTabsProps<TId extends string> = Readonly<{
  items: ReadonlyArray<SectionTabItem<TId>>;
  activeId: TId;
  onChange: (id: NoInfer<TId>) => void;
  ariaLabel: string;
}>;

/**
 * Horizontal, scrollable tab bar for one in-page workspace section at a time.
 *
 * It follows the ARIA tabs keyboard pattern: Tab enters the active tab, then
 * arrows/Home/End move focus and activate another section. RTL swaps the
 * physical left/right direction so arrow movement remains visually natural.
 */
export function SectionTabs<TId extends string>({ items, activeId, onChange, ariaLabel }: SectionTabsProps<TId>) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusAndSelect = (index: number) => {
    const item = items[index];
    if (!item) return;
    onChange(item.id);
    tabRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (items.length === 0) return;

    const direction = event.currentTarget.closest('[dir]')?.getAttribute('dir')
      ?? document.documentElement.dir
      ?? 'rtl';
    const nextKey = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const previousKey = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let targetIndex: number | null = null;

    if (event.key === nextKey) {
      targetIndex = (currentIndex + 1) % items.length;
    } else if (event.key === previousKey) {
      targetIndex = (currentIndex - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = items.length - 1;
    }

    if (targetIndex === null) return;
    event.preventDefault();
    focusAndSelect(targetIndex);
  };

  return (
    <div className="relative -mx-3 mb-2 min-w-0 sm:-mx-1">
      <nav
        aria-label={ariaLabel}
        role="tablist"
        className="flex scroll-px-3 gap-2 overflow-x-auto px-3 pb-1 [mask-image:linear-gradient(to_left,transparent,black_16px,black_calc(100%-16px),transparent)] [scrollbar-width:none] sm:px-1 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, index) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              ref={(node) => { tabRefs.current[index] = node; }}
              type="button"
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              aria-selected={isActive}
              aria-controls={`section-panel-${item.id}`}
              id={`section-tab-${item.id}`}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
              )}
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

type SectionTabPanelProps<TId extends string> = Readonly<{
  id: TId;
  activeId: TId;
  children: ReactNode;
}>;

/** Renders children only when id === activeId; otherwise sets `hidden`. */
export function SectionTabPanel<TId extends string>({ id, activeId, children }: SectionTabPanelProps<TId>) {
  return (
    <div id={`section-panel-${id}`} role="tabpanel" aria-labelledby={`section-tab-${id}`} hidden={activeId !== id}>
      {children}
    </div>
  );
}
