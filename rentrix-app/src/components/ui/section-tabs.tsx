import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SectionTabItem<TId extends string> = Readonly<{
  id: TId;
  label: string;
  /** Optional: label-only rails (e.g. report product targets) omit icons. */
  icon?: React.ComponentType<{ className?: string }>;
}>;

type SectionTabsProps<TId extends string> = Readonly<{
  items: ReadonlyArray<SectionTabItem<TId>>;
  activeId: TId;
  onChange: (id: NoInfer<TId>) => void;
  ariaLabel: string;
  /**
   * ID of the single tabpanel this tab list controls. That panel is always
   * rendered, so every tab may reference it. When unset the tabs use the
   * one-panel-per-tab scheme `${idPrefix}-panel-${item.id}`.
   */
  panelId?: string;
  /** Keep the active label visible on phones while inactive tabs collapse to icons. */
  compactMobile?: boolean;
  /** Unique prefix when more than one tab list can render on the same page. */
  idPrefix?: string;
}>;

/**
 * Horizontally scrollable workspace navigation.
 *
 * Tabs are intentionally rendered as a navigation rail rather than another
 * segmented card. The active destination is communicated by typography and a
 * quiet underline, keeping page content visually dominant.
 */
export function SectionTabs<TId extends string>({
  items,
  activeId,
  onChange,
  ariaLabel,
  panelId,
  compactMobile = false,
  idPrefix = 'section',
}: SectionTabsProps<TId>) {
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
    <div className="min-w-0">
      <nav
        aria-label={ariaLabel}
        role="tablist"
        className="flex min-w-0 gap-0.5 overflow-x-auto overscroll-x-contain border-b border-border/60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, index) => {
          const isActive = activeId === item.id;
          const Icon = item.icon;
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
              aria-controls={panelId ?? (isActive ? `${idPrefix}-panel-${item.id}` : undefined)}
              aria-label={compactMobile && Icon ? item.label : undefined}
              id={`${idPrefix}-tab-${item.id}`}
              className={cn(
                'relative flex min-h-11 shrink-0 items-center gap-1.5 px-3 py-1 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-4 focus-visible:ring-primary/15 motion-reduce:transition-none',
                compactMobile && !isActive && Icon && 'max-sm:min-w-11 max-sm:justify-center max-sm:px-2',
                isActive
                  ? 'text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                  : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
              )}
            >
              {Icon ? (
                <Icon
                  className={cn('size-3.5', isActive && 'text-primary')}
                  aria-hidden="true"
                />
              ) : null}
              <span
                className={cn(
                  'whitespace-nowrap',
                  compactMobile && !isActive && Icon && 'max-sm:hidden',
                )}
              >
                {item.label}
              </span>
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
  /** Must match the `idPrefix` given to the paired `SectionTabs`. */
  idPrefix?: string;
  children: ReactNode;
}>;

/** Renders children only when id === activeId; otherwise sets `hidden`. */
export function SectionTabPanel<TId extends string>({
  id,
  activeId,
  idPrefix = 'section',
  children,
}: SectionTabPanelProps<TId>) {
  return (
    <div
      id={`${idPrefix}-panel-${id}`}
      role="tabpanel"
      aria-labelledby={`${idPrefix}-tab-${id}`}
      hidden={activeId !== id}
    >
      {children}
    </div>
  );
}
