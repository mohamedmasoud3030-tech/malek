/**
 * EnterpriseSidebarSection — Enterprise UX Foundation (Wave 4A)
 *
 * Labeled navigation group for sidebars: optional collapsing, icon items,
 * active state and count badges. Uses sidebar tokens so it blends with the
 * app rail in both themes. Generic — modules pass plain item configs.
 */

import { useState, type ComponentType, type ReactNode } from 'react';
import { createElement } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { typographyPresets } from './design-tokens';

export interface EnterpriseSidebarItem {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
  /** Highlights against the sidebar active token. */
  active?: boolean;
  badge?: number | string;
  disabled?: boolean;
}

export interface EnterpriseSidebarSectionProps {
  title?: string;
  items?: EnterpriseSidebarItem[];
  /** Free-form content (instead of `items`). */
  children?: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Extra node pinned to the section bottom. */
  footer?: ReactNode;
  /** Tone: standalone panel (card) vs. inside the dark app rail. */
  surface?: 'card' | 'rail';
  className?: string;
}

export function EnterpriseSidebarSection({
  title,
  items,
  children,
  collapsible = false,
  defaultCollapsed = false,
  footer,
  surface = 'card',
  className,
}: EnterpriseSidebarSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const bodyId = useState(() => `sidebar-section-${Math.random().toString(36).slice(2, 9)}`)[0];

  const isRail = surface === 'rail';

  return (
    <nav
      data-enterprise-sidebar-section
      aria-label={title}
      className={cn(isRail ? 'text-sidebar-foreground' : 'rounded-2xl border border-border bg-card p-2', className)}
    >
      {title ? (
        <button
          type="button"
          disabled={!collapsible}
          onClick={collapsible ? () => setCollapsed((prev) => !prev) : undefined}
          aria-expanded={collapsible ? !collapsed : undefined}
          aria-controls={collapsible ? bodyId : undefined}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2',
            typographyPresets.overline,
            isRail && 'text-sidebar-foreground/70',
            collapsible &&
              'cursor-pointer transition-colors hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
            !collapsible && 'cursor-default',
          )}
        >
          <span>{title}</span>
          {collapsible ? (
            <ChevronDown
              className={cn('size-3.5 transition-transform duration-200', collapsed && '-rotate-90 rtl:rotate-90')}
              aria-hidden="true"
            />
          ) : null}
        </button>
      ) : null}

      <div id={bodyId} hidden={collapsible && collapsed} className="flex flex-col gap-0.5">
        {items?.map((item) => {
          const content = (
            <>
              {item.icon ? createElement(item.icon, { className: 'size-4 shrink-0' }) : null}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
              {item.badge !== undefined ? (
                <Badge variant={item.active ? 'primary' : 'neutral'} className="px-1.5">
                  {item.badge}
                </Badge>
              ) : null}
            </>
          );

          const itemClasses = cn(
            'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
            item.active
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
              : cn(
                  isRail ? 'text-sidebar-foreground/85' : 'text-muted-foreground',
                  'hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                ),
            item.disabled && 'cursor-not-allowed opacity-50',
          );

          return item.href && !item.disabled ? (
            <a key={item.id} href={item.href} onClick={item.onClick} aria-current={item.active ? 'page' : undefined} className={itemClasses}>
              {content}
            </a>
          ) : (
            <button
              key={item.id}
              type="button"
              onClick={item.disabled ? undefined : item.onClick}
              disabled={item.disabled}
              aria-current={item.active ? 'page' : undefined}
              className={itemClasses}
            >
              {content}
            </button>
          );
        })}
        {children}
      </div>

      {footer ? <div className="mt-2 px-3 pb-1">{footer}</div> : null}
    </nav>
  );
}
