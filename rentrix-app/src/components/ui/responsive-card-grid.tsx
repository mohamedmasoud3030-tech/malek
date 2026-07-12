import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type DesktopColumns = 2 | 3 | 4 | 5 | 6 | 7;

const desktopColumnClasses: Record<DesktopColumns, string> = {
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
  6: 'xl:grid-cols-6',
  7: 'xl:grid-cols-7',
};

type ResponsiveCardGridProps = Readonly<{
  children: ReactNode;
  className?: string;
  desktopColumns?: DesktopColumns;
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
 * Keeps phone layouts dense but safe: 2 columns by default, 3 on tablet, and an
 * explicit desktop density controlled by `desktopColumns`.
 */
export function ResponsiveCardGrid({
  children,
  className,
  desktopColumns = 4,
  gap = 'md',
  as: Component = 'div',
}: ResponsiveCardGridProps) {
  return (
    <Component
      className={cn(
        'grid min-w-0 grid-cols-2 sm:grid-cols-3',
        desktopColumnClasses[desktopColumns],
        gapClasses[gap],
        '[&>*]:min-w-0',
        className,
      )}
    >
      {children}
    </Component>
  );
}
