import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ResponsiveCardGridProps = Readonly<{
  children: ReactNode;
  className?: string;
  /**
   * MALEK density contract: two columns is the default ceiling everywhere.
   * Three columns is allowed only when a screen opts into it explicitly.
   * Legacy values 4–7 are accepted for source compatibility but collapse to 2.
   */
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
 * Canonical repeated-card layout.
 *
 * - Mobile: fixed 2×N rhythm.
 * - Desktop: remains 2 columns by default; an explicit `desktopColumns={3}`
 *   is the only supported wider rhythm.
 * - Legacy requests for 4+ columns intentionally collapse to 2 so dense
 *   dashboards do not become sparse strips of tiny cards.
 * - In the normal two-column mode, an odd final card spans the full row so
 *   the page never ends with a visually empty half-row.
 */
export function ResponsiveCardGrid({
  children,
  className,
  desktopColumns = 2,
  gap = 'md',
  as: Component = 'div',
}: ResponsiveCardGridProps) {
  const allowThreeColumns = desktopColumns === 3;

  return (
    <Component
      data-responsive-card-grid
      data-desktop-columns={allowThreeColumns ? '3' : '2'}
      className={cn(
        'grid min-w-0 grid-cols-2',
        allowThreeColumns
          ? 'lg:grid-cols-3'
          : '[&>*:last-child:nth-child(odd)]:col-span-2',
        gapClasses[gap],
        '[&>*]:min-w-0',
        className,
      )}
    >
      {children}
    </Component>
  );
}
