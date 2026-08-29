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
  /**
   * ID of the single tabpanel this tab list controls. That panel is always
   * rendered, so every tab may reference it. When unset the tabs use the
   * one-panel-per-tab scheme `${idPrefix}-panel-${item.id}`; see the
   * `aria-controls` note on the tab below for why only the active tab
   * advertises it.
   */
  panelId?: string;
  /** Keep the active label visible on phones while inactive tabs collapse to icons. */
  compactMobile?: boolean;
  /** Unique prefix when more than one tab list can render on the same page. */
  idPrefix?: string;
}>;

/**
 * Compact, horizontally scrollable workspace switcher.
 * The previous gradient mask was intentionally removed because WebKit can
 * render mask-backed scroll strips inconsistently inside composited dialogs.
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
        className="flex min-w-0 gap-0.5 overflow-x-auto overscroll-x-contain rounded-lg border border-border/55 bg-muted/20 p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              /*
               * `aria-controls` must reference an element that exists (WCAG
               * 4.1.2 / axe `aria-valid-attr-value`). With the shared
               * `panelId` the panel is always rendered, so every tab can point
               * at it. With one panel per tab, consumers mount only the active
               * panel — `GovernanceHubWorkspace` and `ContractDetailWorkspace`
               * both do — so inactive tabs would otherwise reference ids that
               * are not in the DOM. Only the active tab advertises the
               * relationship in that mode.
               */
              aria-controls={panelId ?? (isActive ? `${idPrefix}-panel-${item.id}` : undefined)}
              aria-label={compactMobile ? item.label : undefined}
              id={`${idPrefix}-tab-${item.id}`}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none',
                compactMobile && !isActive && 'max-sm:min-w-11 max-sm:justify-center max-sm:px-2',
                isActive
                  ? 'bg-card text-foreground shadow-card'
                  : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
              )}
            >
              <item.icon className="size-3.5" aria-hidden="true" />
              <span className={cn('whitespace-nowrap', compactMobile && !isActive && 'max-sm:hidden')}>{item.label}</span>
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
  /**
   * Must match the `idPrefix` given to the paired `SectionTabs`, otherwise the
   * tab's `aria-controls` and this panel's `aria-labelledby` point at ids that
   * do not exist.
   */
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
