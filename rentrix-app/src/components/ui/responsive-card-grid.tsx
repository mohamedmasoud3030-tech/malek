import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ResponsiveCardGridProps = Readonly<{
  children: ReactNode;
  className?: string;
  /** @deprecated Metric cards now use one consistent two-column layout. */
  desktopColumns?: 2 | 3 | 4 | 5 | 6 | 7;
  gap?: 'sm' | 'md' | 'lg';
  as?: 'div' | 'section' | 'dl';
}>;

const gapClasses = {
  sm: 'gap-2.5',
  md: 'gap-3',
  lg: 'gap-4',
} as const;

/**
 * Shared metric/card grid for repeated KPI, summary, overview, and statistics cards.
 * Keeps every metric group on the same two-column rhythm. Four metrics therefore
 * render as a predictable 2×2 block at every supported breakpoint.
 */
export function ResponsiveCardGrid({
  children,
  className,
  gap = 'md',
  as: Component = 'div',
}: ResponsiveCardGridProps) {
  return (
    <Component
      className={cn(
        'grid min-w-0 grid-cols-2',
        gapClasses[gap],
        '[&>*]:min-w-0',
        className,
      )}
    >
      {children}
    </Component>
  );
}
