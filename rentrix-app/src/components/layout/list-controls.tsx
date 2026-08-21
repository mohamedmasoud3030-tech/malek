import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ListControlSurfaceProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly ariaLabel?: string;
}

/**
 * Canonical register toolbar surface used by entity list pages.
 * Inspired by professional data consoles, but deliberately MALEK-specific:
 * thin borders, dense spacing, quiet hierarchy and one continuous toolbar
 * surface instead of stacked dashboard cards.
 */
export function ListControlSurface({ children, className, ariaLabel = 'البحث والتصفية' }: ListControlSurfaceProps) {
  return (
    <section
      data-list-controls
      data-register-toolbar
      aria-label={ariaLabel}
      className={cn(
        'overflow-hidden rounded-xl border border-border/85 bg-background shadow-[0_1px_2px_hsl(var(--foreground)/0.025)]',
        'p-2 sm:p-2.5',
        '[&_[data-filter-tabs-scroll]]:pb-0',
        '[&_button]:shrink-0',
        className,
      )}
    >
      {children}
    </section>
  );
}
