import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ListControlSurfaceProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly ariaLabel?: string;
}

/**
 * Canonical register control surface used by entity list pages.
 * It deliberately behaves like table chrome rather than a dashboard card:
 * thin border, compact spacing, neutral background and no decorative shadow.
 */
export function ListControlSurface({ children, className, ariaLabel = 'البحث والتصفية' }: ListControlSurfaceProps) {
  return (
    <section
      data-list-controls
      aria-label={ariaLabel}
      className={cn(
        'rounded-xl border border-border bg-background p-2 shadow-[0_1px_2px_hsl(var(--foreground)/0.025)] sm:p-2.5',
        className,
      )}
    >
      {children}
    </section>
  );
}
