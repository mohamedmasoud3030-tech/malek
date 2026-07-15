import type { ReactNode } from 'react';
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
 * Horizontal, scrollable pill-style tab bar.
 * Pairs with <SectionTabPanel> to render exactly one section at a time
 * instead of stacking every section on the page (the "everything is
 * dumped on one screen" antipattern). Used by reports and settings;
 * any future multi-section page should reuse this instead of writing
 * a new nav + scroll-into-view implementation.
 */
export function SectionTabs<TId extends string>({ items, activeId, onChange, ariaLabel }: SectionTabsProps<TId>) {
  return (
    <div className="relative -mx-3 mb-2 sm:-mx-1">
      <nav
        aria-label={ariaLabel}
        role="tablist"
        className="flex scroll-px-3 gap-2 overflow-x-auto px-3 pb-1 [mask-image:linear-gradient(to_left,transparent,black_16px,black_calc(100%-16px),transparent)] [scrollbar-width:none] sm:px-1 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              role="tab"
              aria-selected={isActive}
              aria-controls={`section-panel-${item.id}`}
              id={`section-tab-${item.id}`}
              className={cn(
                'flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold transition',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
              )}
            >
              <item.icon className="size-4" />
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
