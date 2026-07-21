import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ListControlSurfaceProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly ariaLabel?: string;
}

/**
 * Shared list-page controls surface — the card that wraps search + filters
 * on every entity list page (Properties, Contracts, …).
 *
 * Extraction contract: ListPage renders its search/filter grid inside this
 * surface, and pages that keep their KPI grid above the filters (Contracts)
 * wrap their filter row with it directly — so both shapes share the exact
 * same border, radius, padding, and shadow tokens.
 */
export function ListControlSurface({ children, className, ariaLabel = 'البحث والتصفية' }: ListControlSurfaceProps) {
  return (
    <section
      data-list-controls
      aria-label={ariaLabel}
      className={cn(
        'rounded-2xl border border-border/70 bg-card p-2.5 shadow-[0_6px_20px_hsl(var(--foreground)/0.035)] sm:p-3',
        className,
      )}
    >
      {children}
    </section>
  );
}
